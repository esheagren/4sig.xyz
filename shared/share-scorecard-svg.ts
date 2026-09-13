import type { ScorecardData, ScorecardVariant } from './scorecard.js';
import { calibrationText } from './scorecard.js';
import { inkPalette } from './ink-exploration-svg.js';
import { normalizeColor, normalizeIcon } from './player-profile.js';
import { patternFrame } from '../src/components/interval/patterns.js';

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 360;
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/** A chat-sized composition, shared by the animated export and its still fallback. */
export function shareScorecardSvg(data: ScorecardData, variant: ScorecardVariant = 'ink', phase = .125): string {
  const design = data.design;
  const dark = variant === 'ink';
  const palette = design ? inkPalette(design, data.player.color) : {
    accent: normalizeColor(data.player.color), background: dark ? '#352a25' : '#f6f0e6',
    ink: dark ? '#f6f0e6' : '#352a25', muted: dark ? '#c5b8a8' : '#786b60', line: dark ? '#64554b' : '#d6c8b5',
  };
  const { accent, background, ink, muted, line } = palette;
  const red = ink === '#f6f0e6' ? '#e3977b' : '#ad4128';
  const score = Math.max(0, data.score).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const font = design && !design.collection && design.type === 'serif' ? 'Georgia,serif'
    : design && !design.collection && design.type === 'mono' ? 'Courier New,monospace' : 'Arial,sans-serif';
  const text = (x: number, y: number, value: string, size: number, extra = '', fill = ink) =>
    `<text x="${x}" y="${y}" fill="${fill}" font-family="${font}" font-size="${size}" ${extra}>${xml(value)}</text>`;
  const layout = design?.layout;
  const scale = (layout === 'horizon' || layout === 'band' ? 6 : 4) * Math.min(design?.scale ?? 1, 1.5);
  const treatment = design?.surface === 'duotone' ? `<path d="M805 0H1200V360H940Z" fill="${accent}" opacity=".45"/>`
    : design?.surface === 'edge stripe' ? `<path d="M0 0H10V360H0Z" fill="${accent}"/>`
    : design?.surface === 'spotlight' ? `<circle cx="995" cy="204" r="137" fill="${accent}" opacity=".5"/>` : '';
  const frame = layout === 'halo' || layout === 'seal' ? `<circle cx="995" cy="202" r="109" fill="none" stroke="${line}"/>`
    : layout === 'horizon' ? `<path d="M814 248H1160" stroke="${line}"/>`
    : layout === 'band' ? `<path d="M814 116H1160M814 279H1160" stroke="${line}"/>` : '';
  const marks = data.hits.map((hit, i) => `<rect x="${46 + i * 24}" y="315" width="12" height="12" rx="2" fill="${hit ? red : 'none'}" stroke="${hit ? red : muted}" stroke-width="2"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs><clipPath id="share-pattern-clip"><rect x="814" y="88" width="346" height="204"/></clipPath></defs>
    <rect width="1200" height="360" fill="${background}"/>${treatment}
    <text data-family-logo="" x="42" y="65" fill="${ink}" font-family="Georgia,serif" font-size="48" letter-spacing="-3">4<tspan fill="${red}">σ</tspan></text>
    ${text(146, 63, data.player.username, data.player.username.length > 16 ? 34 : 38)}
    ${text(1158, 61, data.practice ? `${data.label} · PRACTICE` : data.label, 23, 'text-anchor="end"', muted)}
    <path d="M42 88H1158" stroke="${line}"/>
    ${text(42, 236, score, score.length > 7 ? 92 : 118, 'letter-spacing="-4"')}
    ${text(46, 280, 'POINTS', 26, 'letter-spacing="2"', muted)}
    ${text(526, 236, calibrationText(data.hits), 102, 'letter-spacing="-3"')}
    ${text(530, 280, 'CALIBRATION', 24, 'letter-spacing="1.5"', muted)}
    <g clip-path="url(#share-pattern-clip)">${frame}
      <g transform="translate(995 202) rotate(${design?.angle ?? 0}) scale(${scale}) translate(-32 -32)" color="${ink}" opacity=".6">
        <g data-scorecard-pattern="" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round">${patternFrame(normalizeIcon(data.player.icon), phase)}</g>
      </g>
    </g>
    ${marks}${text(1158, 329, '4sig.xyz', 26, 'text-anchor="end"', muted)}
  </svg>`;
}
