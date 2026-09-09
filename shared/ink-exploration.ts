import { playerColors, playerIcons } from './player-profile.js';
import type { ScorecardData } from './scorecard.js';
import { scorecardStudy } from './scorecard-study.js';

export const INITIAL_INK_SEED = '1BMV6OZR1EBG';
export const inkLayouts = ['poster', 'split', 'spine', 'band', 'seal', 'index'] as const;
export const inkSurfaces = ['color field', 'night tint', 'color wash', 'duotone', 'edge stripe', 'spotlight'] as const;
export type InkDesign = { seed: string; layout: typeof inkLayouts[number] | 'halo' | 'horizon'; surface: typeof inkSurfaces[number]; scale: number; type: 'serif' | 'sans' | 'mono'; angle: number; collection?: boolean };
export const seedDecisions = ['Palette order', 'Layout order', 'Background treatment', 'Pattern scale', 'Typography', 'Pattern angle'];
export function normalizeInkSeed(value: string | null): string {
  const seed = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return seed.length === 12 ? seed : INITIAL_INK_SEED;
}
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items]; let state = seed + 1;
  for (let index = result.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const next = state % (index + 1); [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}
/** Each two-character base-36 value governs one dimension; permutations guarantee broad coverage. */
export function inkExplorations(rawSeed: string, username = 'erik', color?: string): ScorecardData[] {
  const seed = normalizeInkSeed(rawSeed), values = seed.match(/../g)!.map(pair => parseInt(pair, 36));
  const palettes = shuffle(playerColors, values[0]), layouts = shuffle(inkLayouts, values[1]);
  const surfaces = shuffle(inkSurfaces, values[2]), scales = shuffle([.85, 1, 1.2, 1.45, 1.7, 2], values[3]);
  const types = shuffle(['serif', 'sans', 'mono', 'serif', 'sans', 'mono'] as const, values[4]);
  const angles = shuffle([-18, -9, 0, 9, 18, 30], values[5]);
  return playerIcons.map((icon, index) => ({ ...scorecardStudy,
    player: { username: username || 'your_name', icon: icon.id, color: color ?? palettes[index].value },
    design: { seed, layout: layouts[index], surface: surfaces[index], scale: scales[index], type: types[index], angle: angles[index] },
  }));
}
