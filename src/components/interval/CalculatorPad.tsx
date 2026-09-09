import { useId, useRef, useState } from 'react';
import { calculate } from './calculator';

export function CalculatorPad({ initial, unit, onCancel, onUse }: {
  initial: string; unit: string; onCancel: () => void; onUse: (value: string) => void;
}) {
  const [expression, setExpression] = useState(initial);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  function evaluate(use: boolean) {
    try {
      const result = String(calculate(expression));
      setExpression(result); setError('');
      if (use) onUse(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Check your calculation.'); }
  }
  function press(key: string) {
    const start = input.current?.selectionStart ?? expression.length;
    const end = input.current?.selectionEnd ?? expression.length;
    const from = key === '⌫' && start === end ? Math.max(0, start - 1) : start;
    const inserted = key === '⌫' ? '' : key;
    setExpression(expression.slice(0, from) + inserted + expression.slice(end));
    setError('');
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(from + inserted.length, from + inserted.length); });
  }
  const names: Record<string, string> = { '⌫': 'Delete digit', '×': 'Multiply', '÷': 'Divide', '−': 'Subtract', '+': 'Add', '=': 'Calculate', C: 'Clear calculation' };
  return <form className="number-entry calculator" onSubmit={e => { e.preventDefault(); evaluate(false); }}>
    <label className="input-label" htmlFor={id}>Calculator<span>{unit}</span></label>
    <input ref={input} id={id} autoFocus type="text" inputMode="none" autoComplete="off" spellCheck={false}
      value={expression} placeholder="0" aria-describedby={`${id}-error`}
      onChange={e => { setExpression(e.target.value); setError(''); }} />
    <div id={`${id}-error`} className="number-caption error" role="status">{error}</div>
    <div className="keypad calculator-keypad">
      {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '⌫', '+', 'C', '='].map(key =>
        <button key={key} type={key === '=' ? 'submit' : 'button'} aria-label={names[key] ?? key}
          className={key === '=' ? 'calculator-equals' : names[key] ? 'function-key' : ''}
          onClick={() => { if (key === 'C') { setExpression(''); setError(''); input.current?.focus(); } else if (key !== '=') press(key); }}>{key}</button>)}
    </div>
    <div className="calculator-actions">
      <button type="button" className="text-button" onClick={onCancel}>Back</button>
      <button type="button" className="primary" onClick={() => evaluate(true)}>Use result <span>→</span></button>
    </div>
  </form>;
}
