import { scorecardSvg, type ScorecardData, type ScorecardVariant } from '../../shared/scorecard';

export async function drawScorecardFrame(context: CanvasRenderingContext2D, svg: string): Promise<void> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not prepare scorecard.')); image.src = url; });
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(image, 0, 0, context.canvas.width, context.canvas.height);
  } finally { URL.revokeObjectURL(url); }
}

export async function scorecardPng(data: ScorecardData, variant?: ScorecardVariant): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1440;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare scorecard.');
  await drawScorecardFrame(context, scorecardSvg(data, variant));
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare scorecard.')), 'image/png'));
}

export const GAME_URL = 'https://4sig.xyz/';
export function saveScorecard(blob: Blob): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = blob.type === 'image/gif' ? '4sigma-score.gif' : '4sigma-score.png';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
});
export type ShareOutcome = 'copied' | 'shared' | 'downloaded-linked' | 'downloaded' | 'cancelled';
export async function shareScorecard(png: Promise<Blob>, ready: Blob | null, text: string, gif: Blob | null = null): Promise<ShareOutcome> {
  const caption = `${text}\nPlay: ${GAME_URL}`;
  // Native sharing takes the animated file and URL together. Keep it inside the click's activation.
  if (navigator.share && navigator.canShare) {
    for (const blob of [gif, ready]) {
      if (!blob) continue;
      const file = new File([blob], blob.type === 'image/gif' ? '4sigma-score.gif' : '4sigma-score.png', { type: blob.type });
      const payload = { title: '4σ', text, url: GAME_URL, files: [file] };
      if (navigator.canShare(payload)) {
        try { await navigator.share(payload); return 'shared'; }
        catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
        break;
      }
    }
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      // Rich-text editors can paste both parts. Image-only destinations choose PNG;
      // text-only destinations choose the caption, including the score and game links.
      const html = png.then(dataUrl).then(src => new Blob([
        `<p><img src="${src}" alt="4σ scorecard" width="480" height="360"></p><p><a href="${GAME_URL}">${GAME_URL}</a></p>`,
      ], { type: 'text/html' }));
      void html.catch(() => {});
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png, 'text/plain': new Blob([caption], { type: 'text/plain' }), 'text/html': html })]);
      return 'copied';
    } catch { /* Save the GIF and copy its accompanying link when image copying is unavailable. */ }
  }
  let linked = false;
  try { await navigator.clipboard.writeText(caption); linked = true; } catch { /* The explicit Copy link control remains available. */ }
  saveScorecard(gif ?? await png);
  return linked ? 'downloaded-linked' : 'downloaded';
}
