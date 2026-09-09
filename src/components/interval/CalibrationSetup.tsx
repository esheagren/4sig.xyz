export function CalibrationSetup({ count }: { count: number }) {
  return <>
    <div className="daily-four" aria-hidden="true">
      {[1, 2, 3, 4].map(n => <span key={n}>{n}</span>)}
    </div>
    <p className="setup-intro">Explore four new questions each day.</p>
    <h2>First, find your starting point.</h2>
    <p className="setup-intro">Everyone begins with the same {count} questions to get an initial score and see how well they are calibrated.</p>
    <div className="setup-measures">
      <div>
        <svg viewBox="0 0 120 72" aria-hidden="true">
          {[44, 27, 10].map((halfWidth, i) => <g key={halfWidth} transform={`translate(60 ${12 + i * 24})`}>
            <path className="setup-range-fill" d={`M${-halfWidth} -6H${halfWidth}V6H${-halfWidth}Z`} />
            <path d={`M${-halfWidth + 3} -8H${-halfWidth}V8H${-halfWidth + 3} M${halfWidth - 3} -8H${halfWidth}V8H${halfWidth - 3}`} />
            <circle cx="0" cy="0" r="2.5" />
          </g>)}
        </svg>
        <h3>Score</h3>
        <p>Earn more points for tighter ranges that contain the answer.</p>
      </div>
      <div>
        <svg viewBox="0 0 120 72" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={20 + i % 5 * 20} cy={6 + Math.floor(i / 5) * 20} r="4" className={i === 19 ? 'setup-dot-open' : ''} />)}
        </svg>
        <h3>Calibration</h3>
        <p>How often your ranges contain the answer.</p>
        <span className="calibration-target">Aim for 95% over time.</span>
      </div>
    </div>
  </>;
}
