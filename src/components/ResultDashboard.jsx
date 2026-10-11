import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, RefreshCw, Navigation, Activity, MessageSquare } from 'lucide-react';
import { TRIAGE_META } from '../services/triageApi';
import './ResultDashboard.css';

export default function ResultDashboard({ result, onReset }) {
  if (result.needsFollowUp) return <FollowUpCard result={result} onReset={onReset} />;

  const meta = TRIAGE_META[result.triageLevel] || TRIAGE_META[3];
  const isCrit = result.triageLevel <= 2;

  return (
    <div className="rdb anim-up">
      {/* ── Banner ── */}
      <div className={`rdb-banner card ${isCrit ? 'rdb-banner-crit' : ''}`}
           style={{'--lc': meta.color, '--lb': meta.bg, '--lbdr': meta.border}}>
        <div className="banner-left">
          <div className="lvl-badge" style={{background:meta.bg, border:`2px solid ${meta.border}`, color:meta.color}}>
            <span className="lvl-num">{result.triageLevel}</span>
            <span className="lvl-icon" aria-hidden="true">{meta.icon}</span>
          </div>
          <div>
            <div className="lvl-tag" style={{color:meta.color}}>Level {result.triageLevel} &mdash; {result.triageLabel}</div>
            <div className="lvl-route">
              <Navigation size={13} aria-hidden="true" />
              {result.route}
            </div>
            {result.routeAction && (
              <span className="route-chip" style={{background:meta.bg, color:meta.color, border:`1px solid ${meta.border}`}}>
                {result.routeAction}
              </span>
            )}
          </div>
        </div>
        {result.possibleConcern && (
          <div className="banner-concern" role="note">
            <div className="concern-lbl">Possible concern <span className="unconfirmed">(unconfirmed)</span></div>
            <div className="concern-val">{result.possibleConcern}</div>
          </div>
        )}
        <button className="btn btn-ghost btn-sm banner-reset" onClick={onReset} aria-label="Start new case">
          <RefreshCw size={13}/> New Case
        </button>
      </div>

      {/* ── Two-col grid ── */}
      <div className="rdb-grid">
        {/* Left col */}
        <div className="rdb-left">
          {/* Red flags */}
          <div className="card rdb-card">
            <h4 className="rdb-section-title">Red Flags</h4>
            {result.redFlags && result.redFlags.length > 0 ? (
              <ul className="rf-list" aria-label="Detected red flags">
                {result.redFlags.map((f,i) => (
                  <li key={i} className="rf-item">
                    <span className="rf-dot" aria-hidden="true"/>
                    {typeof f==='string' ? f : f.flag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rdb-none">No red flags detected</p>
            )}
          </div>

          {/* Risk score */}
          {result.riskScore !== null && (
            <div className="card rdb-card">
              <h4 className="rdb-section-title">Risk Score</h4>
              <div className="risk-row">
                <span className="risk-num">{result.riskScore}</span>
                {result.riskCategory && (
                  <span className={`risk-band rb-${result.riskCategory?.toLowerCase()}`}>
                    {result.riskCategory}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Patient history */}
          {result.patientHistory && (
            <div className="card rdb-card">
              <h4 className="rdb-section-title">Patient History</h4>
              <div className="ph-id">{result.patientHistory.patientId}</div>
              <ul className="ph-list">
                {result.patientHistory.conditions.map((c,i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Right col — Safety floor */}
        {result.safetyFloor && (
          <SafetyFloor sf={result.safetyFloor} />
        )}
      </div>

      {/* ── Reasoning trace ── */}
      {result.reasoningTrace && result.reasoningTrace.length > 0 && (
        <TracePanel steps={result.reasoningTrace} />
      )}

      {/* ── Physician notice ── */}
      <PhysicianNotice disclaimer={result.disclaimer} />
    </div>
  );
}

/* ── Safety Floor ────────────────────────────────────────── */
function SafetyFloor({ sf }) {
  const lMeta = TRIAGE_META[sf.llmRecommended];
  const fMeta = sf.floorLevel !== null ? TRIAGE_META[sf.floorLevel] : null;
  const dMeta = TRIAGE_META[sf.finalLevel];
  const overrode = sf.triggered && sf.floorLevel !== null && sf.floorLevel < sf.llmRecommended;

  return (
    <div className="card rdb-card sf-card">
      <div className="sf-header">
        <Shield size={16} color="var(--teal-dark)" aria-hidden="true"/>
        <h4 className="rdb-section-title" style={{margin:0}}>Safety Floor</h4>
        {overrode && <span className="badge badge-teal">Floor overrode LLM</span>}
      </div>
      <p className="sf-desc">
        Final = <code>min(LLM proposal, rule-based floor)</code>.
        A lower number is more urgent — the model cannot under-escalate.
      </p>

      <div className="sf-pipeline" aria-label="Safety floor pipeline">
        {/* LLM */}
        <div className="sf-box">
          <div className="sf-box-lbl">LLM proposed</div>
          <div className="sf-box-lvl" style={{color:lMeta?.color}}>L{sf.llmRecommended}</div>
          <div className="sf-box-name" style={{color:lMeta?.color}}>{lMeta?.label}</div>
        </div>

        <div className="sf-op" aria-label="safety floor applied">
          <Shield size={18} color="var(--teal-mid)" aria-hidden="true"/>
          <span className="sf-op-lbl">Floor</span>
        </div>

        {/* Rule floor */}
        {fMeta && (
          <>
            <div className="sf-box">
              <div className="sf-box-lbl">Rule floor</div>
              <div className="sf-box-lvl" style={{color:fMeta?.color}}>L{sf.floorLevel}</div>
              <div className="sf-box-name" style={{color:fMeta?.color}}>{fMeta?.label}</div>
            </div>
            <div className="sf-equals" aria-label="equals">=</div>
          </>
        )}

        {/* Final */}
        <div className={`sf-box sf-box-final ${overrode ? 'sf-override' : ''}`}>
          <div className="sf-box-lbl">Final decision</div>
          <div className="sf-box-lvl" style={{color:dMeta?.color}}>L{sf.finalLevel}</div>
          <div className="sf-box-name" style={{color:dMeta?.color}}>{dMeta?.label}</div>
        </div>
      </div>

      {sf.triggerReason && (
        <div className="sf-trigger" role="note">
          <strong>Trigger:</strong> {sf.triggerReason}
        </div>
      )}
      {!overrode && sf.triggered && (
        <p className="sf-agree">LLM proposal and rule-based floor agree — no override applied.</p>
      )}
    </div>
  );
}

/* ── Trace ────────────────────────────────────────────────── */
function TracePanel({ steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card rdb-card trace-card">
      <button className="trace-toggle" onClick={() => setOpen(o=>!o)} aria-expanded={open} aria-controls="trace-body">
        <span className="trace-toggle-l">
          <Activity size={15} aria-hidden="true"/>
          <span className="rdb-section-title" style={{margin:0}}>Agent Reasoning Trace</span>
          <span className="badge badge-cream">{steps.length} steps</span>
        </span>
        {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      </button>
      {open && (
        <ol id="trace-body" className="trace-list anim-in" aria-label="Reasoning steps">
          {steps.map((s,i) => (
            <li key={i} className={`trace-item ${s.status==='warning'?'trace-warn':'trace-done'}`}>
              <span className="trace-n" aria-hidden="true">{i+1}</span>
              <span className="trace-t">{typeof s==='string'?s:s.step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Follow-Up ────────────────────────────────────────────── */
function FollowUpCard({ result, onReset }) {
  return (
    <div className="rdb anim-up">
      <div className="card fu-card">
        <div className="fu-icon" aria-hidden="true"><MessageSquare size={26} color="var(--teal-dark)"/></div>
        <h2 className="fu-title">More information needed</h2>
        <p className="fu-sub">The agent could not safely triage this case with the information provided.</p>
        <div className="fu-q" role="alert">{result.followUpQuestion}</div>
        <button className="btn btn-teal" onClick={onReset}><RefreshCw size={13}/> Start New Case</button>
      </div>
      <PhysicianNotice disclaimer={result.disclaimer}/>
    </div>
  );
}

/* ── Physician Notice ─────────────────────────────────────── */
function PhysicianNotice({ disclaimer }) {
  return (
    <div className="card rdb-card pn-card" role="note">
      <div className="pn-header">
        <span className="pn-icon" aria-hidden="true">&#9877;&#65039;</span>
        <h3 className="pn-title">Physician confirmation required</h3>
      </div>
      <p className="pn-text">{disclaimer}</p>
      <div className="pn-badges">
        <span className="badge badge-synth">Synthetic data only</span>
        <span className="badge badge-warn">Not for real patient use</span>
        <span className="badge badge-cream">Not a medical device</span>
      </div>
    </div>
  );
}
