import { useEffect, useMemo, useState } from 'react';
import { inkCollection, inkStyles, stylesForPattern, type InkStyleId } from '../../../shared/ink-collection';
import { colorName, playerColors, playerIcons, type PlayerIcon } from '../../../shared/player-profile';
import { ScorecardShare } from './ScorecardShare';
import { SeededScorecardStudies } from './SeededScorecardStudies';

const query = new URLSearchParams(window.location.search);
function InkCollectionStudy() {
  const [username, setUsername] = useState((query.get('name') ?? 'erik').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20));
  const [color, setColor] = useState(playerColors.some(color => color.value === query.get('color')) ? query.get('color')! : '');
  const [selected, setSelected] = useState<InkStyleId | ''>(inkStyles.find(style => style.id === query.get('style'))?.id ?? '');
  const [pattern, setPattern] = useState<PlayerIcon>(inkStyles.find(style => style.id === query.get('style'))?.icon ?? 'orbit');
  const [message, setMessage] = useState('');
  const cards = useMemo(() => inkCollection(username, color || undefined), [username, color]);
  useEffect(() => {
    const url = new URL(window.location.href); url.searchParams.delete('seed'); url.searchParams.delete('mode');
    url.searchParams.set('name', username);
    if (color) url.searchParams.set('color', color); else url.searchParams.delete('color');
    if (selected) url.searchParams.set('style', selected); else url.searchParams.delete('style');
    window.history.replaceState(null, '', url);
  }, [username, color, selected]);
  function choose(id: InkStyleId, scroll = false) {
    setSelected(id); setPattern(inkStyles.find(style => style.id === id)!.icon);
    setMessage(`${inkStyles.find(style => style.id === id)!.name} selected for this preview.`);
    if (scroll) document.getElementById(`style-${id}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
  return <>
    <div className="preview-controls" aria-label="Collection preview settings">
      <label>Name<input value={username} maxLength={20} onChange={event => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} /></label>
      <label>Color<select aria-label="Color" value={color} onChange={event => setColor(event.target.value)}>
        <option value="">Family palette</option>{playerColors.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
      </select></label>
      <label>Your pattern<select aria-label="Your pattern" value={pattern} onChange={event => { const icon = event.target.value as PlayerIcon; setPattern(icon); choose(stylesForPattern(icon)[0]); }}>
        {playerIcons.map(icon => <option key={icon.id} value={icon.id}>{icon.label}</option>)}
      </select></label>
      <button className="study-action" onClick={() => choose(stylesForPattern(pattern)[0], true)}>Show my style</button>
      <button className="study-action primary-study-action" onClick={() => choose(inkStyles[crypto.getRandomValues(new Uint8Array(1))[0] % inkStyles.length].id, true)}>Surprise me ↗</button>
      <button className="study-action" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setMessage('Collection link copied.'); } catch { setMessage('Copy the page address to keep this view.'); } }}>Copy study link</button>
    </div>
    <div className="seed-caption"><span>One mark. One typeface. Eight compositions.</span><span role="status">{message}</span></div>
    <details className="seed-key"><summary>The shared design language</summary>
      <div className="family-rules">
        <div><strong>A fixed signature</strong><p>The same 4σ mark, size, and position. A consistent header and footer.</p></div>
        <div><strong>A shared type system</strong><p>One sans-serif family for names, scores, and labels. The logo keeps its serif shape.</p></div>
        <div><strong>One color family</strong><p>Teal, saffron, rust, plum, cobalt, and ink. Deep fields and warm, pale tints.</p></div>
        <div><strong>Individual movement</strong><p>The pattern sets the composition. Your color carries through the background and accents.</p></div>
      </div>
      <p>A pattern can suggest its matching card. Orbit and Wave also have companion styles, Halo and Horizon. Try a choice or a random assignment here; it only changes this preview.</p>
    </details>
    <div className="studies ink-collection">{cards.map((data, index) => {
      const style = inkStyles[index]; return <article key={style.id} id={`style-${style.id}`} data-style={style.id} data-pattern={style.icon} className={selected === style.id ? 'chosen-study' : ''}>
        <div className="study-heading"><h2>{String(index + 1).padStart(2, '0')} · {style.name}</h2><span className="study-swatch" style={{ background: data.player.color }} aria-label={colorName(data.player.color)} /></div>
        <p className="study-description">{style.description}</p>
        <div className="interval-app study-card"><ScorecardShare data={data} text={`4σ · ${style.name} collection study\n${data.player.username} · 1,286.4 points · 87.5% calibration`} /></div>
        <div className="collection-choice"><span>{colorName(data.player.color)} · {playerIcons.find(icon => icon.id === style.icon)!.label}</span><button className="study-action" aria-pressed={selected === style.id} onClick={() => choose(style.id)}>{selected === style.id ? 'Selected ✓' : 'Choose this style'}</button></div>
      </article>;
    })}</div>
  </>;
}
export function ScorecardStudies() { return query.get('mode') === 'explore' || (query.has('seed') && query.get('mode') !== 'collection') ? <SeededScorecardStudies /> : <InkCollectionStudy />; }
