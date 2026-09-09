import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_URL, shareScorecard } from '../src/lib/share-scorecard.js';

test('native sharing prefers the animated file and explicitly includes the game URL; cancellation does not copy or download', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const png = new Blob(['png'], { type: 'image/png' }), gif = new Blob(['GIF89a'], { type: 'image/gif' });
  const sent: ShareData[] = [];
  let accepted = 'image/gif';
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    canShare: (data: ShareData) => data.files?.[0]?.type === accepted,
    share: async (data: ShareData) => { sent.push(data); },
  } });
  try {
    assert.equal(await shareScorecard(Promise.resolve(png), png, 'score https://4sig.xyz/share/123', gif), 'shared');
    assert.equal(sent[0].url, GAME_URL);
    assert.match(sent[0].text!, /\/share\/123/);
    assert.equal(sent[0].files?.[0].name, '4sigma-score.gif');
    assert.equal(await sent[0].files?.[0].text(), 'GIF89a');
    accepted = 'image/png';
    assert.equal(await shareScorecard(Promise.resolve(png), png, 'score', gif), 'shared');
    assert.equal(sent[1].files?.[0].name, '4sigma-score.png');
    navigator.share = async () => { throw new DOMException('Cancelled', 'AbortError'); };
    assert.equal(await shareScorecard(Promise.resolve(png), png, 'score', gif), 'cancelled');
    assert.equal(sent.length, 2);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('GIF-capable clipboards receive the animation, actual score and exact result URL in one item', async () => {
  const originals = ['navigator', 'ClipboardItem', 'FileReader'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let formats: Record<string, Blob | Promise<Blob>> = {};
  class FakeClipboardItem {
    static supports(type: string) { return type === 'image/gif'; }
    constructor(data: typeof formats) { formats = data; }
  }
  class FakeFileReader {
    result = 'data:image/gif;base64,R0lGODlh'; onload?: () => void;
    readAsDataURL() { this.onload?.(); }
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { write: async (items: unknown[]) => assert.equal(items.length, 1) } } });
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: FakeClipboardItem });
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: FakeFileReader });
  try {
    const png = new Blob(['PNG'], { type: 'image/png' }), gif = new Blob(['GIF89a-selected-halo'], { type: 'image/gif' });
    const url = 'https://4sig.xyz/share/real-score';
    assert.equal(await shareScorecard(Promise.resolve(png), png, 'real_player · 4321.5 pts · 50% calibration', gif, url), 'copied-gif');
    assert.equal(await (await formats['image/gif']).text(), 'GIF89a-selected-halo');
    const caption = await (await formats['text/plain']).text();
    assert.match(caption, /4321.5 pts/); assert.ok(caption.includes(url)); assert.ok(caption.includes(GAME_URL));
    const html = await (await formats['text/html']).text();
    assert.match(html, /data:image\/gif/); assert.match(html, /4321.5 pts/); assert.ok(html.includes(url));
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
