import { memo, useEffect, useRef } from 'react';

// A slowly turning family of phase curves: a different signature from the welcome's bell curve.
export const IdentityField = memo(function IdentityField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, frame = 0, last = 0, elapsed = 0, painted = 0;
    const tau = Math.PI * 2;
    function paint(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(width * .73, height * .57);
      const turn = time * .035;
      for (let strand = 0; strand < 18; strand++) {
        const phase = strand / 18 * tau;
        ctx.fillStyle = strand % 5 === 0 ? '#ad4128' : strand % 3 === 0 ? '#352a25' : '#276c66';
        for (let point = 0; point < 90; point++) {
          const t = point / 90 * tau + time * .045;
          const x = Math.cos(t) * (1 + .16 * Math.cos(3 * t + phase));
          const y = Math.sin(t) * (1 + .16 * Math.cos(3 * t + phase));
          const z = .4 * Math.sin(3 * t + phase);
          const turnedX = x * Math.cos(turn) + z * Math.sin(turn);
          const depth = -x * Math.sin(turn) + z * Math.cos(turn);
          const px = width / 2 + radius * (turnedX * .9 + y * .22);
          const py = height / 2 + radius * (y * .92 - turnedX * .18 + depth * .25);
          ctx.globalAlpha = .15 + (depth + 1.3) / 2.6 * .28;
          ctx.beginPath(); ctx.arc(px, py, strand % 5 === 0 ? 1.35 : 1, 0, tau); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    function tick(now: number) {
      if (last) elapsed += Math.min(now - last, 100);
      last = now;
      if (now - painted > 1000 / 30) { paint(elapsed / 1000); painted = now; }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame); last = 0;
      if (reduced.matches) paint(8);
      else if (!document.hidden) frame = requestAnimationFrame(tick);
    }
    function resize() {
      const bounds = node!.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      node!.width = Math.round(width * ratio); node!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0); paint(reduced.matches ? 8 : elapsed / 1000);
    }
    const observer = new ResizeObserver(resize); observer.observe(node);
    resize(); sync();
    reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return <canvas ref={canvas} className="identity-field" aria-hidden="true" />;
});
