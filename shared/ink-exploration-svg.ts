import { normalizeColor } from './player-profile.js';
import type { ScorecardData } from './scorecard.js';
import { patternFrame } from '../src/components/interval/patterns.js';

const xml = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[character]!);
const mix = (a: string, b: string, amount: number) => '#' + [1, 3, 5].map(offset => Math.round(parseInt(a.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(b.slice(offset, offset + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
const luminance = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);

export function inkExplorationSvg(data: ScorecardData, phase: number): string {
  const design = data.design!;
  const accent = normalizeColor(data.player.color), light = '#f6f0e6', dark = '#201b1c';
  const background = design.surface === 'color field' ? accent : design.surface === 'color wash' ? mix(accent, light, .79) : design.surface === 'duotone' ? mix(accent, dark, .32) : mix(accent, dark, .75);
  const lum = luminance(background), ink = (luminance(light) + .05) / (lum + .05) >= (lum + .05) / (luminance(dark) + .05) ? light : dark;
  const muted = mix(background, ink, .76), line = mix(background, ink, .28);
  const font = design.type === 'serif' ? 'Georgia,serif' : design.type === 'mono' ? 'Courier New,monospace' : 'Arial,sans-serif';
  const score = Math.max(0, data.score).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const hitCount = data.hits.filter(Boolean).length, rate = data.hits.length ? `${Math.round(hitCount / data.hits.length * 1000) / 10}%` : '—';
  const text = (x: number, y: number, value: string, size: number, extra = '', fill = ink) => `<text x="${x}" y="${y}" fill="${fill}" font-family="${font}" font-size="${size}" ${extra}>${xml(value)}</text>`;
  const label = (x: number, y: number, value: string, extra = '') => text(x, y, value, 20, `letter-spacing="2" ${extra}`, muted);
  const metric = (x: number, y: number, value: string, name: string, size = 104) => text(x, y, value, Math.min(size, value.length > 7 ? 76 : size), 'letter-spacing="-3"') + label(x + 4, y + 38, name);
  const nameSize = data.player.username.length > 14 ? 46 : 70;
  let typography = '', patternX = 570, patternY = 310, baseScale = 10;
  switch (design.layout) {
    case 'poster':
      typography = text(64, 220, data.player.username, nameSize + 14) + metric(64, 492, score, 'POINTS', 112) + metric(546, 492, rate, 'CALIBRATION', 96);
      patternX = 650; patternY = 300; break;
    case 'split':
      typography = text(64, 215, data.player.username, nameSize) + metric(64, 374, score, 'POINTS', 96) + metric(64, 527, rate, 'CALIBRATION', 96);
      patternX = 725; patternY = 355; baseScale = 7; break;
    case 'spine':
      typography = text(0, 0, data.player.username, Math.min(nameSize, 390 / Math.max(1, data.player.username.length * .65)), 'transform="translate(110 550) rotate(-90)"') + metric(265, 329, score, 'POINTS', 116) + metric(505, 532, rate, 'CALIBRATION', 104);
      patternX = 560; patternY = 290; baseScale = 11; break;
    case 'band':
      typography = text(480, 320, data.player.username, nameSize + 10, 'text-anchor="middle"') + metric(64, 526, score, 'POINTS', 104) + metric(546, 526, rate, 'CALIBRATION', 96);
      patternX = 490; patternY = 235; baseScale = 13; break;
    case 'seal':
      typography = text(480, 356, data.player.username, nameSize, 'text-anchor="middle"') + metric(64, 523, score, 'POINTS', 104) + metric(546, 523, rate, 'CALIBRATION', 96);
      patternX = 480; patternY = 218; baseScale = 3.2; break;
    case 'index':
      typography = text(64, 178, data.player.username, nameSize - 14) + metric(64, 380, score, 'POINTS', 140) + metric(546, 534, rate, 'CALIBRATION', 100);
      patternX = 740; patternY = 325; baseScale = 9; break;
  }
  const scale = baseScale * design.scale;
  const treatment = design.surface === 'duotone' ? `<path d="M570 0H960V720H760L390 0Z" fill="${accent}" opacity=".45"/>`
    : design.surface === 'edge stripe' ? `<path d="M0 0H24V720H0Z" fill="${accent}"/><path d="M920 120V570" stroke="${accent}" stroke-width="12"/>`
    : design.surface === 'spotlight' ? `<ellipse cx="${patternX}" cy="${patternY}" rx="245" ry="245" fill="${accent}" opacity=".55"/>` : '';
  const furniture = design.layout === 'split' ? `<path d="M496 150V578" stroke="${line}"/>` : design.layout === 'band' ? `<path d="M0 229H960M0 350H960" stroke="${line}" stroke-width="2"/>` : design.layout === 'seal' ? `<circle cx="480" cy="218" r="110" fill="none" stroke="${line}"/>` : design.layout === 'spine' ? `<path d="M169 142V570" stroke="${line}"/>` : '';
  const marks = data.hits.map((hit, index) => `<rect x="${64 + index * 28}" y="630" width="16" height="16" rx="1" fill="${hit ? ink : 'none'}" stroke="${muted}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="${background}"/>
    ${treatment}${furniture}
    <g transform="translate(${patternX} ${patternY}) rotate(${design.angle}) scale(${scale}) translate(-32 -32)" color="${ink}" opacity="${design.layout === 'seal' ? '.64' : '.18'}">
      <g data-scorecard-pattern="" fill="none" stroke="currentColor" stroke-width=".65" stroke-linecap="round" stroke-linejoin="round">${patternFrame(data.player.icon, phase)}</g>
    </g>
    ${text(64, 86, '4σ', 42, 'letter-spacing="-3"')}${text(896, 77, data.practice ? `${data.label} · PRACTICE` : data.label, 17, 'text-anchor="end" letter-spacing="1"', muted)}
    ${typography}
    <path d="M64 600H896" stroke="${line}"/>
    ${marks}${text(896, 648, '4sig.xyz', 24, 'text-anchor="end"')}
    ${text(64, 683, `${hitCount} of ${data.hits.length} in range`, 18, '', muted)}${text(896, 683, 'A better sense of the world.', 17, 'text-anchor="end"', muted)}
  </svg>`;
}
