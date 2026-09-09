// A small arithmetic parser: no JavaScript evaluation or executable input.
export function calculate(expression: string): number {
  const source = expression.replaceAll(',', '').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
  let position = 0;
  const whitespace = () => { while (/\s/.test(source[position] ?? '') && position < source.length) position++; };
  function number(): number {
    whitespace();
    const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(position));
    if (!match) throw new Error('Finish your calculation.');
    position += match[0].length;
    return Number(match[0]);
  }
  function product(): number {
    let value = number();
    whitespace();
    while (source[position] === '*' || source[position] === '/') {
      const operator = source[position++];
      const next = number();
      if (operator === '/' && next === 0) throw new Error('Cannot divide by zero.');
      value = operator === '*' ? value * next : value / next;
      whitespace();
    }
    return value;
  }
  let value = product();
  whitespace();
  while (source[position] === '+' || source[position] === '-') {
    const operator = source[position++];
    const next = product();
    value = operator === '+' ? value + next : value - next;
    whitespace();
  }
  if (position !== source.length) throw new Error('Use numbers and +, −, × or ÷.');
  if (!Number.isFinite(value) || Math.abs(value) > 1e100 || (value !== 0 && Math.abs(value) < 1e-100))
    throw new Error('That result is outside the supported range.');
  return Number(value.toPrecision(15));
}
