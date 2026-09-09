import { memo, useEffect, useMemo, useRef } from 'react';
import { calibrationText, scorecardSvg, type ScorecardData, type ScorecardVariant } from '../../../shared/scorecard';
import { patternFrame } from './patterns';

const AnimatedScorecard = memo(function AnimatedScorecard({ data, variant }: { data: ScorecardData; variant: ScorecardVariant }) {
  const root = useRef<HTMLSpanElement>(null);
  const svg = useMemo(() => scorecardSvg(data, variant), [data, variant]);
  useEffect(() => {
    const pattern = root.current?.querySelector('[data-scorecard-pattern]');
    if (!pattern) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = 0, elapsed = 0, previous = 0, visible = true;
    const tick = (now: number) => {
      if (previous) elapsed += now - previous;
      previous = now;
      if (now - last > 40) { pattern.innerHTML = patternFrame(data.player.icon, .125 + elapsed / 16000); last = now; }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); previous = 0;
      if (!reduced.matches && !document.hidden && visible) frame = requestAnimationFrame(tick);
      else if (reduced.matches) pattern.innerHTML = patternFrame(data.player.icon, .125);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(root.current!); reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); sync();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, [svg, data.player.icon]);
  return <span ref={root} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
});

export const ScoreCard = memo(function ScoreCard({ data, variant = 'ink', onShare, disabled = false }: {
  data: ScorecardData; variant?: ScorecardVariant; disabled?: boolean; onShare?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (!onShare) return <div className="scorecard-button scorecard-preview" role="img"
    aria-label={`${data.player.username}'s scorecard: ${data.score.toLocaleString('en-US')} points, ${calibrationText(data.hits)} calibration`}>
    <AnimatedScorecard data={data} variant={variant} />
  </div>;
  // Sharing status must not replace the SVG nodes being animated.
  return <button className="scorecard-button" onClick={onShare} disabled={disabled}
    aria-label={`Share ${data.player.username}'s scorecard: ${data.score.toLocaleString('en-US')} points, ${calibrationText(data.hits)} calibration`}>
    <AnimatedScorecard data={data} variant={variant} />
  </button>;
});
