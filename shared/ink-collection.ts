import { normalizeStyle, type PlayerIcon } from './player-profile.js';
import type { InkDesign } from './ink-exploration.js';
import { scorecardStudy } from './scorecard-study.js';
import type { ScorecardData } from './scorecard.js';

/** A curated family. Composition varies; brand, typography and palette rules stay fixed. */
export const inkStyles = [
  { id: 'orbit', name: 'Orbit', icon: 'orbit', color: '#276c66', layout: 'poster', surface: 'duotone', scale: 1.7, angle: -9, description: 'An expansive orbit across a diagonal color field.' },
  { id: 'wave', name: 'Wave', icon: 'wave', color: '#916b25', layout: 'band', surface: 'edge stripe', scale: 1.2, angle: 9, description: 'A flowing wave with your name held between two fine rules.' },
  { id: 'spiral', name: 'Spiral', icon: 'spiral', color: '#ad4128', layout: 'split', surface: 'night tint', scale: 1.25, angle: 0, description: 'A growing curve beside a clear column of numbers.' },
  { id: 'pendulum', name: 'Pendulum', icon: 'pendulum', color: '#352a25', layout: 'split', surface: 'color wash', scale: 1, angle: 30, description: 'Warm paper, stacked numbers, and a measured swing.' },
  { id: 'bloom', name: 'Bloom', icon: 'bloom', color: '#795078', layout: 'halo', surface: 'night tint', scale: 1.05, angle: 0, description: 'A quiet field of plum, opening into a generous floral curve.' },
  { id: 'braid', name: 'Braid', icon: 'braid', color: '#355c9b', layout: 'index', surface: 'color field', scale: 1.45, angle: 0, description: 'Interwoven points with a bold, offset score.' },
  { id: 'halo', name: 'Halo', icon: 'orbit', color: '#276c66', layout: 'halo', surface: 'color wash', scale: 1.1, angle: -9, description: 'An Orbit companion: a pale field and a circular frame.' },
  { id: 'horizon', name: 'Horizon', icon: 'wave', color: '#355c9b', layout: 'horizon', surface: 'night tint', scale: 1, angle: 0, description: 'A Wave companion: one broad horizon above the numbers.' },
] as const satisfies readonly { id: string; name: string; icon: PlayerIcon; color: string; layout: InkDesign['layout']; surface: InkDesign['surface']; scale: number; angle: number; description: string }[];
export type InkStyleId = typeof inkStyles[number]['id'];
export function inkCollection(username = 'erik', color?: string): ScorecardData[] {
  return inkStyles.map(style => ({ ...scorecardStudy, player: { username: username || 'your_name', icon: style.icon, color: color ?? style.color },
    design: { seed: 'INK-FAMILY-01', collection: true, layout: style.layout, surface: style.surface, scale: style.scale, type: 'sans', angle: style.angle },
  }));
}
export function stylesForPattern(icon: PlayerIcon): InkStyleId[] { return inkStyles.filter(style => style.icon === icon).map(style => style.id); }

/** Apply the chosen composition to real results, without replacing any score data. */
export function playerScorecard(data: ScorecardData): ScorecardData {
  const style = inkStyles.find(item => item.id === normalizeStyle(data.player.style, data.player.icon))!;
  return { ...data, design: { seed: 'INK-FAMILY-01', collection: true, layout: style.layout,
    surface: style.surface, scale: style.scale, type: 'sans', angle: style.angle } };
}
