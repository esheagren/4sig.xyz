import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const gif = GIFEncoder();
let palette: number[][] | undefined;
self.onmessage = ({ data }: MessageEvent<{ rgba: Uint8ClampedArray; width: number; height: number; last: boolean }>) => {
  try {
    const first = !palette;
    palette ??= quantize(data.rgba, 256);
    gif.writeFrame(applyPalette(data.rgba, palette), data.width, data.height,
      { ...(first ? { palette } : {}), delay: 100, repeat: 0 });
    if (data.last) { gif.finish(); const bytes = gif.bytes(); self.postMessage({ bytes }, { transfer: [bytes.buffer] }); }
    else self.postMessage({});
  } catch { self.postMessage({ error: 'Could not encode the animation.' }); }
};
