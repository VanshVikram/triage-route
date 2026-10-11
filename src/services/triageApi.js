// =============================================================================
// TRIAGE API SERVICE
// =============================================================================
// This is the ONLY file that communicates with the backend.
//
// BACKEND: FastAPI server at API_BASE_URL (default: http://127.0.0.1:8000)
// ENDPOINT: POST /triage  { caseText: "free-text synthetic patient case" }
//
// To change the backend URL without touching code, set:
//   VITE_TRIAGE_API_URL=https://your-deployed-api.onrender.com
// in a .env file at the project root.
//
// The flow is:
//   CaseInput → App.jsx → analyzeCase() → FastAPI /triage → mapBackendResponse() → ResultDashboard
//
// 100% synthetic data. NOT a medical device. No LLM keys in this file.
// =============================================================================

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
// Reads from .env (VITE_TRIAGE_API_URL=...) — falls back to local dev server.
const API_BASE_URL =
  import.meta.env.VITE_TRIAGE_API_URL || "http://127.0.0.1:8000";

// ─── RESPONSE SHAPE (what the UI components consume) ─────────────────────────
/**
 * @typedef {Object} PatientHistory
 * @property {string} patientId
 * @property {string[]} conditions
 */

/**
 * @typedef {Object} SafetyFloorDetail
 * @property {number} llmRecommended   - What the LLM initially proposed
 * @property {number|null} floorLevel  - Deterministic rule-based floor
 * @property {number} finalLevel       - min(llmRecommended, floorLevel)
 * @property {boolean} triggered       - Whether the floor was activated
 * @property {string|null} triggerReason
 */

/**
 * @typedef {Object} RedFlag
 * @property {string} flag
 * @property {string|null} detail
 */

/**
 * @typedef {Object} TraceStep
 * @property {string} step
 * @property {string|null} detail
 * @property {"done"|"warning"} status
 */

/**
 * @typedef {Object} TriageResponse
 * @property {number|null} triageLevel       - 1–5 (1 = most urgent); null if follow-up needed
 * @property {string|null} triageLabel       - e.g. "Emergent"
 * @property {string|null} route             - Routing recommendation text
 * @property {string|null} routeAction       - e.g. "Front of queue"
 * @property {string|null} possibleConcern   - e.g. "Possible ACS (unconfirmed)"
 * @property {RedFlag[]} redFlags
 * @property {number|null} riskScore
 * @property {string|null} riskCategory      - "Low" | "Moderate" | "High"
 * @property {SafetyFloorDetail|null} safetyFloor
 * @property {PatientHistory|null} patientHistory
 * @property {TraceStep[]} reasoningTrace
 * @property {boolean} physicianRequired     - Always true
 * @property {string} disclaimer
 * @property {boolean} needsFollowUp
 * @property {string|null} followUpQuestion
 */

// ─── LOADING STEPS (purely cosmetic — used by LoadingState.jsx) ───────────────
// These represent the agent's workflow visually. They do NOT execute any logic.
export const LOADING_STEPS = [
  { id: "receive",   label: "Case received",                duration: 400 },
  { id: "extract",   label: "Extracting structured details", duration: 700 },
  { id: "history",   label: "Retrieving patient history",    duration: 600 },
  { id: "redflags",  label: "Evaluating red flags",          duration: 800 },
  { id: "score",     label: "Computing risk score",          duration: 500 },
  { id: "guidelines",label: "Searching triage guidelines",   duration: 900 },
  { id: "recommend", label: "Generating recommendation",     duration: 1000},
  { id: "floor",     label: "Applying safety floor",         duration: 600 },
  { id: "route",     label: "Determining route",             duration: 400 },
];

// ─── RESPONSE MAPPER ─────────────────────────────────────────────────────────
/**
 * mapBackendResponse — converts the FastAPI/agent.py response shape into the
 * UI component's expected TriageResponse shape.
 *
 * Backend shape (from agent.py → run_agent()):
 *   { follow_up, message?, case, history, det, llm_level, llm_reasons,
 *     llm_concerns, llm_source, final_level, level_name, route, trace }
 *
 * @param {Object} data - Raw JSON from POST /triage
 * @returns {TriageResponse}
 */
function mapBackendResponse(data) {
  // ── Follow-up / missing-info path ──────────────────────────────────────────
  if (data.follow_up) {
    return {
      triageLevel: null,
      triageLabel: null,
      route: null,
      routeAction: null,
      possibleConcern: null,
      redFlags: [],
      riskScore: null,
      riskCategory: null,
      safetyFloor: null,
      patientHistory: null,
      reasoningTrace: mapTrace(data.trace || []),
      physicianRequired: true,
      disclaimer: DISCLAIMER,
      needsFollowUp: true,
      followUpQuestion: data.message || null,
    };
  }

  // ── Normal triage result path ──────────────────────────────────────────────
  const det = data.det || {};

  // Route: extract "(front of queue)" style suffix as routeAction
  const { routeMain, routeAction } = splitRoute(data.route || "");

  // Red flags: backend returns string[] — map to RedFlag[]
  const redFlags = (det.red_flags || []).map((f) => ({ flag: f, detail: null }));

  // Possible concern: first LLM concern, or first ACS flag if present
  const possibleConcern =
    (data.llm_concerns && data.llm_concerns.length > 0)
      ? data.llm_concerns[0]
      : det.acs_alert
        ? "Possible ACS (unconfirmed)"
        : null;

  // Safety floor
  const floorLevel = det.floor_level ?? null;
  const safetyFloor = {
    llmRecommended: data.llm_level ?? data.final_level,
    floorLevel: floorLevel,
    finalLevel: data.final_level,
    triggered: floorLevel !== null,
    triggerReason:
      floorLevel !== null && det.red_flags && det.red_flags.length > 0
        ? det.red_flags.join(", ")
        : null,
  };

  // Patient history
  const patientHistory =
    data.history
      ? {
          patientId: data.history.id || data.case?.patient_id || "Unknown",
          conditions:
            Array.isArray(data.history.history) && data.history.history.length > 0
              ? data.history.history
              : ["No known conditions"],
        }
      : null;

  return {
    triageLevel: data.final_level ?? null,
    triageLabel: data.level_name ?? null,
    route: routeMain,
    routeAction: routeAction,
    possibleConcern,
    redFlags,
    riskScore: det.risk_score ?? null,
    riskCategory: det.risk_band ?? null,
    safetyFloor,
    patientHistory,
    reasoningTrace: mapTrace(data.trace || []),
    physicianRequired: true,
    disclaimer: DISCLAIMER,
    needsFollowUp: false,
    followUpQuestion: null,
  };
}

/** Split "Emergency department, immediate assessment (front of queue)"
 *  → { routeMain: "Emergency department, immediate assessment",
 *      routeAction: "Front of queue" }
 */
function splitRoute(route) {
  const m = route.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return {
      routeMain: m[1].trim(),
      routeAction: m[2].charAt(0).toUpperCase() + m[2].slice(1),
    };
  }
  return { routeMain: route, routeAction: null };
}

/** Convert the agent's string trace array into TraceStep objects for the UI. */
function mapTrace(traceArray) {
  return traceArray.map((entry) => {
    const raw = typeof entry === "string" ? entry : entry.step || "";
    // Detect indented/warning lines (agent prefixes them with spaces or "   ")
    const isWarning = raw.startsWith("   ") || raw.startsWith("\t");
    // Strip leading step numbers like "1. " or "   ("
    const step = raw.replace(/^\s*\d+\.\s*/, "").replace(/^\s+/, "").trim();
    return {
      step,
      detail: null,
      status: isWarning ? "warning" : "done",
    };
  });
}

const DISCLAIMER =
  "This prototype provides decision support only. It is not a medical diagnosis " +
  "or treatment recommendation. Physician confirmation is mandatory before any clinical action. " +
  "100% synthetic data — not for real patient use.";

// ─── REAL API CALL ────────────────────────────────────────────────────────────
/**
 * callRealAPI — sends the patient case to the FastAPI backend and returns
 * a mapped TriageResponse ready for the UI.
 *
 * @param {string} caseText
 * @returns {Promise<TriageResponse>}
 * @throws {Error} on network failure or non-2xx HTTP response
 */
async function callRealAPI(caseText) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseText }),
    });
  } catch (networkError) {
    // fetch() itself threw — server is unreachable
    throw new Error(
      `Cannot reach the Triage & Route backend at ${API_BASE_URL}. ` +
        "Make sure the FastAPI server is running (python -m uvicorn api:app --port 8000)."
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        detail =
          typeof errBody.detail === "string"
            ? errBody.detail
            : JSON.stringify(errBody.detail);
      }
    } catch (_) {
      // ignore JSON parse failure on error body
    }
    throw new Error(`Backend error: ${detail}`);
  }

  const data = await response.json();
  return mapBackendResponse(data);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
/**
 * analyzeCase — the single entry point called by App.jsx.
 *
 * Sends caseText to the real FastAPI backend.
 * If the backend is unreachable, throws an Error (displayed by the existing
 * error state in App.jsx — no silent fallback to mock data).
 *
 * @param {string} caseText — Free-text synthetic patient case
 * @returns {Promise<TriageResponse>}
 */
export async function analyzeCase(caseText) {
  return callRealAPI(caseText);
}

// ─── TRIAGE LEVEL METADATA (used by ResultDashboard.jsx for colours/icons) ───
export const TRIAGE_META = {
  1: { label: "Resuscitation", color: "#dc2626", bg: "#fef2f2", badge: "#fee2e2", border: "#fca5a5", icon: "🚨" },
  2: { label: "Emergent",      color: "#ea580c", bg: "#fff7ed", badge: "#ffedd5", border: "#fdba74", icon: "⚡" },
  3: { label: "Urgent",        color: "#ca8a04", bg: "#fefce8", badge: "#fef9c3", border: "#fde047", icon: "⚠️" },
  4: { label: "Less Urgent",   color: "#2563eb", bg: "#eff6ff", badge: "#dbeafe", border: "#93c5fd", icon: "ℹ️" },
  5: { label: "Non-Urgent",    color: "#16a34a", bg: "#f0fdf4", badge: "#dcfce7", border: "#86efac", icon: "✅" },
};

// ─── MOCK DATA (kept for reference only — NOT used in any live code path) ─────
// The mock is intentionally not exported and not called.
// It is preserved here solely as a reference for the expected response shape
// and for offline UI development if ever needed again.
//
// To re-enable: change analyzeCase() to call _mockAnalyzeCase() and add the
// simulateDelay helper back. Do NOT do this in production.
//
// const _MOCK_RESPONSE = { ... }  // removed from active code path
