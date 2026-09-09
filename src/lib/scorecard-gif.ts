import { scorecardSvg, type ScorecardData, type ScorecardVariant } from '../../shared/scorecard';
import { drawScorecardFrame } from './share-scorecard';

/** Stream frames through a worker, keeping only one uncompressed frame in memory. */
export async function scorecardGif(data: ScorecardData, signal: AbortSignal, variant?: ScorecardVariant): Promise<Blob> {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./scorecard-gif.worker.ts', import.meta.url), { type: 'module' });
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 720;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { worker.terminate(); throw new Error('Could not prepare animation.'); }
  const stop = () => worker.terminate();
  signal.addEventListener('abort', stop, { once: true });
  try {
    for (let frame = 0; frame < 160; frame++) {
      signal.throwIfAborted();
      await drawScorecardFrame(context, scorecardSvg(data, variant, .125 + frame / 160));
      signal.throwIfAborted();
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const bytes = await new Promise<Uint8Array<ArrayBuffer> | undefined>((resolve, reject) => {
        const aborted = () => { cleanup(); reject(signal.reason); };
        const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', aborted); worker.onmessage = null; worker.onerror = null; };
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Animation took too long. Please try again.')); }, 10000);
        signal.addEventListener('abort', aborted, { once: true });
        worker.onmessage = ({ data: result }) => { cleanup(); if (result.error) reject(new Error(result.error)); else resolve(result.bytes); };
        worker.onerror = () => { cleanup(); reject(new Error('Could not prepare animation.')); };
        worker.postMessage({ rgba, width: canvas.width, height: canvas.height, last: frame === 159 }, [rgba.buffer]);
      });
      if (bytes) return new Blob([bytes], { type: 'image/gif' });
    }
    throw new Error('Could not prepare animation.');
  } finally { signal.removeEventListener('abort', stop); worker.terminate(); }
}
