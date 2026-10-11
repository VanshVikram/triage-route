import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { DEMO_CASES } from '../data/demoCases';
import './CaseInput.css';

const PLACEHOLDER = `Example: 58-year-old male, patient ID P001.
Chest pain crushing and radiating to left arm — onset 30 minutes ago. Diaphoresis.
HR 112 bpm  |  BP 150/95 mmHg  |  SpO2 94%  |  Temp 37.1°C  |  RR 18`;

const GROUPS = [
  { key:'critical', label:'High Acuity',  cls:'g-crit' },
  { key:'moderate', label:'Moderate',     cls:'g-mod'  },
  { key:'low',      label:'Low Acuity',   cls:'g-low'  },
  { key:'unknown',  label:'Other',        cls:'g-unk'  },
];

export default function CaseInput({ onAnalyze, isLoading }) {
  const [text, setText] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onAnalyze(text.trim());
  }

  const canSubmit = text.trim().length > 0 && !isLoading;

  return (
    <section className="case-section" aria-label="Case analysis workspace">
      {/* Section heading */}
      <div className="container case-section-header">
        <div className="case-heading-block">
          <p className="eyebrow">Case Analysis</p>
          <h2 className="case-h2">Analyse a synthetic case</h2>
          <p className="case-intro">
            Enter any free-text synthetic patient case — include symptoms, age, vital signs
            and a patient ID if you want history lookup. Or choose a demo case below.
          </p>
        </div>
      </div>

      <div className="container case-workspace">
        {/* Main input */}
        <div className="input-col">
          <div className="card input-card">
            <div className="input-card-header">
              <h3 className="input-card-title">Patient case</h3>
              <span className="badge badge-synth">Synthetic only</span>
            </div>

            <form onSubmit={submit} noValidate>
              <label className="sr-only" htmlFor="case-textarea">Patient case free text</label>
              <div className="textarea-wrap">
                <textarea
                  id="case-textarea"
                  className="case-ta"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={9}
                  disabled={isLoading}
                  aria-describedby="case-hint"
                />
                {text && (
                  <button type="button" className="ta-clear" onClick={() => setText('')} aria-label="Clear input">
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="input-footer">
                <span id="case-hint" className="char-hint">
                  {text.length > 0 ? `${text.length} characters` : 'Enter or paste a patient case above'}
                </span>
                <div className="input-btns">
                  {text && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setText('')}>Clear</button>
                  )}
                  <button
                    type="submit" id="analyze-case-btn"
                    className="btn btn-teal"
                    disabled={!canSubmit} aria-busy={isLoading}
                  >
                    <Send size={15} aria-hidden="true" />
                    {isLoading ? 'Analysing…' : 'Analyse Case'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Demo cases */}
          <div className="demo-panel card">
            <div className="demo-panel-header">
              <h3 className="demo-panel-title">Synthetic demo cases</h3>
              <p className="demo-panel-hint">Select to load into input &mdash; results come from the real backend.</p>
            </div>
            <div className="demo-groups">
              {GROUPS.map(g => {
                const cases = DEMO_CASES.filter(c => c.severity === g.key);
                if (!cases.length) return null;
                return (
                  <div key={g.key} className="demo-group">
                    <span className={`demo-group-lbl ${g.cls}`}>{g.label}</span>
                    <div className="demo-tiles">
                      {cases.map(c => (
                        <button key={c.id} className={`demo-tile ${g.cls}`}
                          onClick={() => setText(c.text)}
                          aria-label={`Load: ${c.label}`}>
                          <span className="tile-emoji" aria-hidden="true">{c.emoji}</span>
                          <span className="tile-info">
                            <strong className="tile-name">{c.label}</strong>
                            <small  className="tile-desc">{c.description}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* How it works sidebar */}
        <aside className="how-sidebar card" aria-label="How the assessment works" id="approach-sidebar">
          <h3 className="how-title">How it works</h3>
          <ol className="how-list">
            {[
              ['Patient history','The agent searches the knowledge base for any record matching the patient ID.'],
              ['Red-flag detection','Rule-based code checks vital signs and keywords. Each matched rule raises the risk score.'],
              ['LLM reasoning','Gemini receives the case, history, flags and guidelines — then proposes a triage level.'],
              ['Safety floor','Final level = min(LLM, rule floor). The model cannot under-escalate a flagged case.'],
            ].map(([h,b],i) => (
              <li key={i} className="how-item">
                <span className="how-num" aria-hidden="true">{i+1}</span>
                <div>
                  <strong className="how-head">{h}</strong>
                  <p className="how-body">{b}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="how-footer">
            All outputs require physician confirmation. Synthetic data only.
          </p>
        </aside>
      </div>
    </section>
  );
}
