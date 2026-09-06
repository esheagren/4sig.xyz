import type { PlayerIcon } from "./player";
const n = (x: number) => x.toFixed(2);
const dot = (x: number, y: number, r = 2, opacity = 1) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="currentColor" stroke="none" opacity="${opacity}"/>`;
const path = (points: number[][], opacity = 1) =>
  `<path d="${points.map(([x, y], i) => (i ? "L" : "M") + n(x) + " " + n(y)).join(" ")}" opacity="${opacity}"/>`;
// Original, periodic constructions. phase is a fraction of one eight-second loop.
export function patternFrame(icon: PlayerIcon, phase: number): string {
  const t = phase * Math.PI * 2;
  if (icon === "orbit")
    return (
      '<ellipse cx="32" cy="32" rx="23" ry="15" opacity=".2"/>' +
      [0, 2.1, 4.2]
        .map((offset, i) =>
          dot(
            32 + 23 * Math.cos(t + offset),
            32 + 15 * Math.sin(t + offset),
            i ? 1.6 : 3.1,
            i ? 0.45 : 1,
          ),
        )
        .join("")
    );
  if (icon === "wave")
    return Array.from({ length: 23 }, (_, i) =>
      dot(5 + i * 2.45, 32 + 11 * Math.sin(i * 0.38 - t), 1.35),
    ).join("");
  if (icon === "spiral") {
    const points = Array.from({ length: 100 }, (_, i) => {
      const a = (i / 99) * Math.PI * 4.5,
        r = 2 + (21 * i) / 99;
      return [32 + r * Math.cos(a + t), 32 + r * Math.sin(a + t)];
    });
    return path(points, 0.8) + dot(...(points.at(-1) as [number, number]), 2.4);
  }
  if (icon === "pendulum") {
    const angle = 0.7 * Math.sin(t),
      x = 32 + 32 * Math.sin(angle),
      y = 9 + 32 * Math.cos(angle);
    return (
      '<path d="M11.4 33.5Q32 52 52.6 33.5" opacity=".18"/>' +
      path(
        [
          [32, 9],
          [x, y],
        ],
        0.55,
      ) +
      dot(32, 9, 1.5, 0.5) +
      dot(x, y, 3.6)
    );
  }
  if (icon === "bloom")
    return path(
      Array.from({ length: 181 }, (_, i) => {
        const a = (i / 180) * Math.PI * 2,
          r = (20 + 2 * Math.sin(t)) * Math.cos(5 * a);
        return [32 + r * Math.cos(a + t / 5), 32 + r * Math.sin(a + t / 5)];
      }),
      0.85,
    );
  return Array.from({ length: 21 }, (_, i) => {
    const x = 7 + i * 2.5,
      y = 11 * Math.sin(i * 0.38 - t);
    return (
      (i % 3 === 0
        ? path(
            [
              [x, 32 - y],
              [x, 32 + y],
            ],
            0.12,
          )
        : "") +
      dot(x, 32 + y, 1.6) +
      dot(x, 32 - y, 1.3, 0.45)
    );
  }).join("");
}
