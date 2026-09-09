import { scorecardSvg, type ScorecardData, type ScorecardVariant } from '../../shared/scorecard';

export async function scorecardPng(data: ScorecardData, variant?: ScorecardVariant): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([scorecardSvg(data, variant)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not prepare scorecard.')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1440;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare scorecard.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare scorecard.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export type ShareOutcome = 'copied' | 'shared' | 'downloaded' | 'cancelled';
export async function shareScorecard(png: Promise<Blob>, ready: Blob | null, text: string): Promise<ShareOutcome> {
  // Use a pre-rendered file to keep native sharing inside the click's user activation.
  if (ready && navigator.share && navigator.canShare) {
    const file = new File([ready], '4sigma-score.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ title: '4σ', text, files: [file] }); return 'shared'; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
    }
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png, 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      return 'copied';
    } catch { /* Save the image when clipboard image access is unavailable. */ }
  }
  const blob = await png, url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = '4sigma-score.png'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
