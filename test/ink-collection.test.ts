import assert from 'node:assert/strict';
import test from 'node:test';
import { inkCollection, inkStyles, stylesForPattern, playerScorecard } from '../shared/ink-collection.js';
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

test('real scorecards preserve results and selected colors in every family composition', () => {
  for (const style of inkStyles) {
    const card = playerScorecard({ player: { username: 'real_player', icon: style.icon, color: '#795078', style: style.id },
      score: 4321.5, hits: [true, false, true, false], label: '2026-09-09', practice: true });
    assert.equal(card.design!.layout, style.layout);
    assert.equal(card.player.color, '#795078');
    const svg = scorecardSvg(card);
    assert.match(svg, /4,321.5/); assert.match(svg, /50%/); assert.match(svg, /real_player/);
    assert.doesNotMatch(svg, /1,286.4/);
  }
  const legacy = playerScorecard({ player: { username: 'legacy', icon: 'wave', color: '#355c9b' }, score: 10, hits: [true], label: 'test' });
  assert.equal(legacy.design!.layout, 'band');
});
