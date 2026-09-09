import { useEffect, useId, useRef, useState } from 'react';
import type { ScorecardData, ScorecardVariant } from '../../../shared/scorecard';
import { GAME_URL, saveScorecard, scorecardPng, shareScorecard, copyScorecard, shareCaption } from '../../lib/share-scorecard';
import { ScoreCard } from './ScoreCard';

export function ScorecardShare({ data, text, url = GAME_URL, variant = 'ink' }: { data: ScorecardData; text: string; url?: string; variant?: ScorecardVariant }) {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const optionsId = useId();
  const actions = useRef<HTMLDivElement>(null);
  const shareButton = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    (copyButton.current?.disabled ? actions.current?.querySelector<HTMLElement>('[role=group]') : copyButton.current)?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !actions.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  const [fallback, setFallback] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const image = useRef<{ data: ScorecardData; png: Promise<Blob>; ready: Blob | null; gif: Blob | null } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const entry = { data, png: scorecardPng(data, variant), ready: null as Blob | null, gif: null as Blob | null }; image.current = entry;
    setPreparing(true); setGifFailed(false); setStatus(''); setFallback(false);
    void entry.png.then(blob => { entry.ready = blob; }).catch(() => {});
    // Encoding is loaded only on results screens, and runs off the UI thread.
    void import('../../lib/scorecard-gif').then(({ scorecardGif }) => scorecardGif(data, abort.signal, variant))
      .then(blob => { entry.gif = blob; })
      .catch(() => { if (!abort.signal.aborted) setGifFailed(true); })
      .finally(() => { if (!abort.signal.aborted) setPreparing(false); });
    return () => { abort.abort(); image.current = null; };
  }, [data, retry, variant]);
  async function copy(native = false) {
    if (sharing) return;
    if (preparing) { setStatus('Preparing your animation. Tap again in a moment.'); return; }
    const cached = image.current?.data === data ? image.current : null;
    setSharing(true); setFallback(false);
    try {
      const png = cached?.png ?? scorecardPng(data, variant);
      const outcome = native
        ? await shareScorecard(png, cached?.ready ?? null, text, cached?.gif ?? null, url)
        : await copyScorecard(png, text, cached?.gif ?? null, url);
      if (outcome === 'cancelled') return;
      setFallback(outcome === 'downloaded');
      setStatus(outcome === 'shared' ? 'Card and link sent to the share sheet.' : outcome === 'copied-gif' ? 'GIF, score and link copied.' : outcome === 'copied-saved-gif' ? 'Image, score and link copied. Animated GIF saved—attach it to keep it moving.' : outcome === 'copied' ? 'Still image, score and link copied.' : outcome === 'downloaded-linked' ? 'Card saved. Score and link copied—paste them and attach the file.' : 'Card saved. Copy your score and link below.');
    } catch { setFallback(true); setStatus('Select and copy your score and link below.'); }
    finally { setSharing(false); }
  }
  return <>
    <ScoreCard data={data} variant={variant} onShare={() => setOpen(true)} />
    <div ref={actions} className="scorecard-sharing" onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); shareButton.current?.focus(); }
    }}>
      <div className="share-actions scorecard-share-actions">
        <button ref={shareButton} type="button" className="primary" aria-expanded={open} aria-controls={optionsId}
          onClick={() => setOpen(value => !value)}>
          Share<span aria-hidden="true">↗</span>
        </button>
      </div>
      {open && <div id={optionsId} className="scorecard-share-options" role="group" aria-label="Share scorecard" tabIndex={-1}>
        <button ref={copyButton} type="button" className="scorecard-copy-option" onClick={() => void copy()} disabled={sharing || preparing}>
          Copy<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>
        </button>
        <div className="scorecard-extras">
          <button type="button" className="text-button" disabled={preparing || sharing} onClick={() => {
            if (image.current?.gif) { saveScorecard(image.current.gif); setStatus('Animated GIF saved.'); }
            else setRetry(value => value + 1);
          }}>{gifFailed ? 'Retry GIF' : 'Save GIF'}</button>
          {typeof navigator.share === 'function' && typeof navigator.canShare === 'function' &&
            <button type="button" className="text-button" disabled={preparing || sharing} onClick={() => void copy(true)}>More options</button>}
        </div>
        {(preparing || sharing) && <p className="scorecard-preparing" role="status">{preparing ? 'Preparing animation…' : 'Sharing…'}</p>}
      </div>}
    </div>
    <p className="copy-status" role="status">{status}</p>
    {fallback && <textarea className="share-fallback" aria-label="Shareable score and link" readOnly
      value={shareCaption(text, url)} onFocus={event => event.target.select()} />}
  </>;
}
