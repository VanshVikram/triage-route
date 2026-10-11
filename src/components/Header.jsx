import { Activity } from 'lucide-react';
import './Header.css';

export default function Header({ onAnalyseClick }) {
  return (
    <header className="site-header" role="banner">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="Triage & Route home">
          <div className="brand-icon" aria-hidden="true">
            <Activity size={15} strokeWidth={2.5} color="#062F30" />
          </div>
          <div className="brand-text">
            <span className="brand-name">Triage &amp; Route</span>
          </div>
        </a>

        <nav className="site-nav" aria-label="Primary">
          <a href="#" className="nav-link">Overview</a>
          <a href="#case-analysis" className="nav-link">Case Analysis</a>
          <a href="#approach" className="nav-link">How It Works</a>
        </nav>

        <div className="header-right">
          <span className="synth-pill" role="note">Synthetic Demo</span>
          <button className="btn btn-teal btn-sm" onClick={onAnalyseClick} id="header-analyse-btn">
            Analyse a Case
          </button>
        </div>
      </div>
    </header>
  );
}
