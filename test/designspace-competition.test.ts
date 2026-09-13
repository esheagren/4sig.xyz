import assert from 'node:assert/strict';
import test from 'node:test';
import { competitionValues } from '../src/designspace/competition-stats';

test('daily comparisons exclude self, count only strictly lower scores, and compare with the mean', () => {
  assert.deepEqual(competitionValues(1280, { dailyRank: 12, totalParticipantsToday: 128, playersBelowToday: 116, todaysAverage: 1000 }), { count: 128, rank: 12, percentile: 91, difference: 28 });
  assert.equal(competitionValues(1000, { dailyRank: 1, totalParticipantsToday: 20, playersBelowToday: 18 })?.percentile, 94, 'a tied winner has not beaten every peer');
  assert.equal(competitionValues(1000, { dailyRank: 1, totalParticipantsToday: 20, playersBelowToday: 0 })?.percentile, 0, 'everyone tied is not 100th percentile');
  assert.equal(competitionValues(1000, { dailyRank: 1, totalParticipantsToday: 20, playersBelowToday: 19 })?.percentile, 100);
  assert.equal(competitionValues(0, { dailyRank: 20, totalParticipantsToday: 20, playersBelowToday: 0, todaysAverage: 1000 })?.difference, -100);
});

test('sparse, missing, or inconsistent standings cannot invent a percentile', () => {
  assert.equal(competitionValues(100, null), null);
  assert.equal(competitionValues(100, { dailyRank: 3, totalParticipantsToday: 2 }), null);
  assert.equal(competitionValues(100, { dailyRank: 1, totalParticipantsToday: 1, playersBelowToday: 0 })?.percentile, null);
  assert.equal(competitionValues(100, { dailyRank: 1, totalParticipantsToday: 19, playersBelowToday: 18 })?.percentile, null);
  assert.equal(competitionValues(100, { dailyRank: 2, totalParticipantsToday: 20 })?.percentile, null);
  assert.equal(competitionValues(100, { dailyRank: 2, totalParticipantsToday: 20, playersBelowToday: 19 })?.percentile, null);
  assert.equal(competitionValues(0, { dailyRank: 1, totalParticipantsToday: 20, playersBelowToday: 0, todaysAverage: 0 })?.difference, null);
});
