import { useEffect, useId, useRef } from 'react';

export function PracticeTip({ step, onDismiss }: { step: 'estimate' | 'range'; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useId(), description = useId();
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => node.close();
  }, []);
  return <dialog ref={dialog} className="practice-tip" aria-labelledby={title} aria-describedby={description}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onDismiss();
    }}>
    <div className="practice-tip-heading">
      <h2 ref={heading} id={title} tabIndex={-1}>Practice example</h2>
      <button type="button" aria-label="Close practice tip" onClick={onDismiss}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <p id={description}>{step === 'estimate' ? 'First, enter your best estimate.' : 'Move the brackets to a range you’re 95% sure contains the answer. Hold the round arrow to submit.'}</p>
  </dialog>;
}
