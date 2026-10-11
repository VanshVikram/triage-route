# Red Flags (deterministic triggers)

These are hard, rule-based triggers. When any fires, the case has a safety floor
that the LLM cannot downgrade below.

## Vital sign triggers

| Condition | Floor level |
|---|---|
| SpO2 < 90 | 1 |
| SpO2 < 92 | 2 |
| Systolic BP < 90 | 2 |
| Heart rate > 130 or < 40 | 2 |
| Respiratory rate > 30 or < 8 | 2 |
| Temperature >= 40 C | 2 |

## Symptom triggers (keyword match, case-insensitive)

| Group | Example keywords | Floor level |
|---|---|---|
| Possible ACS | "chest pain", "chest pressure", "crushing", "radiating to arm/jaw" | 2 |
| Stroke (FAST) | "facial droop", "slurred speech", "arm weakness", "sudden confusion" | 2 |
| Breathing | "can't breathe", "severe shortness of breath", "choking" | 2 |
| Neuro | "seizure", "unresponsive", "loss of consciousness" | 1-2 |
| Bleeding | "heavy bleeding", "vomiting blood", "won't stop bleeding" | 2 |
| Self-harm | "suicidal", "overdose" | 2 (escalate to human immediately) |

## Escalation modifier

Chest pain **plus** (age >= 50 or diabetes or prior cardiac event) is flagged
"possible ACS", with floor level 2 and a high-priority alert.
