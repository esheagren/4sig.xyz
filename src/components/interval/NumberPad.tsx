import { useEffect, useId, useRef, useState } from "react";
import { compact, parseAmount } from "./game";
import {
  displayCursor,
  editEntry,
  formatEntry,
  rawCursor,
} from "./number-entry";

import { calculate } from "./calculator";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  unit: string;
  showUnit?: boolean;
  error?: string;
  submitLabel: string;
};
export function NumberPad({
  value,
  onChange,
  onSubmit,
  label,
  unit,
  showUnit = true,
  error,
  submitLabel,
}: Props) {
  const [calculator, setCalculator] = useState(false);
  const [expression, setExpression] = useState("");
  const [calculationError, setCalculationError] = useState("");
  const expressionInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId(),
    captionId = `${inputId}-caption`;
  const display = formatEntry(value);
  function update(next: string, cursor: number) {
    onChange(next);
    requestAnimationFrame(() => {
      input.current?.focus({ preventScroll: true });
      input.current?.setSelectionRange(cursor, cursor);
    });
  }
  function updateCalculation(next: string) {
    setExpression(next);
    try {
      onChange(String(calculate(next)));
      setCalculationError("");
    } catch (e) {
      onChange("");
      setCalculationError(next.trim() ? (e instanceof Error ? e.message : "Check your calculation.") : "");
    }
  }
  function toggleCalculator() {
    if (!calculator) {
      setExpression(value);
      setCalculationError("");
    }
    setCalculator(!calculator);
    requestAnimationFrame(() => {
      const target = calculator ? input.current : expressionInput.current;
      target?.focus({ preventScroll: true });
      target?.setSelectionRange(target.value.length, target.value.length);
    });
  }
  function press(key: string) {
    if (calculator) {
      const target = expressionInput.current;
      let start = target?.selectionStart ?? expression.length;
      let end = target?.selectionEnd ?? expression.length;
      if (key === "Delete" && start === end) start = Math.max(0, start - 1);
      if (key === "DeleteForward" && start === end) end = Math.min(expression.length, end + 1);
      const inserted = key.startsWith("Delete") ? "" : key;
      updateCalculation(expression.slice(0, start) + inserted + expression.slice(end));
      requestAnimationFrame(() => {
        target?.focus({ preventScroll: true });
        target?.setSelectionRange(start + inserted.length, start + inserted.length);
      });
      return;
    }
    const next = editEntry(
      display,
      input.current?.selectionStart ?? display.length,
      input.current?.selectionEnd ?? display.length,
      key,
    );
    update(next.value, next.cursor);
  }
  // Keep headings accessible on navigation, while letting desktop users simply type.
  useEffect(() => {
    function startTyping(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog && !openDialog.contains(input.current)) return;
      if (!(calculator ? /^[0-9.eE+*/−×÷-]$/ : /^[0-9.eE+-]$/).test(event.key)) return;
      event.preventDefault();
      // Focus synchronously so consecutive physical key presses reach the field.
      (calculator ? expressionInput.current : input.current)?.focus({ preventScroll: true });
      press(event.key);
    }
    document.addEventListener('keydown', startTyping);
    return () => document.removeEventListener('keydown', startTyping);
  });
  const amount = parseAmount(value);
  return (
    <form
      className="number-entry"
      onSubmit={(e) => {
        e.preventDefault();
        if (!calculator || (expression.trim() && !calculationError)) onSubmit();
      }}
    >
      <label className="input-label" htmlFor={inputId}>
        {label}
        {showUnit && <span>{unit}</span>}
      </label>
      <input
        ref={input}
        id={inputId}
        type="text"
        inputMode="none"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label={label}
        aria-describedby={captionId}
        value={display}
        readOnly={calculator}
        onFocus={() => { if (calculator) expressionInput.current?.focus({ preventScroll: true }); }}
        placeholder={calculator ? "—" : "0"}
        onChange={(e) => {
          const next = e.target.value.replaceAll(",", "");
          const cursor = rawCursor(
            e.target.value,
            e.target.selectionStart ?? e.target.value.length,
          );
          update(next, displayCursor(next, cursor));
        }}
        onKeyDown={(e) => {
          if (
            !calculator &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.nativeEvent.isComposing &&
            (e.key === "Backspace" || e.key === "Delete")
          ) {
            e.preventDefault();
            press(e.key === "Backspace" ? "Delete" : "DeleteForward");
          }
        }}
      />
      {calculator && <div className="calculation-line">
        <span aria-hidden="true">=</span>
        <input ref={expressionInput} className="calculation-expression" aria-label="Calculation"
          aria-describedby={captionId} type="text" inputMode="none" autoComplete="off" spellCheck={false}
          value={expression} placeholder="Calculation" onChange={e => updateCalculation(e.target.value)} />
        <button type="button" className="calculation-clear" aria-label="Clear calculation"
          onClick={() => { updateCalculation(""); expressionInput.current?.focus(); }}>Clear</button>
      </div>}
      <div
        id={captionId}
        className={`number-caption ${error || calculationError ? "error" : ""}`}
        aria-live="polite"
      >
        {error || calculationError ||
          (Number.isFinite(amount) && /e/i.test(value)
            ? `${compact(amount)} ${unit}`
            : "")}
      </div>
      {calculator && <div className="calculator-operators" role="group" aria-label="Arithmetic operations">
        {[["+", "Add"], ["−", "Subtract"], ["×", "Multiply"], ["÷", "Divide"]].map(([key, name]) =>
          <button key={key} type="button" aria-label={name} onClick={() => press(key)}>{key}</button>)}
      </div>}
      <div className="keypad">
        {[
          "7",
          "8",
          "9",
          "Delete",
          "4",
          "5",
          "6",
          "Calculator",
          "1",
          "2",
          "3",
          "→",
          ".",
          "0",
          "000",
        ].map((key) => (
          <button
            key={key}
            type={key === "→" ? "submit" : "button"}
            className={
              key === "→"
                ? "enter-key"
                : ["Calculator", "Delete", "000"].includes(key)
                  ? `function-key ${key.toLowerCase()}-key`
                  : ""
            }
            aria-label={
              (
                {
                  Delete: "Delete digit",
                  Calculator: calculator ? "Close calculator" : "Open calculator",
                  "000": "Insert three zeros",
                  "→": submitLabel,
                } as Record<string, string>
              )[key] ?? key
            }
            title={
              key === "Delete"
                ? "Delete digit"
                : key === "Calculator"
                  ? calculator ? "Close calculator" : "Open calculator"
                  : undefined
            }
            aria-pressed={key === "Calculator" ? calculator : undefined}
            disabled={key === "→" && calculator && (!expression.trim() || !!calculationError)}
            onClick={() => {
              if (key === "Calculator") toggleCalculator();
              else if (key !== "→") press(key);
            }}
          >
            {key === "Calculator" ? (
              <svg width="23" height="26" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="3" y="2" width="18" height="24" rx="3" />
                <path d="M7 7h10v4H7zM7 16h2m6 0h2M7 21h2m6 0h2" />
              </svg>
            ) : key === "Delete" ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-7-7z" />
                <path d="m12 9 6 6m0-6-6 6" />
              </svg>
            ) : (
              key
            )}
          </button>
        ))}
      </div>
    </form>
  );
}
