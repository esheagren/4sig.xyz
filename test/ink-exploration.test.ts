import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_INK_SEED, inkExplorations, inkLayouts, inkSurfaces, normalizeInkSeed } from '../shared/ink-exploration.js';
import { playerIcons } from '../shared/player-profile.js';
import { scorecardSvg } from '../shared/scorecard.js';
import { scorecardStudy } from '../shared/scorecard-study.js';

test('seeded Ink explorations reproduce exactly and cover every animation, palette, layout and surface', () => {
  for (const seed of [INITIAL_INK_SEED, 'AAAAAAAAAAAA', '000000000000', 'ZZZZZZZZZZZZ', 'AB12CD34EF56']) {
    const cards = inkExplorations(seed);
    assert.deepEqual(cards, inkExplorations(seed));
    assert.deepEqual(cards.map(card => card.player.icon), playerIcons.map(icon => icon.id));
    assert.equal(new Set(cards.map(card => card.player.color)).size, 6);
    assert.deepEqual(new Set(cards.map(card => card.design!.layout)), new Set(inkLayouts));
    assert.deepEqual(new Set(cards.map(card => card.design!.surface)), new Set(inkSurfaces));
    for (const card of cards) {
      const svg = scorecardSvg(card);
      assert.match(svg, /1,286.4/); assert.match(svg, /87.5%/);
      assert.equal((svg.match(/data-scorecard-pattern=/g) ?? []).length, 1);
      assert.notEqual(svg, scorecardSvg(card, 'ink', .4));
      assert.doesNotMatch(svg, /NaN|undefined/);
    }
  }
});

test('each seed pair changes only its assigned decision; color and name overrides retain the experiment', () => {
  const original = inkExplorations(INITIAL_INK_SEED);
  const fields = ['color', 'layout', 'surface', 'scale', 'type', 'angle'] as const;
  fields.forEach((field, index) => {
    const seed = INITIAL_INK_SEED.slice(0, index * 2) + 'ZZ' + INITIAL_INK_SEED.slice(index * 2 + 2);
    const changed = inkExplorations(seed);
    assert.notDeepEqual(changed.map(card => field === 'color' ? card.player.color : card.design![field]), original.map(card => field === 'color' ? card.player.color : card.design![field]));
    for (const other of fields.filter(value => value !== field))
      assert.deepEqual(changed.map(card => other === 'color' ? card.player.color : card.design![other]), original.map(card => other === 'color' ? card.player.color : card.design![other]));
  });
  const custom = inkExplorations(INITIAL_INK_SEED, 'my_name', '#795078');
  custom.forEach((card, index) => { assert.equal(card.player.username, 'my_name'); assert.equal(card.player.color, '#795078'); assert.deepEqual(card.design, original[index].design); });
  assert.equal(normalizeInkSeed('bad'), INITIAL_INK_SEED);
  assert.equal(normalizeInkSeed('ab12cd34ef56'), 'AB12CD34EF56');
  assert.match(scorecardSvg(scorecardStudy), /fill="#352a25"/);
  assert.equal(scorecardStudy.design, undefined);
});
