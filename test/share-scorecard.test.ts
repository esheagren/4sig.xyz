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
