import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerPanel } from '../../pages/PlayerPanel';

export function BottomNav({ active = 'play', onOpenChange }: { active?: 'play' | 'stats' | 'profile'; onOpenChange?: (open: boolean) => void }) {
  const [panel, setPanel] = useState<'stats' | 'profile' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    if (panel) dialog.current?.showModal();
    else dialog.current?.close();
  }, [panel]);
  function open(next: typeof panel) { setPanel(next); onOpenChange?.(next !== null); }
  return <>
    <nav className="bottom-nav" aria-label="Main navigation">
      <Link className="bottom-nav-logo" to="/" onClick={() => window.scrollTo({ top: 0 })} aria-label="4σ — Play" aria-current={active === 'play' ? 'page' : undefined}>4<span>σ</span></Link>
      <button type="button" onClick={() => open('stats')} aria-haspopup="dialog" aria-current={active === 'stats' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 20V12h3v8M10.5 20V4h3v16M16 20V8h3v12" /></svg><span>Stats</span>
      </button>
      <button type="button" onClick={() => open('profile')} aria-haspopup="dialog" aria-current={active === 'profile' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="7" r="3.5" /><path d="M4.5 21v-3a7.5 7.5 0 0 1 15 0v3" /></svg><span>Profile</span>
      </button>
    </nav>
    <dialog ref={dialog} className="player-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); open(null); }} onClick={event => {
      if ((event.target as Element).closest('a')) { open(null); return; }
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) open(null);
    }}>
      <div className="dialog-head"><h2 id={title}>{panel === 'stats' ? 'Stats' : 'Profile'}</h2><button type="button" aria-label="Close navigation panel" onClick={() => open(null)}>×</button></div>
      {panel && <PlayerPanel key={panel} view={panel} />}
    </dialog>
  </>;
}
