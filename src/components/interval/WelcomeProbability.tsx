import { useEffect, useRef } from 'react';

// A decorative distribution, not a graph of the player's results.
const TAU = Math.PI * 2;
const smooth = (value: number) => value * value * (3 - 2 * value);
const moments = [
  [0, .25, 1, -.07, -.02, .40],
  [.22, 1, .95, -.04, -.04, .38],
  [.45, 1, .55, -.04, -.04, .20],
  [.57, 1, .60, .14, -.04, .20],
  [.75, 1, .72, .10, .10, .30],
  [1, .25, 1, -.07, -.02, .40],
];
function composition(phase: number) {
  const next = moments.findIndex(moment => moment[0] > phase);
  const a = moments[Math.max(0, next - 1)], b = moments[next < 0 ? moments.length - 1 : next];
  const mix = smooth((phase - a[0]) / (b[0] - a[0] || 1));
  return a.slice(1).map((value, index) => value + (b[index + 1] - value) * mix);
}

export function WelcomeProbability() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext('2d');
    if (!node || !context) return;
    let seed = 42176;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const dots = Array.from({ length: 1100 }, () => ({
      u: random() * 2 - 1, v: random(), x: random(), y: random(),
      phase: random() * TAU, radius: .65 + random() * 1.1, ink: random() > .78,
    }));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, frame = 0, previous = 0, elapsed = 0, lastPaint = 0;
    let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;
    function paint(seconds: number) {
      if (!context) return;
      const phase = (seconds / 38) % 1;
      const [formed, spread, shift, bracketShift, range] = composition(phase);
      const base = height * .81, rise = Math.min(height * .36, 340);
      const center = width * (.5 + shift) + driftX;
      const left = width * (.5 + bracketShift - range) + driftX * .5;
      const right = width * (.5 + bracketShift + range) + driftX * .5;
      context.clearRect(0, 0, width, height);
      const count = width < 600 ? 640 : dots.length;
      for (let i = 0; i < count; i++) {
        const dot = dots[i];
        const bell = Math.exp(-.5 * (dot.u * 2.65) ** 2);
        const targetX = center + dot.u * width * .62 * spread;
        const targetY = base - rise * bell * Math.pow(dot.v, .7);
        const scatteredX = (dot.x * 1.2 - .1) * width;
        const scatteredY = height * (.40 + dot.y * .58);
        const x = scatteredX + (targetX - scatteredX) * formed + Math.sin(seconds * .19 + dot.phase) * 3;
        const y = scatteredY + (targetY - scatteredY) * formed + Math.cos(seconds * .16 + dot.phase) * 3 + driftY;
        const outside = x < left || x > right;
        context.fillStyle = outside && formed > .8 ? '#ad4128' : dot.ink ? '#352a25' : '#276c66';
        context.globalAlpha = (dot.ink ? .20 : .30) * (.65 + dot.v * .35);
        context.beginPath(); context.arc(x, y, dot.radius, 0, TAU); context.fill();
      }
      // Brackets follow the evidence with a deliberate delay; certainty can be surprised.
      const top = base - rise * .95 + driftY * .5, bottom = base + 18 + driftY * .5;
      context.globalAlpha = .25; context.strokeStyle = '#276c66'; context.lineWidth = 1;
      for (const [x, direction] of [[left, 1], [right, -1]]) {
        context.beginPath(); context.moveTo(x + 13 * direction, top); context.lineTo(x, top);
        context.lineTo(x, bottom); context.lineTo(x + 13 * direction, bottom); context.stroke();
      }
      context.globalAlpha = .10; context.strokeStyle = '#352a25';
      context.beginPath(); context.moveTo(left, bottom + 12); context.lineTo(right, bottom + 12); context.stroke();
      context.globalAlpha = 1;
    }
    function tick(now: number) {
      if (previous) elapsed += Math.min(now - previous, 100);
      previous = now;
      if (now - lastPaint >= 1000 / 30) {
        driftX += (pointerX - driftX) * .035; driftY += (pointerY - driftY) * .035;
        paint(elapsed / 1000); lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame); previous = 0;
      if (reduced.matches) { driftX = 0; driftY = 0; paint(12); }
      else if (!document.hidden) frame = requestAnimationFrame(tick);
    }
    function resize() {
      const bounds = node!.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      node!.width = Math.round(width * ratio); node!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint(reduced.matches ? 12 : elapsed / 1000);
    }
    function point(event: PointerEvent) {
      if (reduced.matches) return;
      pointerX = (event.clientX / width - .5) * 20;
      pointerY = (event.clientY / height - .5) * 12;
    }
    function release() { pointerX = 0; pointerY = 0; }
    const observer = new ResizeObserver(resize); observer.observe(node);
    resize(); sync();
    reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    window.addEventListener('pointermove', point, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    document.documentElement.addEventListener('pointerleave', release);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync); window.removeEventListener('pointermove', point);
      window.removeEventListener('pointerup', release); document.documentElement.removeEventListener('pointerleave', release);
    };
  }, []);
  return <canvas className="welcome-probability" ref={canvas} aria-hidden="true" />;
}
