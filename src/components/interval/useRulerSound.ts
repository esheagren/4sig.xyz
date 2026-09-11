import { useEffect, useState } from 'react';
import { FEEDBACK_KEY } from './ruler-feedback';
const changed = 'four-sigma-sound-changed';
const read = () => {
  try { return localStorage.getItem(FEEDBACK_KEY) !== 'off'; } catch { return true; }
};
export function useRulerSound() {
  const [enabled, setEnabled] = useState(read);
  useEffect(() => {
    const sync = () => setEnabled(read());
    const local = (event: Event) => setEnabled((event as CustomEvent<boolean>).detail);
    window.addEventListener('storage', sync);
    window.addEventListener(changed, local);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(changed, local); };
  }, []);
  const toggle = () => {
    const next = !enabled;
    try { localStorage.setItem(FEEDBACK_KEY, next ? 'on' : 'off'); } catch { /* Optional preference storage. */ }
    setEnabled(next);
    window.dispatchEvent(new CustomEvent(changed, { detail: next }));
  };
  return [enabled, toggle] as const;
}
