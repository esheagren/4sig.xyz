import { scoreText } from './game';

export function CalibrationScore({ score, hits, count, initial = false }: {
  score: number; hits: number; count: number; initial?: boolean;
}) {
  const rate = count ? Math.round(hits / count * 1000) / 10 : 0;
  return <>
    <div className="calibration-scorecard">
      <div><span className="small-label">POINTS</span><strong>{scoreText(score)}</strong><p>Precision earns points.</p></div>
      <div><span className="small-label">CALIBRATION</span><strong>{count ? `${rate}%` : '--'}</strong><p>{hits} of {count} in range <span className="calibration-target">Target: 95%</span></p></div>
    </div>
    {initial && <p className="onboarding-note">This is your starting snapshot. {count} questions cannot measure calibration precisely; your long-term target is to contain about 19 answers out of every 20.</p>}
  </>;
}
