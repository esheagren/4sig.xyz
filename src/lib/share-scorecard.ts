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
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function shareCaption(text: string, url = GAME_URL): string {
  return `${text}${text.includes(url) ? '' : `\n${url}`}${url === GAME_URL || text.includes(`Play: ${GAME_URL}`) ? '' : `\nPlay: ${GAME_URL}`}`;
}
export type ShareOutcome = 'copied-gif' | 'copied-saved-gif' | 'copied' | 'shared' | 'downloaded-linked' | 'downloaded' | 'cancelled';
export async function shareScorecard(png: Promise<Blob>, ready: Blob | null, text: string, gif: Blob | null = null, url = GAME_URL): Promise<ShareOutcome> {
  const caption = shareCaption(text, url);
  // Native sharing takes the animated file and URL together. Keep it inside the click's activation.
  if (navigator.share && navigator.canShare) {
    for (const blob of [gif, ready]) {
      if (!blob) continue;
      const file = new File([blob], blob.type === 'image/gif' ? '4sigma-score.gif' : '4sigma-score.png', { type: blob.type });
      const payload = { title: '4σ', text: caption, url, files: [file] };
      if (navigator.canShare(payload)) {
        try { await navigator.share(payload); return 'shared'; }
        catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
        break;
      }
    }
  }
  return copyScorecard(png, text, gif, url);
}

/** Explicit Copy never opens the native share sheet. */
export async function copyScorecard(png: Promise<Blob>, text: string, gif: Blob | null = null, url = GAME_URL): Promise<ShareOutcome> {
  const caption = shareCaption(text, url);
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const canCopyGif = !!gif && typeof ClipboardItem.supports === 'function' && ClipboardItem.supports('image/gif');
      // One item carries image, score and URL, so each destination can choose its supported format.
      const html = Promise.resolve(gif ?? png).then(dataUrl).then(src => new Blob([
        `<p><img src="${src}" alt="4σ scorecard" width="480" height="360"></p><p>${escapeHtml(caption).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(url)}">View score · Play 4σ</a></p>`,
      ], { type: 'text/html' }));
      void html.catch(() => {});
      const formats: Record<string, Blob | Promise<Blob>> = { 'image/png': png,
        'text/plain': new Blob([caption], { type: 'text/plain' }), 'text/html': html };
      if (canCopyGif) formats['image/gif'] = gif!;
      await navigator.clipboard.write([new ClipboardItem(formats)]);
      if (canCopyGif) return 'copied-gif';
      // A PNG clipboard fallback cannot promise animation. Supply the actual GIF as a file too.
      if (gif) { saveScorecard(gif); return 'copied-saved-gif'; }
      return 'copied';
    } catch { /* Save the GIF and copy its accompanying link when image copying is unavailable. */ }
  }
  let linked = false;
  try { await navigator.clipboard.writeText(caption); linked = true; } catch { /* Show a selectable caption when clipboard access is unavailable. */ }
  saveScorecard(gif ?? await png);
  return linked ? 'downloaded-linked' : 'downloaded';
}
