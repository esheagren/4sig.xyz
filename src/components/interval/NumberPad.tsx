import { useId, useRef } from "react";
import { compact, parseAmount } from "./game";

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
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId(),
    captionId = `${inputId}-caption`;
  function press(key: string) {
    let start = input.current?.selectionStart ?? value.length;
    const end = input.current?.selectionEnd ?? value.length;
    let next = value,
      cursor = start;
    if (key === "Clear") {
      next = "";
      cursor = 0;
    } else if (key === "Delete") {
      if (start === end) start = Math.max(0, start - 1);
      next = value.slice(0, start) + value.slice(end);
      cursor = start;
    } else {
      next =
        value.slice(0, start) + (key === "−" ? "-" : key) + value.slice(end);
      cursor = start + key.length;
    }
    onChange(next);
    requestAnimationFrame(() => {
      input.current?.focus({ preventScroll: true });
      input.current?.setSelectionRange(cursor, cursor);
    });
  }
  const amount = parseAmount(value);
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
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
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
          "E",
          "1",
          "2",
          "3",
          "→",
          ".",
          "0",
          "−",
        ].map((key) => (
          <button
            key={key}
            type={key === "→" ? "submit" : "button"}
            className={
              key === "→"
                ? "enter-key"
                : ["E", "Clear", "Delete", "−"].includes(key)
                  ? `function-key ${key.toLowerCase()}-key`
                  : ""
            }
            aria-label={
              (
                {
                  Delete: "Delete digit",
                  E: "Exponent",
                  "−": "Minus",
                  "→": submitLabel,
                } as Record<string, string>
              )[key] ?? key
            }
            title={
              key === "Delete"
                ? "Delete digit"
                : key === "E"
                  ? "Scientific notation: 4E5 = 400,000"
                  : undefined
            }
            disabled={key === "E" && (!value || /e/i.test(value))}
            onClick={() => {
              if (key !== "→") press(key);
            }}
          >
            {key === "Delete" ? (
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
