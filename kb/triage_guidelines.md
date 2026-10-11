# Triage Guidelines (simplified, ESI-style)

Decision-support demonstration. Synthetic data only. Not a medical device.

## 5-level triage scale

| Level | Name | Meaning | Example |
|---|---|---|---|
| 1 | Resuscitation | Immediate life-saving intervention | Not breathing, unresponsive, severe shock |
| 2 | Emergent | High-risk, should not wait | Chest pain with risk factors, stroke signs, severe breathing difficulty |
| 3 | Urgent | Stable but needs multiple resources | Abdominal pain, high fever with vomiting |
| 4 | Less urgent | One resource needed | Ankle injury needing an X-ray, minor laceration |
| 5 | Non-urgent | No resources needed | Mild sore throat, minor rash |

## Routing map

| Final level | Route | Queue action |
|---|---|---|
| 1 | Resuscitation bay / call emergency services immediately | Immediate, drop everything |
| 2 | Emergency department, immediate assessment | Front of the queue |
| 3 | Emergency department, standard queue | Seen in order of arrival and urgency |
| 4 | Urgent care / same-day clinic | Fast-track |
| 5 | GP appointment / self-care advice | Non-urgent |

## Core rules

- **When in doubt, escalate.** Over-triage is acceptable; under-triage is not.
- The deterministic safety floor is authoritative. The LLM may raise urgency but can never lower it below the rule-based floor.
- Never claim a confirmed diagnosis. Use "possible" or "consistent with".
- A physician always makes the final decision.
