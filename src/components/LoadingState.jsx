import { useEffect, useState } from 'react';
import { LOADING_STEPS } from '../services/triageApi';
import './LoadingState.css';

export default function LoadingState() {
  const [done,   setDone]   = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let idx = 0;
    function next() {
      if (idx >= LOADING_STEPS.length) return;
      const t = setTimeout(() => {
        setDone(p => [...p, idx]);
        idx++;
        setActive(idx);
        next();
      }, LOADING_STEPS[idx].duration);
      return t;
    }
    const t = next();
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="container loading-wrap anim-up" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-header">
          <div className="loading-spinner" aria-hidden="true" />
          <div>
            <h3 className="loading-title">Analysing case&hellip;</h3>
            <p  className="loading-sub">Agentic reasoning loop in progress</p>
          </div>
        </div>

        <div className="loading-flow" aria-hidden="true">
          {['Case intake','Agent reasoning','Safety check','Result'].map((n,i) => (
            <span key={n} className="flow-row">
              <span className={`flow-node ${i===1?'flow-active':''}`}>{n}</span>
              {i<3 && <span className="flow-arr">&rarr;</span>}
            </span>
          ))}
        </div>

        <div className="ls-steps" aria-label="Processing steps">
          {LOADING_STEPS.map((s,i) => {
            const isDone = done.includes(i);
            const isAct  = active === i;
            return (
              <div key={s.id} className={`ls-step ${isDone?'ls-done':''} ${isAct?'ls-act':''}`}>
                <div className="ls-icon" aria-hidden="true">
                  {isDone ? (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M1.5 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : isAct ? <div className="ls-pulse" /> : <div className="ls-dot" />}
                </div>
                <span className="ls-lbl">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
