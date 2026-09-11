import { useEffect, useRef, useState } from 'react';
import type { ScorecardData, ScorecardVariant } from '../../../shared/scorecard';
import { GAME_URL, scorecardPng, copyScorecard } from '../../lib/share-scorecard';
import { ScoreCard } from './ScoreCard';

export function ScorecardShare({ data, url = GAME_URL, variant = 'ink' }: { data: ScorecardData; url?: string; variant?: ScorecardVariant }) {
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [sharing, setSharing] = useState(false);
  const image = useRef<{ data: ScorecardData; png: Promise<Blob>; gif: Blob | null } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const entry = { data, png: scorecardPng(data, variant), gif: null as Blob | null }; image.current = entry;
    setPreparing(true); setStatus(''); setFallback(false);
    void entry.png.catch(() => {});
    // Encoding is loaded only on results screens, and runs off the UI thread.
    void import('../../lib/scorecard-gif').then(({ scorecardGif }) => scorecardGif(data, abort.signal, variant))
      .then(blob => { entry.gif = blob; })
      .catch(() => { /* The still image remains available if GIF encoding fails. */ })
      .finally(() => { if (!abort.signal.aborted) setPreparing(false); });
    return () => { abort.abort(); image.current = null; };
  }, [data, variant]);
  useEffect(() => {
    if (status !== 'Copied to your clipboard.') return;
    const timer = window.setTimeout(() => setStatus(''), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);
  async function copy() {
    if (sharing) return;
    if (preparing) { setStatus('Preparing your animation. Tap again in a moment.'); return; }
    const cached = image.current?.data === data ? image.current : null;
    setSharing(true); setFallback(false); setStatus('');
    try {
      const png = cached?.png ?? scorecardPng(data, variant);
      const outcome = await copyScorecard(png, cached?.gif ?? null, url);
      setFallback(outcome === 'unavailable');
      setStatus(outcome === 'copied-gif' || outcome === 'copied' ? 'Copied to your clipboard.' : outcome === 'copied-text' ? 'Link copied. This browser couldn’t copy the image.' : 'Select and copy the link below.');
    } catch { setFallback(true); setStatus('Select and copy the link below.'); }
    finally { setSharing(false); }
  }
  return <>
    <ScoreCard data={data} variant={variant} onShare={() => void copy()} disabled={preparing || sharing} />
    <div className="share-actions scorecard-share-actions">
      <button type="button" className="hold-commit scorecard-share-button" onClick={() => void copy()} disabled={preparing || sharing}>
        <svg className="commit-ring" viewBox="0 0 80 80" aria-hidden="true"><circle className="commit-track" cx="40" cy="40" r="36" /></svg>
        <span>Share</span>
      </button>
    </div>
    <p className="copy-status" role="status">{preparing ? 'Preparing animation…' : sharing ? 'Copying…' : status}</p>
    {fallback && <textarea className="share-fallback" aria-label="Shareable link" readOnly
      value={url} onFocus={event => event.target.select()} />}
  </>;
}
