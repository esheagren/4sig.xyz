import { useMemo, useState } from 'react';
import { scorecardStudy } from '../../../shared/scorecard-study';
import { playerColors, playerIcons, type PlayerIcon } from '../../../shared/player-profile';
import { ScorecardShare } from './ScorecardShare';

const variants = [
  { id: 'ink', title: '01 · Ink', description: 'The current game card. Deep espresso, bright numbers, and a moving pattern.' },
  { id: 'paper', title: '02 · Paper', description: 'Warm paper with the same moving pattern and sharing controls.' },
  { id: 'emblem', title: '03 · Emblem', description: 'A personal seal above your name, points, and calibration.' },
] as const;

export function ScorecardStudies() {
  const [username, setUsername] = useState(scorecardStudy.player.username);
  const [icon, setIcon] = useState<PlayerIcon>(scorecardStudy.player.icon);
  const [color, setColor] = useState(scorecardStudy.player.color);
  const data = useMemo(() => ({ ...scorecardStudy, player: { username: username || 'your_name', icon, color } }), [username, icon, color]);
  return <>
    <div className="preview-controls" aria-label="Scorecard preview settings">
      <label>Name<input value={username} maxLength={20} onChange={event => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} /></label>
      <label>Pattern<select aria-label="Pattern" value={icon} onChange={event => setIcon(event.target.value as PlayerIcon)}>
        {playerIcons.map(pattern => <option key={pattern.id} value={pattern.id}>{pattern.label}</option>)}
      </select></label>
      <label>Color<select aria-label="Color" value={color} onChange={event => setColor(event.target.value)}>
        {playerColors.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
      </select></label>
    </div>
    <div className="studies">{variants.map(variant => <article key={variant.id} data-variant={variant.id}>
      <h2>{variant.title}</h2><p className="study-description">{variant.description}</p>
      <div className="interval-app study-card">
        <ScorecardShare data={data} variant={variant.id} text={`4σ · Designspace sample\n${data.player.username} · 1,286.4 points · 87.5% calibration`} />
      </div>
    </article>)}</div>
  </>;
}

