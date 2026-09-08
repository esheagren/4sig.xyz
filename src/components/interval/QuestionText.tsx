import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GlossaryAnnotation } from "../../lib/glossary";
import "./glossary.css";

export function QuestionText({
  text,
  glossary = [],
}: {
  text: string;
  glossary?: GlossaryAnnotation[];
}) {
  const [active, setActive] = useState<GlossaryAnnotation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = dialog.current;
    if (!active || !el) return;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
    };
  }, [active]);
  let cursor = 0;
  const parts = glossary.flatMap((term) => {
    if (term.start < cursor || term.end > text.length || term.end <= term.start)
      return [];
    const before = text.slice(cursor, term.start);
    cursor = term.end;
    return [
      before,
      <button
        key={`${term.termId}-${term.start}`}
        type="button"
        className="glossary-term"
        aria-description="Open a short explanation"
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => setActive(term)}
      >
        {text.slice(term.start, term.end)}
      </button>,
    ];
  });
  return (
    <>
      {parts}
      {text.slice(cursor)}
      {createPortal(
        <dialog
          ref={dialog}
          id={id}
          className="glossary-popup"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-definition`}
          onClose={() => setActive(null)}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const box = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < box.left ||
              event.clientX > box.right ||
              event.clientY < box.top ||
              event.clientY > box.bottom
            )
              event.currentTarget.close();
          }}
        >
          <header>
            <h2 id={`${id}-title`}>{active?.title}</h2>
            <button
              type="button"
              aria-label="Close explanation"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <p id={`${id}-definition`}>{active?.definition}</p>
        </dialog>,
        document.body,
      )}
    </>
  );
}
