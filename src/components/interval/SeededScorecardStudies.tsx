import { useEffect, useMemo, useState } from 'react';
import { INITIAL_INK_SEED, inkExplorations, normalizeInkSeed, seedDecisions } from '../../../shared/ink-exploration';
import { colorName, playerColors, playerIcons } from '../../../shared/player-profile';
import { ScorecardShare } from './ScorecardShare';

function randomSeed() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  // Rejection sampling gives every character an equal chance.
  let seed = '';
  while (seed.length < 12) for (const value of crypto.getRandomValues(new Uint8Array(24))) {
    if (value < 252 && seed.length < 12) seed += alphabet[value % 36];
  }
  return seed;
}
const query = new URLSearchParams(window.location.search);
const initialSeed = normalizeInkSeed(query.get('seed'));

export function SeededScorecardStudies() {
  const [username, setUsername] = useState((query.get('name') ?? 'erik').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20));
  const [seed, setSeed] = useState(initialSeed), [draft, setDraft] = useState(initialSeed);
  const [color, setColor] = useState(playerColors.some(color => color.value === query.get('color')) ? query.get('color')! : '');
  const [message, setMessage] = useState('');
  const cards = useMemo(() => inkExplorations(seed, username, color || undefined), [seed, username, color]);
  useEffect(() => {
    const url = new URL(window.location.href); url.searchParams.set('mode', 'explore'); url.searchParams.set('seed', seed); url.searchParams.set('name', username);
    if (color) url.searchParams.set('color', color); else url.searchParams.delete('color');
    window.history.replaceState(null, '', url);
  }, [seed, username, color]);
  return <>
    <form className="preview-controls" aria-label="Ink exploration settings" onSubmit={event => {
      event.preventDefault(); if (draft.length === 12) { setSeed(draft); setMessage(''); }
    }}>
      <label>Name<input value={username} maxLength={20} onChange={event => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} /></label>
      <label>Color<select aria-label="Color" value={color} onChange={event => setColor(event.target.value)}>
        <option value="">All six colors</option>{playerColors.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
      </select></label>
      <label>Design seed<input className="seed-input" aria-label="Design seed" value={draft} minLength={12} maxLength={12} pattern="[A-Z0-9]{12}" required onChange={event => setDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
      <button type="submit" className="study-action">Apply seed</button>
      <button type="button" className="study-action primary-study-action" onClick={() => { const next = randomSeed(); setSeed(next); setDraft(next); setMessage(''); }}>New seed ↗</button>
      <button type="button" className="study-action" onClick={async () => {
        try { await navigator.clipboard.writeText(window.location.href); setMessage('Study link copied.'); }
        catch { setMessage('Copy the page address to keep this study.'); }
      }}>Copy study link</button>
    </form>
    <div className="seed-caption"><span>Six patterns. Six colors. One set of deliberate collisions.</span><span role="status">{message}</span></div>
    <details className="seed-key"><summary>How {seed} becomes six designs</summary>
      <p>Each pair sets one design choice. The same seed produces the same board. “New seed” reshuffles the choices; it always keeps one of every animation and layout.</p>
      <div className="seed-decisions">{seedDecisions.map((decision, index) => <div key={decision}><code>{seed.slice(index * 2, index * 2 + 2)}</code><span>{decision}</span></div>)}</div>
      <p>Try one color across all six to compare layout and pattern. The first exploration began with <code>{INITIAL_INK_SEED}</code>.</p>
    </details>
    <div className="studies ink-explorations">{cards.map((data, index) => <article key={data.player.icon} data-pattern={data.player.icon}>
      <div className="study-heading"><h2>{String(index + 1).padStart(2, '0')} · {playerIcons[index].label}</h2><span className="study-swatch" style={{ background: data.player.color }} aria-label={colorName(data.player.color)} /></div>
      <p className="study-description">{colorName(data.player.color)} · {data.design!.surface} · {data.design!.layout}</p>
      <div className="interval-app study-card">
        <ScorecardShare data={data} />
      </div>
      <p className="design-recipe">{data.design!.type} type · {data.design!.scale}× pattern · {data.design!.angle}° angle</p>
    </article>)}</div>
  </>;
}
