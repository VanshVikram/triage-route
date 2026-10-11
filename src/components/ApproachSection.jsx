import './ApproachSection.css';

const STEPS = [
  {
    n: '01', head: 'Patient history lookup',
    body: 'The agent searches the synthetic patient database for any existing record matching the patient ID found in the case text.'
  },
  {
    n: '02', head: 'Deterministic red-flag detection',
    body: 'Rule-based code evaluates vital signs, symptom keywords and clinical thresholds. Each matched rule contributes to a numerical risk score.'
  },
  {
    n: '03', head: 'LLM clinical reasoning',
    body: 'A Gemini model receives the structured case, history, detected flags and guideline excerpts. It proposes a triage level with reasoning.'
  },
  {
    n: '04', head: 'Safety-floor enforcement',
    body: 'The final level is min(LLM proposal, rule-based floor). The LLM cannot reduce urgency below the configured clinical floor, preventing under-triage.'
  },
];

export default function ApproachSection() {
  return (
    <section className="approach-section" id="approach" aria-labelledby="approach-h2">
      <div className="approach-inner">

        <div className="approach-header">
          <div className="approach-label-col">
            <span className="badge badge-cream">Our Approach</span>
          </div>
          <div className="approach-title-col">
            <h2 id="approach-h2" className="approach-h2">
              A safer way to explore{' '}
              <em className="approach-h2-em">triage decisions.</em>
            </h2>
            <p className="approach-body">
              Triage &amp; Route layers structured clinical rules on top of LLM reasoning.
              The deterministic safety floor means a model can never silently reduce
              the urgency of a genuinely flagged case &mdash; physician review remains mandatory.
            </p>
          </div>
        </div>

        <div className="approach-steps">
          {STEPS.map((s) => (
            <div className="approach-step" key={s.n}>
              <div className="step-num-wrap" aria-hidden="true">
                <span className="step-num">{s.n}</span>
              </div>
              <div>
                <h4 className="step-head">{s.head}</h4>
                <p  className="step-body">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="approach-footer-note" role="note">
          <strong>100% synthetic data only.</strong> No real patient information is ever processed.
          This is a prototype demonstration, not a medical device and not approved for clinical use.
        </div>

      </div>
    </section>
  );
}
