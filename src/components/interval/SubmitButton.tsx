export function SubmitButton({ onSubmit, disabled = false }: {
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="commit-control">
      <button
        className="hold-commit"
        type="button"
        disabled={disabled}
        aria-label="Submit"
        onClick={onSubmit}
      >
        <svg className="commit-ring" viewBox="0 0 80 80" aria-hidden="true">
          <circle className="commit-track" cx="40" cy="40" r="36" />
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
    </div>
  );
}
