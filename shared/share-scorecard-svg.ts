import type { ScorecardData, ScorecardVariant } from './scorecard.js';
import { calibrationText } from './scorecard.js';
import { inkPalette } from './ink-exploration-svg.js';
import { normalizeColor, normalizeIcon } from './player-profile.js';
import { patternFrame } from '../src/components/interval/patterns.js';

// Match the compact landscape shape used by messaging previews, without squeezing artwork.
export const SHARE_CARD_WIDTH = 640;
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
  const editionLabel = data.practice ? `${data.label} · PRACTICE` : data.label;
  const longLabel = editionLabel.length > 10;
  const font = design && !design.collection && design.type === 'serif' ? 'Georgia,serif'
    : design && !design.collection && design.type === 'mono' ? 'Courier New,monospace' : 'Arial,sans-serif';
  const text = (x: number, y: number, value: string, size: number, extra = '', fill = ink) =>
    `<text x="${x}" y="${y}" fill="${fill}" font-family="${font}" font-size="${size}" ${extra}>${xml(value)}</text>`;
  const layout = design?.layout;
  const scale = (layout === 'horizon' || layout === 'band' ? 2.6 : 1.9) * Math.min(design?.scale ?? 1, 1.25);
  const treatment = design?.surface === 'duotone' ? `<path d="M452 0H640V360H554Z" fill="${accent}" opacity=".45"/>`
    : design?.surface === 'edge stripe' ? `<path d="M0 0H6V360H0Z" fill="${accent}"/>`
    : design?.surface === 'spotlight' ? `<circle cx="555" cy="174" r="74" fill="${accent}" opacity=".5"/>` : '';
  const frame = layout === 'halo' || layout === 'seal' ? `<circle cx="555" cy="174" r="52" fill="none" stroke="${line}"/>`
    : layout === 'horizon' ? `<path d="M494 211H612" stroke="${line}"/>`
    : layout === 'band' ? `<path d="M494 118H612M494 231H612" stroke="${line}"/>` : '';
  const marks = data.hits.map((hit, i) => `<rect x="${30 + i * 22}" y="307" width="11" height="11" rx="2" fill="${hit ? red : 'none'}" stroke="${hit ? red : muted}" stroke-width="2"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs><clipPath id="share-pattern-clip"><rect x="494" y="94" width="118" height="151"/></clipPath></defs>
    <rect width="640" height="360" fill="${background}"/>${treatment}
    <text data-family-logo="" x="28" y="53" fill="${ink}" font-family="Georgia,serif" font-size="36" letter-spacing="-2">4<tspan fill="${red}">σ</tspan></text>
    ${text(94, 49, data.player.username, data.player.username.length > 16 ? 20 : 24)}
    ${text(612, longLabel ? 347 : 47, editionLabel, longLabel ? 12 : 14, 'text-anchor="end"', muted)}
    <path d="M28 76H612" stroke="${line}"/>
    <g clip-path="url(#share-pattern-clip)">${frame}
      <g transform="translate(555 174) rotate(${design?.angle ?? 0}) scale(${scale}) translate(-32 -32)" color="${ink}" opacity=".6">
        <g data-scorecard-pattern="" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round">${patternFrame(normalizeIcon(data.player.icon), phase)}</g>
      </g>
    </g>
    ${text(28, 190, score, score.length > 7 ? 54 : score.length > 6 ? 68 : 80, 'letter-spacing="-2"')}
    ${text(32, 230, 'POINTS', 20, 'letter-spacing="1.5"', muted)}
    ${text(314, 190, calibrationText(data.hits), 64, 'letter-spacing="-2"')}
    ${text(318, 230, 'CALIBRATION', 18, 'letter-spacing=".7"', muted)}
    <path d="M28 278H612" stroke="${line}"/>
    ${marks}${text(612, 322, '4sig.xyz', 18, 'text-anchor="end"', muted)}
  </svg>`;
}
