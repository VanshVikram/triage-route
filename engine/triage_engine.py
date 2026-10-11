"""
Triage & Route — deterministic safety engine (MVP).

Course/hackathon prototype. 100% synthetic data. NOT a medical device.
The rules below are the PRD's exact deterministic rules (§10.3, §10.4, §10.5).
The LLM can propose a level, but it can NEVER de-escalate below floor_level.
"""

import re

# ---------------------------------------------------------------------------
# Triage levels & routing map (PRD §10.1, §10.2)
# ---------------------------------------------------------------------------
LEVEL_NAMES = {
    1: "Resuscitation",
    2: "Emergent",
    3: "Urgent",
    4: "Less urgent",
    5: "Non-urgent",
}

ROUTES = {
    1: "Resuscitation bay / call emergency services immediately",
    2: "Emergency department, immediate assessment (front of queue)",
    3: "Emergency department, standard queue",
    4: "Urgent care / same-day clinic",
    5: "GP appointment / self-care advice",
}

# ---------------------------------------------------------------------------
# Red-flag rules (PRD §10.3) — deterministic, keyword + vital based
# ---------------------------------------------------------------------------
SYMPTOM_GROUPS = {
    "Possible ACS": {
        "keywords": ["chest pain", "chest pressure", "chest discomfort", "chest tightness", "crushing", "radiating to"],
        "floor": 2,
    },
    "Stroke signs": {
        "keywords": ["facial droop", "slurred speech", "arm weakness", "sudden confusion"],
        "floor": 2,
    },
    "Breathing emergency": {
        "keywords": ["can't breathe", "cannot breathe", "severe shortness of breath", "choking"],
        "floor": 2,
    },
    "Neuro emergency": {
        "keywords": ["seizure", "unresponsive", "loss of consciousness"],
        "floor": 1,  # unresponsive / LOC is level 1 territory
    },
    "Major bleeding": {
        "keywords": ["heavy bleeding", "vomiting blood", "won't stop bleeding"],
        "floor": 2,
    },
    "Self-harm risk": {
        "keywords": ["suicidal", "overdose"],
        "floor": 2,
    },
}

# Escalation modifier (PRD §10.3): chest pain + (age>=50 or diabetes or prior cardiac event)
# -> "possible ACS", floor 2, high-priority alert.
ACS_RISK_HISTORY_KEYWORDS = ["mi", "heart attack", "cardiac", "stent", "bypass"]


def _has_acs_risk(age, history):
    if age is not None and age >= 50:
        return True
    hist = [h.lower() for h in (history or [])]
    if any("diabetes" in h for h in hist):
        return True
    if any(k in h for h in hist for k in ACS_RISK_HISTORY_KEYWORDS):
        return True
    return False


def red_flag_check(case):
    """Return (flags, floor_level, acs_alert). Lower floor = more urgent."""
    s = (case.get("symptoms_text") or "").lower()
    v = case.get("vitals") or {}
    age = case.get("age")
    history = case.get("history") or []

    flags = []
    floor = None

    def escalate(level, reason):
        nonlocal floor
        flags.append(reason)
        floor = level if floor is None else min(floor, level)

    # --- Vital sign triggers ---
    if v.get("spo2") is not None:
        if v["spo2"] < 90:
            escalate(1, "SpO2 < 90")
        elif v["spo2"] < 92:
            escalate(2, "SpO2 < 92")
    if v.get("sbp") is not None and v["sbp"] < 90:
        escalate(2, "Systolic BP < 90")
    if v.get("hr") is not None and (v["hr"] > 130 or v["hr"] < 40):
        escalate(2, "Extreme heart rate")
    if v.get("rr") is not None and (v["rr"] > 30 or v["rr"] < 8):
        escalate(2, "Extreme respiratory rate")
    if v.get("temp_c") is not None and v["temp_c"] >= 40:
        escalate(2, "Temp >= 40C")

    # --- Symptom triggers (keyword match, case-insensitive) ---
    for name, spec in SYMPTOM_GROUPS.items():
        if any(w in s for w in spec["keywords"]):
            escalate(spec["floor"], name)

    # --- Escalation modifier: possible ACS ---
    acs_alert = False
    if any(w in s for w in SYMPTOM_GROUPS["Possible ACS"]["keywords"]):
        if _has_acs_risk(age, history):
            acs_alert = True
            escalate(2, "Possible ACS (chest pain + risk factors)")

    return {"flags": flags, "floor_level": floor, "acs_alert": acs_alert}


# ---------------------------------------------------------------------------
# Risk score (PRD §10.4) — transparent point system
# ---------------------------------------------------------------------------
def risk_score(case):
    v = case.get("vitals") or {}
    age = case.get("age")
    history = [h.lower() for h in (case.get("history") or [])]

    score = 0
    parts = []

    def add(pts, label):
        nonlocal score
        score += pts
        parts.append(f"{label} +{pts}")

    if age is not None:
        if age >= 65:
            add(2, "age>=65")
        elif age >= 50:
            add(1, "age 50-64")
    if any("diabetes" in h for h in history):
        add(1, "diabetes")
    if any(k in h for h in history for k in ACS_RISK_HISTORY_KEYWORDS):
        add(2, "prior cardiac event")
    if any("hypertension" in h for h in history):
        add(1, "hypertension")
    if v.get("hr") is not None and v["hr"] > 100:
        add(1, "HR>100")
    if v.get("spo2") is not None and 92 <= v["spo2"] <= 94:
        add(1, "SpO2 92-94")
    if v.get("temp_c") is not None and v["temp_c"] >= 38.5:
        add(1, "temp>=38.5")

    band = "High" if score >= 4 else "Moderate" if score >= 2 else "Low"
    return {"risk_score": score, "risk_band": band, "score_breakdown": parts}


# ---------------------------------------------------------------------------
# Safety floor (PRD §10.5) — the key guarantee
#   final_level = min(llm_level, floor_level)   # lower = more urgent
#   if no red flags: final_level = llm_level
# ---------------------------------------------------------------------------
def apply_floor(llm_level, floor_level):
    if floor_level is None:
        return llm_level
    return min(llm_level, floor_level)


# ---------------------------------------------------------------------------
# Structured extraction (PRD §11.2) — null for anything not stated, never invent
# ---------------------------------------------------------------------------
def extract_case(text):
    """Parse free-text case into structured JSON. Missing -> None. Never guesses."""
    t = text or ""
    case = {
        "patient_id": None,
        "age": None,
        "sex": None,
        "symptoms_text": None,
        "duration": None,
        "vitals": {"hr": None, "sbp": None, "dbp": None, "spo2": None, "temp_c": None, "rr": None},
    }

    # patient ID
    m = re.search(r"\bP\d{3}\b", t, re.IGNORECASE)
    if m:
        case["patient_id"] = m.group(0).upper()

    # age
    m = re.search(r"(\d{1,3})\s*-?\s*year", t, re.IGNORECASE)
    if m:
        case["age"] = int(m.group(1))

    # sex
    m = re.search(r"\b(male|female|man|woman|boy|girl|m|f)\b", t, re.IGNORECASE)
    if m:
        raw = m.group(1).lower()
        case["sex"] = "M" if raw in ("male", "man", "boy", "m") else "F"

    # vitals
    m = re.search(r"hr\s*[=:]?\s*(\d{2,3})", t, re.IGNORECASE)
    if m:
        case["vitals"]["hr"] = int(m.group(1))
    m = re.search(r"bp\s*[=:]?\s*(\d{2,3})\s*/\s*(\d{2,3})", t, re.IGNORECASE)
    if m:
        case["vitals"]["sbp"] = int(m.group(1))
        case["vitals"]["dbp"] = int(m.group(2))
    m = re.search(r"spo2\s*[=:]?\s*(\d{2,3})", t, re.IGNORECASE)
    if m:
        case["vitals"]["spo2"] = int(m.group(1))
    m = re.search(r"temp(?:erature)?\s*[=:]?\s*([\d.]+)", t, re.IGNORECASE)
    if m:
        case["vitals"]["temp_c"] = float(m.group(1).rstrip("."))
    m = re.search(r"rr\s*[=:]?\s*(\d{1,3})", t, re.IGNORECASE)
    if m:
        case["vitals"]["rr"] = int(m.group(1))

    # duration
    m = re.search(r"for\s+([\w\s]+?)(?:\.|,|$)", t, re.IGNORECASE)
    if m:
        case["duration"] = m.group(1).strip()

    # symptoms: strip the structured bits, keep the descriptive text
    cleaned = re.sub(r"\bP\d{3}\b", "", t, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\d{1,3}\s*-?\s*year", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(male|female|man|woman|boy|girl)\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"hr\s*[=:]?\s*\d{2,3}", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"bp\s*[=:]?\s*\d{2,3}\s*/\s*\d{2,3}", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"spo2\s*[=:]?\s*\d{2,3}", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"temp(?:erature)?\s*[=:]?\s*[\d.]+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"rr\s*[=:]?\s*\d{1,3}", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,;:-")
    case["symptoms_text"] = cleaned if cleaned else None

    return case


# ---------------------------------------------------------------------------
# Missing-information gate (PRD FR11): no meaningful symptoms AND no vitals
# ---------------------------------------------------------------------------
def is_missing_info(case):
    s = (case.get("symptoms_text") or "").strip()
    v = case.get("vitals") or {}
    has_vitals = any(v.get(k) is not None for k in ("hr", "sbp", "spo2", "temp_c", "rr"))
    has_symptoms = len(s.split()) >= 5  # "fewer than 5 words" -> ask
    return (not has_vitals) and (not has_symptoms)


# ---------------------------------------------------------------------------
# Full deterministic pipeline (used by the agent and by the test harness)
# ---------------------------------------------------------------------------
def run_deterministic(case):
    red = red_flag_check(case)
    risk = risk_score(case)
    return {
        "red_flags": red["flags"],
        "floor_level": red["floor_level"],
        "acs_alert": red["acs_alert"],
        "risk_score": risk["risk_score"],
        "risk_band": risk["risk_band"],
        "score_breakdown": risk["score_breakdown"],
    }


def finalize(llm_level, det):
    """Apply safety floor and map to route."""
    floor = det["floor_level"]
    final_level = apply_floor(llm_level, floor)
    return {
        "llm_level": llm_level,
        "floor_level": floor,
        "final_level": final_level,
        "level_name": LEVEL_NAMES[final_level],
        "route": ROUTES[final_level],
    }
