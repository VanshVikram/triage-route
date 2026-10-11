"""
Triage & Route — FastAPI wrapper around the existing agent.

Course/hackathon prototype. 100% synthetic data. NOT a medical device.

This file contains ONLY the HTTP adapter layer.
All triage logic lives in agent.py + engine/triage_engine.py.

Run locally:
    uvicorn api:app --reload --port 8000
"""
import os
import sys

# Load .env before anything else so LLM_API_KEY etc. are available.
# python-dotenv is a dev/deploy convenience only — no secrets are hardcoded here.
from dotenv import load_dotenv
load_dotenv()

# Ensure engine/ is on the path (agent.py does this too, but api.py imports agent
# directly so we need it here as well when uvicorn runs from the project root).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from agent import run_agent

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Triage & Route API",
    description=(
        "Decision-support API for the Triage & Route agentic triage assistant. "
        "100% synthetic data. NOT a medical device. Physician confirmation required."
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

_frontend_origin = os.environ.get("FRONTEND_ORIGIN", "").strip()
if _frontend_origin:
    _allowed_origins.append(_frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------
class TriageRequest(BaseModel):
    caseText: str

    @field_validator("caseText")
    @classmethod
    def must_be_non_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("caseText must be a non-empty string")
        return v.strip()

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health", summary="Health check")
def health():
    """Returns ok when the service is up."""
    return {"status": "ok"}


@app.post("/triage", summary="Run agentic triage on a synthetic patient case")
def triage(request: TriageRequest):
    """
    Accept a free-text synthetic patient case and return the agent's
    full triage result.

    The endpoint delegates 100% of triage logic to run_agent() in agent.py.
    No medical reasoning is performed here.
    """
    try:
        result = run_agent(request.caseText)
        return result
    except Exception as exc:
        # SECURITY: never expose API keys, auth headers, stack traces, or env vars.
        # Classify the error type safely for a useful (but non-leaking) message.
        exc_type = type(exc).__name__
        exc_msg  = str(exc)

        # Scrub any credential-shaped strings from the message before logging/returning.
        _key = os.environ.get("LLM_API_KEY", "")
        if _key and _key in exc_msg:
            exc_msg = exc_msg.replace(_key, "[REDACTED]")

        llm_error_types = {"RuntimeError", "HTTPStatusError", "ConnectError",
                           "TimeoutException", "RemoteProtocolError", "ReadTimeout"}
        is_llm_failure = (
            exc_type in llm_error_types
            or "LLM" in exc_msg
            or "No LLM provider" in exc_msg
            or "openai" in exc_msg.lower()
            or "generativelanguage" in exc_msg.lower()
        )

        if is_llm_failure:
            detail = (
                "The AI reasoning service is currently unavailable. "
                "Please try again in a moment."
            )
        else:
            detail = "An internal error occurred while processing the case. Please try again."

        raise HTTPException(status_code=500, detail=detail)
