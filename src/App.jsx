import { useState, useRef } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ApproachSection from './components/ApproachSection';
import CaseInput from './components/CaseInput';
import LoadingState from './components/LoadingState';
import ResultDashboard from './components/ResultDashboard';
import { analyzeCase } from './services/triageApi';
import './App.css';

const S = { IDLE:'idle', LOADING:'loading', RESULT:'result', ERROR:'error' };

export default function App() {
  const [state, setState] = useState(S.IDLE);
  const [result, setResult] = useState(null);
  const [error,  setError]  = useState(null);
  const caseRef = useRef(null);
  const resultRef = useRef(null);

  function scrollToCase() {
    caseRef.current?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  async function handleAnalyze(caseText) {
    setState(S.LOADING); setResult(null); setError(null);
    try {
      const r = await analyzeCase(caseText);
      setResult(r); setState(S.RESULT);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
    } catch(err) {
      setError(err.message || 'Unknown error'); setState(S.ERROR);
    }
  }

  function handleReset() {
    setState(S.IDLE); setResult(null); setError(null);
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  const isLoading = state === S.LOADING;

  return (
    <div className="app-wrap">
      <Header onAnalyseClick={scrollToCase} />

      <main className="main-content" role="main">
        <HeroSection onAnalyseClick={scrollToCase} />
        <ApproachSection />

        {/* Case analysis workspace */}
        <div ref={caseRef} id="case-analysis">
          {state !== S.RESULT && (
            <CaseInput onAnalyze={handleAnalyze} isLoading={isLoading} />
          )}
          {state === S.LOADING && <LoadingState />}
          {state === S.ERROR && (
            <div className="container section-gap">
              <div className="card error-card anim-up" role="alert">
                <div className="error-icon" aria-hidden="true">&#9888;&#65039;</div>
                <h2 className="error-title">Analysis failed</h2>
                <p className="error-msg">{error}</p>
                <button className="btn btn-teal" onClick={handleReset}>Try Again</button>
              </div>
            </div>
          )}
          {state === S.RESULT && result && (
            <section ref={resultRef} className="container section-gap" style={{paddingBottom:'80px'}} aria-label="Triage result">
              <div className="result-header">
                <div>
                  <h2 className="result-header-title">Triage Recommendation</h2>
                  <p className="result-header-sub">Agentic reasoning complete &middot; Synthetic data only &middot; Physician confirmation required</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleReset}>&larr; New Case</button>
              </div>
              <ResultDashboard result={result} onReset={handleReset} />
            </section>
          )}
        </div>
      </main>

      <footer className="app-footer" role="contentinfo">
        <div className="footer-inner">
          <span className="footer-brand">Triage &amp; Route</span>
          <span className="footer-div">&middot;</span>
          <span>Prototype &mdash; Synthetic Data Only</span>
          <span className="footer-div">&middot;</span>
          <span>Not a medical device</span>
          <span className="footer-div">&middot;</span>
          <span>Not for real patient use</span>
        </div>
      </footer>
    </div>
  );
}
