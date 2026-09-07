export const MINOR_DIVISIONS = 15;

export function rulerScale(domain: [number, number]) {
  const span = domain[1] - domain[0];
  const target = span / 5;
  const power = 10 ** Math.floor(Math.log10(target));
  const normalized = target / power;
  const multiple =
    [1, 2, 5, 10].find((n) => normalized <= n * (1 + 1e-12)) ?? 10;
  const majorStep = multiple * power;
  const minorStep = majorStep / MINOR_DIVISIONS;
  const ticks: { value: number; position: number; major: boolean }[] = [];
  if (!Number.isFinite(span) || span <= 0 || minorStep <= 0)
    return { majorStep, minorStep, ticks };
  const first = Math.ceil(domain[0] / minorStep - 1e-10);
  for (let i = 0; i < 5 * MINOR_DIVISIONS + 2; i++) {
    const index = first + i;
    const value = Number((index * minorStep).toPrecision(12));
    const position = (value - domain[0]) / span;
    if (position > 1 + 1e-10) break;
    if (position >= -1e-10)
      ticks.push({
        value,
        position: Math.max(0, Math.min(1, position)),
        major: index % MINOR_DIVISIONS === 0,
      });
  }
  return { majorStep, minorStep, ticks };
}
