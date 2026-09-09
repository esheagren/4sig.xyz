import { useId, useRef, useState } from "react";
import { compact, parseAmount } from "./game";
import {
  displayCursor,
  editEntry,
  formatEntry,
  rawCursor,
} from "./number-entry";

import { CalculatorPad } from "./CalculatorPad";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  unit: string;
  error?: string;
  submitLabel: string;
};
export function NumberPad({
  value,
  onChange,
  onSubmit,
  label,
  unit,
  error,
  submitLabel,
}: Props) {
  const [calculator, setCalculator] = useState(false);
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
  function press(key: string) {
    const next = editEntry(
      display,
      input.current?.selectionStart ?? display.length,
      input.current?.selectionEnd ?? display.length,
      key,
    );
    update(next.value, next.cursor);
  }
  const amount = parseAmount(value);
  if (calculator) return <CalculatorPad initial={value} unit={unit}
    onCancel={() => { setCalculator(false); requestAnimationFrame(() => input.current?.focus()); }}
    onUse={(result) => { onChange(result); setCalculator(false); requestAnimationFrame(() => input.current?.focus()); }} />;
  return (
    <form
      className="number-entry"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="input-label" htmlFor={inputId}>
        {label}
        <span>{unit}</span>
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
        placeholder="0"
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
      <div
        id={captionId}
        className={`number-caption ${error ? "error" : ""}`}
        aria-live="polite"
      >
        {error ||
          (Number.isFinite(amount) && /e/i.test(value)
            ? `${compact(amount)} ${unit}`
            : "")}
      </div>
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
                  Calculator: "Open calculator",
                  "000": "Insert three zeros",
                  "→": submitLabel,
                } as Record<string, string>
              )[key] ?? key
            }
            title={
              key === "Delete"
                ? "Delete digit"
                : key === "Calculator"
                  ? "Open calculator"
                  : undefined
            }
            onClick={() => {
              if (key === "Calculator") setCalculator(true);
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
