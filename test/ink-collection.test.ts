import assert from 'node:assert/strict';
import test from 'node:test';
import { inkCollection, inkStyles, stylesForPattern } from '../shared/ink-collection.js';
import { playerIcons, playerColors } from '../shared/player-profile.js';
import { scorecardSvg } from '../shared/scorecard.js';

test('eight curated styles share one logo, type system, and palette while covering all player patterns', () => {
  const cards = inkCollection();
  assert.equal(cards.length, 8); assert.equal(new Set(inkStyles.map(style => style.id)).size, 8);
  assert.deepEqual(new Set(cards.map(card => card.player.icon)), new Set(playerIcons.map(icon => icon.id)));
  let logo = '';
  cards.forEach(card => {
    assert.ok(playerColors.some(color => color.value === card.player.color));
    assert.equal(card.design!.type, 'sans'); assert.equal(card.design!.collection, true);
    const svg = scorecardSvg(card), mark = svg.match(/<text data-family-logo=""[^>]*>4σ<\/text>/)![0];
    const shape = mark.replace(/fill="[^"]*"/, '');
    if (logo) assert.equal(shape, logo); else logo = shape;
    const withoutLogo = svg.replace(mark, '');
    for (const [, font] of withoutLogo.matchAll(/font-family="([^"]*)"/g)) assert.equal(font, 'Arial,sans-serif');
    assert.match(svg, /1,286.4/); assert.match(svg, /87.5%/);
    assert.notEqual(svg, scorecardSvg(card, 'ink', .31));
  });
  assert.deepEqual(cards.filter((_, index) => [0, 1, 3, 5].includes(index)).map(card => card.design!.layout), ['poster', 'band', 'split', 'index']);
});

test('every pattern has a matching style and preview choices change identity without changing the family', () => {
  for (const { id } of playerIcons) {
    const styles = stylesForPattern(id); assert.ok(styles.length);
    assert.ok(styles.every(style => inkStyles.find(entry => entry.id === style)!.icon === id));
  }
  assert.deepEqual(stylesForPattern('orbit'), ['orbit', 'halo']);
  assert.deepEqual(stylesForPattern('wave'), ['wave', 'horizon']);
  inkCollection('my_name', '#795078').forEach((card, index) => {
    assert.equal(card.player.username, 'my_name'); assert.equal(card.player.color, '#795078');
    assert.deepEqual(card.design, inkCollection()[index].design);
  });
});
