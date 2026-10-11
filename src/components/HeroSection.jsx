import './HeroSection.css';

export default function HeroSection({ onAnalyseClick }) {
  function scrollToHow() {
    document.getElementById('approach')?.scrollIntoView({ behavior:'smooth' });
  }
  return (
    <section className="hero" aria-labelledby="hero-h1">
      <div className="hero-inner">

        {/* Left — text */}
        <div className="hero-text">
          <p className="eyebrow eyebrow-yellow">Agentic Healthcare Decision Support</p>

          <h1 id="hero-h1" className="hero-h1">
            Clearer triage.
            <span className="hero-h1-accent">
              <em>Smarter priorities.</em>
            </span>
          </h1>

          <p className="hero-desc">
            This prototype combines synthetic patient history, deterministic red&#8209;flag
            detection and LLM reasoning to suggest a triage priority — always
            subject to physician review.
          </p>

          <div className="hero-synth-note" role="note">
            <span className="synth-dot" aria-hidden="true" />
            <span>100&thinsp;% synthetic data &mdash; not for real patients</span>
          </div>

          <div className="hero-ctas">
            <button className="btn btn-cream" onClick={onAnalyseClick} id="hero-analyse-btn">
              Analyse a Case
            </button>
            <button className="btn btn-outline-cream" onClick={scrollToHow}>
              Explore How It Works
            </button>
          </div>
        </div>

        {/* Right — photo */}
        <div className="hero-photo-wrap">
          <img
            src="/hero.jpg"
            alt="A physician consulting with a patient, reviewing a tablet in a warm clinical setting"
            className="hero-photo"
            loading="eager"
            decoding="async"
          />
        </div>

      </div>
    </section>
  );
}
