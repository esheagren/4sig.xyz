import { useEffect, useRef, useState } from 'react';
import type { ScorecardData, ScorecardVariant } from '../../../shared/scorecard';
import { GAME_URL, saveScorecard, scorecardPng, shareScorecard, shareCaption } from '../../lib/share-scorecard';
import { ScoreCard } from './ScoreCard';

export function ScorecardShare({ data, text, url = GAME_URL, variant = 'ink' }: { data: ScorecardData; text: string; url?: string; variant?: ScorecardVariant }) {
  const [status, setStatus] = useState('');
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
  async function copy() {
    if (sharing) return;
    if (preparing) { setStatus('Preparing your animation. Tap again in a moment.'); return; }
    const cached = image.current?.data === data ? image.current : null;
    setSharing(true); setFallback(false);
    try {
      const outcome = await shareScorecard(cached?.png ?? scorecardPng(data, variant), cached?.ready ?? null, text, cached?.gif ?? null, url);
      if (outcome === 'cancelled') return;
      setFallback(outcome === 'downloaded');
      setStatus(outcome === 'shared' ? 'Card and link sent to the share sheet.' : outcome === 'copied-gif' ? 'GIF, score and link copied.' : outcome === 'copied-saved-gif' ? 'Image, score and link copied. Animated GIF saved—attach it to keep it moving.' : outcome === 'copied' ? 'Still image, score and link copied.' : outcome === 'downloaded-linked' ? 'Card saved. Score and link copied—paste them and attach the file.' : 'Card saved. Copy your score and link below.');
    } catch { setFallback(true); setStatus('Select and copy your score and link below.'); }
    finally { setSharing(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareCaption(text, url)); setStatus('Score and link copied.'); setFallback(false); }
    catch { setFallback(true); setStatus('Select and copy the link below.'); }
  }
  const waitingForShare = preparing;
  return <>
    <ScoreCard data={data} variant={variant} onShare={() => void copy()} />
    <div className="share-actions scorecard-share-actions">
      <button className="primary" onClick={() => void copy()} disabled={sharing || waitingForShare}>
        {waitingForShare ? 'Preparing animation…' : sharing ? 'Sharing…' : 'Copy and Share'}<span aria-hidden="true">↗</span>
      </button>
    </div>
    <div className="scorecard-extras">
      <button className="text-button" onClick={() => void copyLink()}>Copy score and link</button>
      <button className="text-button" disabled={preparing} onClick={() => {
        if (image.current?.gif) { saveScorecard(image.current.gif); setStatus('Animated GIF saved.'); }
        else setRetry(value => value + 1);
      }}>{preparing ? 'Preparing GIF…' : gifFailed ? 'Retry GIF' : 'Save GIF'}</button>
    </div>
    <p className="copy-status" role="status">{status}</p>
    {fallback && <textarea className="share-fallback" aria-label="Shareable score and link" readOnly
      value={shareCaption(text, url)} onFocus={event => event.target.select()} />}
  </>;
}
