"""
Triage & Route — full agentic loop (MVP).

Course/hackathon prototype. 100% synthetic data. NOT a medical device.

Demonstrates the ReAct pattern with visible tool use:
  1. Case intake (free text)
  2. Structured extraction (code)
  3. Missing-info gate (branch)
  4. Patient history lookup (KB search)
  5. Deterministic red-flag + risk check (code)  -> floor_level
  6. Guideline knowledge search (KB)
  7. LLM reasoning (proposes level 1-5 + reasons)
  8. Safety floor enforcement (code)  -> final_level
  9. Routing (code)
  10. Formatted output + physician-review flag + disclaimer

Run:  python3 agent.py "free-text patient case"
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "engine"))
from triage_engine import (
    extract_case, is_missing_info, run_deterministic, finalize,
    LEVEL_NAMES, ROUTES,
)

KB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kb")

# ---------------------------------------------------------------------------
# Knowledge base access (simulates Lindy's "Search Knowledge Base" action)
# ---------------------------------------------------------------------------
def load_kb():
    kb = {}
    for fname in ("triage_guidelines.md", "red_flags.md", "disclaimer.md"):
        with open(os.path.join(KB_DIR, fname)) as f:
            kb[fname.replace(".md", "")] = f.read()
    with open(os.path.join(KB_DIR, "patients.json")) as f:
        kb["patients"] = json.load(f)
    return kb


def search_guidelines(kb, case):
    """Return the guideline sections relevant to this case (simulated KB search)."""
    s = (case.get("symptoms_text") or "").lower()
    hits = []
    if any(w in s for w in ["chest", "pain", "pressure", "crushing", "radiating"]):
        hits.append("Possible ACS: chest pain with risk factors -> Level 2, front of queue")
    if any(w in s for w in ["facial droop", "slurred", "arm weakness", "confusion"]):
        hits.append("Stroke (FAST): any positive sign -> Level 2, immediate assessment")
    if any(w in s for w in ["breathe", "breathless", "choking", "shortness"]):
        hits.append("Breathing emergency -> Level 1-2 depending on severity")
    if any(w in s for w in ["seizure", "unresponsive", "consciousness"]):
        hits.append("Neuro emergency -> Level 1-2")
    if any(w in s for w in ["bleeding", "vomit"]):
        hits.append("Major bleeding -> Level 2")
    if any(w in s for w in ["suicidal", "overdose"]):
        hits.append("Self-harm risk -> Level 2, escalate to human immediately")
    if not hits:
        hits.append("No specific guideline matched; apply general 5-level scale and 'when in doubt, escalate'.")
    return hits


def lookup_history(kb, patient_id):
    for p in kb["patients"]:
        if p["id"] == patient_id:
            return p
    return None


# ---------------------------------------------------------------------------
# LLM reasoning step (the only non-deterministic step)
# ---------------------------------------------------------------------------
def _call_llm(prompt, system_prompt):
    """Portable LLM call.

    Priority:
      1. Lindy runtime (when running inside Lindy) — exact original behavior.
      2. OpenAI-compatible endpoint (LLM_API_KEY / LLM_BASE_URL / LLM_MODEL)
         when deployed standalone (e.g. Render).
      3. Raises RuntimeError if neither is available (caller falls back to the
         deterministic engine proposal).

    Reliability: the OpenAI-compatible branch retries ONLY HTTP 503 (transient
    service unavailable) with exponential back-off + jitter.  Non-503 errors
    raise immediately.  Maximum 3 retry attempts after the initial request.
    """
    import time
    import random

    try:
        import lindy  # real Lindy runtime
        resp = lindy.call("Lindy-LLMCall", {
            "systemPrompt": system_prompt,
            "prompt": prompt,
            "temperature": 0.0,
            "model": "md",
        })
        text = resp.get("output", "") if isinstance(resp, dict) else str(resp)
        if isinstance(resp, dict) and "text" in resp:
            text = resp["text"]
        return text
    except Exception:
        pass

    import httpx
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        raise RuntimeError("No LLM provider available (no Lindy runtime, no LLM_API_KEY)")
    base_url = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")

    _MAX_RETRIES = 3                       # attempts AFTER the initial request
    _BASE_DELAY  = 1.0                     # seconds (doubles each retry)

    last_exc = None
    for attempt in range(_MAX_RETRIES + 1):   # 0 = initial, 1-3 = retries
        try:
            resp = httpx.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.0,
                },
                timeout=60,
            )

            # Only 503 is retried — all other HTTP errors raise immediately.
            if resp.status_code == 503 and attempt < _MAX_RETRIES:
                delay = _BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                print(f"[_call_llm] HTTP 503 on attempt {attempt + 1}; "
                      f"retrying in {delay:.2f}s …")
                time.sleep(delay)
                continue

            resp.raise_for_status()          # raises for any remaining error
            return resp.json()["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as exc:
            # Non-503 HTTP errors are not retried.
            if exc.response.status_code != 503:
                raise
            last_exc = exc
            if attempt < _MAX_RETRIES:
                delay = _BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                print(f"[_call_llm] HTTP 503 on attempt {attempt + 1}; "
                      f"retrying in {delay:.2f}s …")
                time.sleep(delay)

    # All retry attempts exhausted — re-raise the last 503 error.
    raise last_exc


def _deterministic_proposal(case, det):
    """Engine-grounded fallback level proposal (used only when no LLM is
    available). Uses the existing deterministic risk score + red flags.
    The safety floor is still applied afterwards and remains authoritative."""
    s = (case.get("symptoms_text") or "").lower()
    v = case.get("vitals") or {}
    score = det["risk_score"]

    if any(w in s for w in ["chest pain", "chest pressure", "chest discomfort", "chest tightness",
                            "crushing", "radiating to", "facial droop", "slurred speech",
                            "arm weakness", "can't breathe", "cannot breathe",
                            "severe shortness of breath", "choking", "unresponsive",
                            "loss of consciousness", "heavy bleeding", "vomiting blood",
                            "won't stop bleeding", "suicidal", "overdose"]):
        return 2, ["Symptom red-flag pattern detected (deterministic fallback)"]
    if v.get("spo2") is not None and v["spo2"] < 90:
        return 1, ["SpO2 < 90 (deterministic fallback)"]
    if v.get("spo2") is not None and v["spo2"] < 92:
        return 2, ["SpO2 < 92 (deterministic fallback)"]
    if v.get("temp_c") is not None and v["temp_c"] >= 39:
        return 3, ["High fever (deterministic fallback)"]
    if "vomiting" in s:
        return 3, ["Vomiting present (deterministic fallback)"]
    if "can't bear weight" in s or "twisted" in s or "swollen" in s:
        return 4, ["Minor injury pattern (deterministic fallback)"]
    if score >= 4:
        return 2, ["High risk score (deterministic fallback)"]
    if score >= 2:
        return 3, ["Moderate risk score (deterministic fallback)"]
    return 5, ["Low risk, stable presentation (deterministic fallback)"]


def llm_reason(case, history, det, guidelines):
    """Call the LLM to propose a triage level with rationale.
    The LLM sees the deterministic outputs but can only RAISE urgency, never
    lower it below the floor (enforced in code afterwards)."""

    case_json = json.dumps(case, indent=2)
    hist_json = json.dumps(history, indent=2) if history else "No record found (unknown patient)."
    det_json = json.dumps(det, indent=2)
    guide_text = "\n".join(f"- {g}" for g in guidelines)

    prompt = f"""You are a triage decision-support assistant for a hospital emergency department.
You help a triage nurse prioritise patients. You do NOT diagnose or treat, and a physician always makes the final decision.

STRUCTURED CASE (extracted from intake):
{case_json}

PATIENT HISTORY (from knowledge base):
{hist_json}

DETERMINISTIC RED-FLAG + RISK CHECK (from code step — authoritative):
{det_json}

RELEVANT GUIDELINES (from knowledge base):
{guide_text}

TASK:
Propose a triage level from 1 (most urgent) to 5 (least urgent) with at least two reasons.
- If any red flag exists, your level must be equal to or MORE urgent than the floor level ({det.get('floor_level')}).
- When unsure, choose the MORE urgent level.
- Never claim a confirmed diagnosis. Use "possible" or "consistent with".
- Identify potential clinical concerns (unconfirmed).

CALIBRATION (risk score is a hint only, the floor is authoritative):
- Risk score 0-1 (Low) with NO red flags and stable vitals: this is the non-urgent end.
  A mild, self-limiting complaint (e.g. sore throat, minor rash, mild cold) with normal
  vitals and no concerning features is Level 5 (GP / self-care).
  A minor injury needing one resource (e.g. twisted ankle needing an X-ray) is Level 4.
- Risk score 2-3 (Moderate): Level 3 territory (e.g. high fever with vomiting).
- Risk score 4+ (High): Level 2 territory.
- Do NOT over-escalate stable, low-risk cases. Over-triage is only preferred when there
  is genuine uncertainty about a serious condition, not for clearly minor complaints.

Respond with EXACTLY this JSON (no markdown, no extra text):
{{"llm_level": <int 1-5>, "reasons": ["reason1", "reason2"], "concerns": ["concern1"]}}"""

    resp = _call_llm(prompt, "You are a triage decision-support assistant. Output only the requested JSON.")

    # Parse the LLM's JSON response
    text = resp.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
    try:
        parsed = json.loads(text)
    except Exception:
        # Fallback: extract the first integer as the level
        import re
        m = re.search(r'"llm_level"\s*:\s*(\d)', text)
        parsed = {"llm_level": int(m.group(1)) if m else 3,
                  "reasons": ["LLM output could not be parsed; using conservative default"],
                  "concerns": []}
    return parsed


# ---------------------------------------------------------------------------
# Main agentic loop
# ---------------------------------------------------------------------------
def run_agent(text):
    kb = load_kb()
    trace = []

    # 1. Intake
    trace.append("1. Case intake received")

    # 2. Structured extraction
    case = extract_case(text)
    trace.append("2. Extracted case details")

    # 3. Missing-info gate (branch)
    if is_missing_info(case):
        return {
            "follow_up": True,
            "message": ("I don't have enough information to triage this case. "
                        "Please provide symptoms and at least one vital sign "
                        "(heart rate, blood pressure, SpO2, temperature, or respiratory rate)."),
            "trace": trace + ["3. Missing-info gate -> asking for more information"],
        }

    # 4. Patient history lookup
    history = lookup_history(kb, case.get("patient_id"))
    if history:
        case["history"] = history["history"]
        trace.append(f"4. Retrieved patient history ({case['patient_id']})")
    else:
        trace.append("4. Patient history lookup -> no record found, continuing without history")

    # 5. Deterministic red-flag + risk check (code)
    det = run_deterministic(case)
    trace.append("5. Ran red-flag check + risk score (code)")

    # 6. Guideline knowledge search
    guidelines = search_guidelines(kb, case)
    trace.append("6. Searched relevant guidelines")

    # 7. LLM reasoning
    # If the LLM call fails, the exception propagates to the caller (api.py).
    # There is NO silent fallback to the deterministic proposal — the request
    # fails clearly so the API can return HTTP 500 and the frontend can show
    # an appropriate error state.
    # The deterministic engine (steps 5-6) has already run and its safety floor
    # remains authoritative whenever an LLM result IS available.
    llm_out = llm_reason(case, history, det, guidelines)
    llm_level = int(llm_out.get("llm_level", 3))
    llm_reasons = llm_out.get("reasons", [])
    llm_concerns = llm_out.get("concerns", [])
    llm_source = "llm"
    trace.append(f"7. LLM proposed level {llm_level}")

    # 8. Safety floor enforcement (code)
    res = finalize(llm_level, det)
    trace.append(f"8. Applied safety floor (floor {res['floor_level']}) -> final level {res['final_level']}")

    # 9. Routing
    trace.append(f"9. Routed to: {res['route']}")

    # 10. Output
    return {
        "follow_up": False,
        "case": case,
        "history": history,
        "det": det,
        "llm_level": llm_level,
        "llm_reasons": llm_reasons,
        "llm_concerns": llm_concerns,
        "llm_source": llm_source,
        "final_level": res["final_level"],
        "level_name": res["level_name"],
        "route": res["route"],
        "trace": trace,
    }


def format_output(result):
    if result.get("follow_up"):
        return result["message"]

    case = result["case"]
    det = result["det"]
    hist = result["history"]
    hist_line = (f"{hist['id']}: {', '.join(hist['history']) if hist['history'] else 'no known conditions'}"
                 if hist else "No record found (unknown patient)")

    flags = det["red_flags"] if det["red_flags"] else ["None"]
    floor = det["floor_level"] if det["floor_level"] is not None else "None (no red flags)"

    lines = []
    lines.append("TRIAGE RECOMMENDATION")
    lines.append(f"Level: {result['final_level']} ({result['level_name']})")
    lines.append(f"Route: {result['route']}")
    if result["llm_concerns"]:
        lines.append(f"Possible concern: {result['llm_concerns'][0]}")
    lines.append("")
    lines.append("WHY")
    lines.append(f"- Red flags: {', '.join(flags)}")
    lines.append(f"- History: {hist_line}")
    lines.append(f"- Risk score: {det['risk_score']} ({det['risk_band']}) — {', '.join(det['score_breakdown']) if det['score_breakdown'] else 'no contributing factors'}")
    lines.append(f"- Safety floor: {floor}")
    lines.append("")
    lines.append("REASONING TRACE")
    for t in result["trace"]:
        lines.append(t)
    lines.append(f"   LLM rationale: {'; '.join(result['llm_reasons'])}")
    lines.append("")
    lines.append("PHYSICIAN REVIEW")
    lines.append("Physician must confirm.")
    lines.append("")
    lines.append("DISCLAIMER")
    lines.append("This is a decision-support demonstration using synthetic data. "
                 "It is not a medical diagnosis and does not replace clinical judgment.")
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 agent.py \"free-text patient case\"")
        sys.exit(1)
    text = " ".join(sys.argv[1:])
    result = run_agent(text)
    print(format_output(result))
