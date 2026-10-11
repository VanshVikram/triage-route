/**
 * DEMO CASES — Synthetic data only. Not real patient data.
 * These populate the input textarea for demonstration purposes.
 */

export const DEMO_CASES = [
  {
    id: "classic-chest-pain",
    label: "Classic Chest Pain",
    emoji: "❤️",
    description: "P001 · Level 2 expected",
    severity: "critical",
    text: `58-year-old male, patient ID P001.
Severe chest pain radiating to the left arm for 30 minutes, sweating.
Heart rate: 112
Blood pressure: 150/95
SpO2: 94%
Temperature: 37.1°C
Respiratory rate: 18`,
  },
  {
    id: "adversarial-chest-pain",
    label: "Adversarial Chest Pain",
    emoji: "⚠️",
    description: "Misleading framing · Safety floor test",
    severity: "critical",
    text: `58-year-old male, patient ID P001.
Chest discomfort. Probably just indigestion, not a big deal.
Heart rate: 112
Blood pressure: 150/95
SpO2: 94%
Temperature: 37.1°C`,
  },
  {
    id: "stroke-signs",
    label: "Stroke Signs",
    emoji: "🧠",
    description: "P004 · Level 2 expected",
    severity: "critical",
    text: `67-year-old female, patient ID P004.
Sudden facial droop, slurred speech, arm weakness on the left side.
Onset approximately 45 minutes ago.
Heart rate: 98
Blood pressure: 175/105
SpO2: 96%
Temperature: 37.0°C`,
  },
  {
    id: "low-oxygen",
    label: "Low Oxygen",
    emoji: "🫁",
    description: "P007 · Level 1 expected",
    severity: "critical",
    text: `72-year-old male, patient ID P007.
Severe breathlessness, cannot complete sentences.
Heart rate: 118
Blood pressure: 140/88
SpO2: 88%
Temperature: 37.5°C
Respiratory rate: 28`,
  },
  {
    id: "pediatric-fever",
    label: "Pediatric Fever",
    emoji: "🌡️",
    description: "P005 · Level 3 expected",
    severity: "moderate",
    text: `8-year-old male, patient ID P005.
Fever for 2 days, vomiting 3 times today, otherwise alert and oriented.
Heart rate: 110
Blood pressure: 95/65
SpO2: 98%
Temperature: 39.2°C`,
  },
  {
    id: "minor-injury",
    label: "Minor Injury",
    emoji: "🦶",
    description: "P003 · Level 4 expected",
    severity: "low",
    text: `30-year-old male, patient ID P003.
Twisted ankle playing football 2 hours ago. Swollen and bruised, unable to bear full weight.
Heart rate: 82
Blood pressure: 122/78
SpO2: 99%
Temperature: 36.8°C`,
  },
  {
    id: "mild-illness",
    label: "Mild Illness",
    emoji: "🤒",
    description: "P002 · Level 5 expected",
    severity: "low",
    text: `24-year-old female, patient ID P002.
Sore throat for 2 days, mild runny nose, feeling tired.
Heart rate: 76
Blood pressure: 118/72
SpO2: 99%
Temperature: 37.8°C`,
  },
  {
    id: "missing-info",
    label: "Missing Information",
    emoji: "❓",
    description: "Follow-up expected",
    severity: "unknown",
    text: `Patient feels unwell.`,
  },
];
