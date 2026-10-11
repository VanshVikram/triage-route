# Triage & Route — Agentic Triage and Diagnostic Support Assistant

An AI-assisted triage and routing prototype that combines LLM-based reasoning with deterministic safety rules to help prioritize **synthetic patient cases** and recommend appropriate care pathways.

> **Disclaimer:** This is an educational prototype built exclusively for synthetic data. It is not a medical device, is not clinically validated, and must not be used for real patients or actual medical decisions.

## Overview

Triage & Route explores how AI reasoning can be combined with rule-based safety checks to produce structured, explainable triage recommendations.

The system accepts a free-text patient scenario, analyzes relevant information, checks for potential red flags, calculates a deterministic safety level, and generates a structured recommendation with a suggested care route.

The project emphasizes safety-aware AI design, transparent outputs, and human review rather than relying on an LLM alone.

## Key Features

- **Natural-language case input:** Analyze a patient scenario written in plain English.
- **LLM-assisted reasoning:** Use a configured Gemini model to interpret the case and produce structured triage reasoning.
- **Deterministic safety checks:** Apply predefined rules to identify potential red flags and establish a safety floor.
- **Safety-floor enforcement:** Prevent the LLM from assigning a less urgent final triage level than the deterministic safety rules require.
- **Synthetic patient history:** Use a local dataset of fictional patient records to demonstrate history lookup.
- **Care routing:** Generate a suggested care pathway based on the resulting triage level.
- **Structured results:** Present triage level, risk information, red flags, and routing recommendations in a web interface.
- **Human-in-the-loop approach:** Treat AI-generated results as decision-support suggestions requiring human review.

## How It Works

1. **Case submission:** The user enters a synthetic patient scenario through the React frontend.
2. **API request:** The frontend sends the case to the FastAPI backend.
3. **Information processing:** The backend extracts relevant information and checks the available synthetic patient history.
4. **Rule-based assessment:** The triage engine evaluates configured red flags and determines a safety floor.
5. **LLM reasoning:** The configured Gemini model analyzes the case and generates a proposed triage assessment.
6. **Safety enforcement:** The system combines the LLM's proposed level with the deterministic safety floor.
7. **Result presentation:** The frontend displays the resulting triage assessment and recommended care route.

### Safety-floor logic

The system uses the following rule:

`final_level = min(llm_level, floor_level)`

Triage levels range from **1 (most urgent)** to **5 (least urgent)**. Therefore, a lower numerical level represents greater urgency.

The final level cannot be less urgent than the deterministic safety floor. This is a design safeguard, not a guarantee of clinical safety or correctness.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend API | Python, FastAPI |
| AI reasoning | Gemini model through a configurable API endpoint |
| Backend server | Uvicorn |
| Data and knowledge base | JSON and Markdown |
| Version control | Git and GitHub |

## Project Structure

```text
triage-route/
├── api.py                    # FastAPI application and API endpoints
├── agent.py                  # Agent and LLM integration
├── engine/
│   └── triage_engine.py      # Deterministic triage and safety logic
├── kb/
│   ├── patients.json         # Synthetic patient records
│   ├── red_flags.md          # Red-flag reference rules
│   ├── triage_guidelines.md  # Triage guidance
│   └── disclaimer.md         # Safety disclaimer
├── src/
│   ├── components/           # React UI components
│   ├── data/                 # Demo cases
│   ├── services/             # Frontend API integration
│   ├── App.jsx               # Main application
│   └── main.jsx              # Frontend entry point
├── public/                   # Static assets
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
├── requirements.txt
├── vite.config.js
└── README.md
```

## Prerequisites

Install the following before running the project:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) and npm
- [Python](https://www.python.org/) (a version compatible with the project's dependencies)
- A Gemini API key with access to the configured model

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/VanshVikram/triage-route.git
cd triage-route
```

### 2. Configure the environment

Create a local `.env` file in the project root using `.env.example` as a template.

For example, the backend configuration may include:

```env
LLM_API_KEY=your_gemini_api_key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=your_configured_gemini_model
```

Use the model name supported by your API account and the existing project configuration. Do not replace working configuration values without checking the backend code.

**API key note:** Each developer should use an authorized API key. Do not commit real credentials to a public repository.

### 3. Install backend dependencies

Open a terminal in the project root and run:

```bash
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

Then install the dependencies:

```bash
pip install -r requirements.txt
```

### 4. Start the backend

From the project root, run:

```bash
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Keep this terminal open.

Check the health endpoint by opening:

http://127.0.0.1:8000/health

### 5. Install frontend dependencies

Open a second terminal in the project root:

```bash
npm install
```

### 6. Start the frontend

Run:

```bash
npm run dev
```

Open the local URL printed in the terminal, usually:

http://localhost:5173

Keep both the backend and frontend running while testing the application.

## API Overview

The backend exposes the following core endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check whether the backend is running |
| `POST` | `/triage` | Submit a case for triage analysis |

The `/triage` endpoint expects a case payload in the format implemented by the backend. Refer to `src/services/triageApi.js` and `api.py` for the exact request and response schemas.

Interactive API documentation may be available at:

http://127.0.0.1:8000/docs

## Working With the Team

To contribute:

1. Clone the repository.
2. Create and configure your local environment.
3. Install frontend and backend dependencies.
4. Create a feature branch before making changes.
5. Test your changes locally.
6. Commit your changes and open a pull request.

Example:

```bash
git checkout -b feature/your-feature
git add .
git commit -m "Describe your changes"
git push -u origin feature/your-feature
```

Coordinate changes to the triage engine, safety rules, API contracts, and environment configuration with the team.

## Limitations

- The project is a prototype and has not undergone clinical validation.
- Rule-based checks and text extraction may miss relevant information or produce false positives.
- LLM outputs can be inaccurate, incomplete, or inconsistent.
- The quality of the output depends on the configured model, input information, and implemented rules.
- Synthetic records and demonstration cases do not represent validated medical data.
- The safety floor reduces one specific class of unsafe downgrade but does not eliminate other failure modes.

## Future Improvements

Potential areas for further development include:

- Automated tests for safety rules and API behavior.
- Broader evaluation using carefully designed synthetic test cases.
- Improved input validation and structured information extraction.
- Better observability, error handling, and audit logs.
- Evaluation of LLM consistency and safety-floor behavior.
- Improved deployment configuration and team development workflows.

## Ethical Use and Disclaimer

This project is intended for educational, research, and software engineering demonstration purposes only.

It must not be used to diagnose, treat, or triage real patients. All demonstrated patient data must remain synthetic. Any future clinical application would require appropriate clinical expertise, validation, privacy safeguards, regulatory review, and other applicable safety measures.

## Contributors

Developed collaboratively as an AI-assisted triage and routing prototype.

Contributions, feedback, and suggestions are welcome.

---

**Repository:** [VanshVikram/triage-route](https://github.com/VanshVikram/triage-route)
