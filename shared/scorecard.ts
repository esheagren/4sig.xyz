import { normalizeColor, normalizeIcon, type Player } from './player-profile.js';
import { patternFrame } from '../src/components/interval/patterns.js';

export type ScorecardVariant = 'paper' | 'ink' | 'emblem';
export type ScorecardData = { player: Player; score: number; hits: boolean[]; label: string; practice?: boolean };
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
export const calibrationText = (hits: boolean[]) => hits.length ? `${Math.round(hits.filter(Boolean).length / hits.length * 1000) / 10}%` : '—';

/** One self-contained SVG for the live card, exported PNG/GIF and design studies. */
export function scorecardSvg(data: ScorecardData, variant: ScorecardVariant = 'ink', phase = .125): string {
  const dark = variant === 'ink', emblem = variant === 'emblem';
  const paper = dark ? '#352a25' : '#f6f0e6', ink = dark ? '#f6f0e6' : '#352a25';
  const muted = dark ? '#c5b8a8' : '#786b60', line = dark ? '#64554b' : '#d6c8b5';
  const chosenColor = normalizeColor(data.player.color), icon = normalizeIcon(data.player.icon);
  // Lift dark identity colors so every pattern remains visible on Ink.
  const color = dark ? '#' + chosenColor.slice(1).match(/../g)!.map(channel =>
    Math.round(parseInt(channel, 16) * .65 + 255 * .35).toString(16).padStart(2, '0')).join('') : chosenColor;
  const score = Math.max(0, data.score).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const rate = calibrationText(data.hits), count = data.hits.filter(Boolean).length;
  const pattern = `<g data-scorecard-pattern="" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round">${patternFrame(icon, phase)}</g>`;
  const marks = data.hits.map((hit, i) => `<rect x="${64 + i * 30}" y="626" width="18" height="18" rx="2" fill="${hit ? ink : 'none'}" stroke="${hit ? ink : muted}" stroke-width="2"/>`).join('');
  const metricY = emblem ? 550 : 418, labelY = emblem ? 592 : 466;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
  <rect width="960" height="720" rx="16" fill="${paper}"/>
  <rect x="1" y="1" width="958" height="718" rx="15" fill="none" stroke="${line}" stroke-width="2"/>
  ${emblem ? `<circle cx="480" cy="220" r="119" fill="none" stroke="${color}" stroke-opacity=".3" stroke-width="2"/><g transform="translate(378 118) scale(3.1875)" color="${color}">${pattern}</g>` : `<g transform="translate(360 30) scale(11)" color="${color}" opacity="${dark ? '.48' : '.17'}">${pattern}</g>`}
  <text x="64" y="88" fill="${ink}" font-family="Georgia,serif" font-size="48" letter-spacing="-4">4<tspan fill="${dark ? '#d8977e' : '#ad4128'}">σ</tspan></text>
  <text x="896" y="80" text-anchor="end" fill="${muted}" font-family="Arial,sans-serif" font-size="19" letter-spacing="1.5">${escape(data.practice ? `${data.label} · PRACTICE` : data.label)}</text>
  <text x="${emblem ? 480 : 64}" y="${emblem ? 385 : 235}" ${emblem ? 'text-anchor="middle"' : ''} fill="${ink}" font-family="Georgia,serif" font-size="${data.player.username.length > 16 ? 44 : 52}">${escape(data.player.username)}</text>
  <text x="64" y="${metricY}" fill="${ink}" font-family="Georgia,serif" font-size="${score.length > 7 ? 84 : 108}" letter-spacing="-4">${escape(score)}</text>
  <text x="534" y="${metricY}" fill="${ink}" font-family="Georgia,serif" font-size="108" letter-spacing="-4">${rate}</text>
  <text x="68" y="${labelY}" fill="${muted}" font-family="Arial,sans-serif" font-size="20" letter-spacing="3">POINTS</text>
  <text x="539" y="${labelY}" fill="${muted}" font-family="Arial,sans-serif" font-size="20" letter-spacing="3">CALIBRATION</text>
  ${emblem ? '' : `<text x="64" y="528" fill="${muted}" font-family="Arial,sans-serif" font-size="22">${count} of ${data.hits.length} in range</text><text x="539" y="528" fill="${muted}" font-family="Arial,sans-serif" font-size="22">Aim for 95% over time</text>`}
  <path d="M64 600H896" stroke="${line}" stroke-width="1"/>
  ${marks}
  <text x="896" y="646" text-anchor="end" fill="${ink}" font-family="Arial,sans-serif" font-size="24">4sig.xyz</text>
  <text x="64" y="683" fill="${muted}" font-family="Arial,sans-serif" font-size="17">${emblem ? `${count} of ${data.hits.length} in range · ` : ''}A better sense of the world.</text>
  </svg>`;
}
