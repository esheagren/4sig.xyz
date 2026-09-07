import { useEffect, useId, useRef } from "react";
import { attachHoldControl } from "./hold-control";

export function HoldToConfirm({
  onConfirm,
  revision,
  disabled = false,
}: {
  onConfirm: () => void;
  revision: string;
  disabled?: boolean;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const callback = useRef(onConfirm);
  const help = useId();
  useEffect(() => {
    callback.current = onConfirm;
  }, [onConfirm]);
  useEffect(() => {
    if (!button.current || disabled) return;
    return attachHoldControl(button.current, () => callback.current());
  }, [revision, disabled]);
  return (
    <div className="commit-control">
      <button
        ref={button}
        className="hold-commit"
        type="button"
        disabled={disabled}
        aria-label="Hold to confirm range"
        aria-describedby={help}
      >
        <svg className="commit-ring" viewBox="0 0 80 80" aria-hidden="true">
          <circle className="commit-track" cx="40" cy="40" r="36" />
          <circle
            className="commit-progress"
            cx="40"
            cy="40"
            r="36"
            pathLength="100"
          />
        </svg>
        <svg
          className="commit-arrow"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <path d="M7 16h18m-7-7 7 7-7 7" />
        </svg>
      </button>
      <span id={help} className="sr-only">
        Hold for half a second to submit. Release early to cancel. You can also
        hold Space or Enter.
      </span>
    </div>
  );
}
