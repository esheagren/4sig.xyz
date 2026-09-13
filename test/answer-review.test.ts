import assert from 'node:assert/strict';
import test from 'node:test';
import { answerInsight } from '../api/_lib/answer-insights';
import { reviewInsight, reviewNumber, reviewRange } from '../src/components/interval/answer-review-data';

test('editorial context uses full question identity across both starting editions', () => {
  assert.equal(answerInsight('unrelated-000000000001'), undefined);
  assert.equal(answerInsight('40a00001-0000-4000-8000-000000000002'), undefined);
  assert.deepEqual(answerInsight('40a00002-0000-4000-8000-000000000002'), answerInsight('40a00001-0000-4000-8000-000000000003'));
  for (let i = 1; i <= 8; i++) assert.ok(answerInsight(`40a00002-0000-4000-8000-${String(i).padStart(12,'0')}`)?.sources.length);
});

test('daily context preserves decimals and supplied editorial text', () => {
  assert.deepEqual(reviewInsight('The share rose 2.4%. It reached 30%. Another fact.'), { short: 'The share rose 2.4%.', more: 'It reached 30%. Another fact.', sources: [] });
  assert.equal(reviewInsight('').short, 'Sources');
  const supplied = answerInsight('40a00002-0000-4000-8000-000000000001');
  assert.equal(reviewInsight('old context', supplied), supplied);
});

test('review graphics retain position and meaningful labels across numeric scales', () => {
  for (const scale of [1e-100, 1e-8, 1, 1e8, 1e98]) {
    assert.deepEqual(Object.values(reviewRange(scale, 2*scale, 1.5*scale)).map(Math.round), [64,256,160]);
    assert.notEqual(reviewNumber(scale), '0');
    assert.ok(reviewNumber(scale).length < 16);
  }
  for (const values of [[0,0,0], [-1e100,1e100,0], [1778,1780,1776], [-10,-5,-20], [1,1,1]]) {
    const {l,u,a} = reviewRange(...values as [number,number,number]);
    assert.ok([l,u,a].every(v => Number.isFinite(v) && v >= 14 && v <= 306));
    assert.ok(l <= u);
  }
  assert.equal(reviewNumber(100), '100');
  assert.equal(reviewNumber(1.05e-9), '1.05e-9');
});
