import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { pool } from '../api/_lib/db';
import { readGame } from '../api/_lib/session-storage';
import { answerInsight, reviewedAnswerInsights } from '../api/_lib/answer-insights';
import { citations } from '../src/components/interval/citations';
import { reviewInsight, reviewNumber, reviewRange } from '../src/components/interval/answer-review-data';
after(() => pool.end());

test('old saved games get fresh context only for revealed answers and keep their scoring snapshots', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = '490e4646-9fbe-42b6-9030-fb2eae2211e2';
    await client.query("INSERT INTO questions(id,question_text,answer_value,is_active) VALUES($1,'Genome cost',525,false)", [id]);
    const owner = (await client.query("INSERT INTO users(username) VALUES('ContextReview') RETURNING id")).rows[0].id;
    const game = (await client.query("INSERT INTO game_sessions(user_id,edition,is_ranked) VALUES($1,'2026-09-13',false) RETURNING id", [owner])).rows[0].id;
    const snapshot = {id, prompt: 'Genome cost', trueValue: 525, unit: 'USD', answerContext: 'Old generic prose.', source: 'Original benchmark', sourceUrl: 'https://www.genome.gov/'};
    await client.query('INSERT INTO game_questions(session_id,question_id,position,snapshot) VALUES($1,$2,0,$3)', [game,id,JSON.stringify(snapshot)]);
    const unrevealed = await readGame(game, owner, client);
    assert.deepEqual(unrevealed.judgements, []);
    assert.doesNotMatch(JSON.stringify(unrevealed), /14 million|answerInsight|answerContext|trueValue/);
    await client.query('INSERT INTO game_answers(session_id,question_id,lower_bound,upper_bound,score,captured) VALUES($1,$2,500,600,1234.5,true)', [game,id]);
    const revealed = (await readGame(game, owner, client)).judgements[0];
    assert.equal(revealed.answerContext, `${answerInsight(id)!.short} ${answerInsight(id)!.more}`);
    assert.deepEqual(revealed.answerInsight, answerInsight(id));
    assert.deepEqual([revealed.trueValue,revealed.lower,revealed.upper,revealed.score], [525,500,600,1234.5]);
    assert.equal(revealed.sourceUrl, snapshot.sourceUrl);
    assert.deepEqual((await client.query('SELECT snapshot FROM game_questions WHERE session_id=$1', [game])).rows[0].snapshot, snapshot);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('editorial context uses full question identity across both starting editions', () => {
  assert.equal(answerInsight('unrelated-000000000001'), undefined);
  for (let i = 1; i <= 10; i++) assert.ok(answerInsight(`40a00001-0000-4000-8000-${String(i).padStart(12,'0')}`)?.sources.length);
  assert.deepEqual(answerInsight('40a00002-0000-4000-8000-000000000002'), answerInsight('40a00001-0000-4000-8000-000000000003'));
  for (let i = 1; i <= 8; i++) assert.ok(answerInsight(`40a00002-0000-4000-8000-${String(i).padStart(12,'0')}`)?.sources.length);
});

test('the entire reviewed bank has substantive context and usable citations', () => {
  assert.equal(reviewedAnswerInsights.size, 43); // 25 daily + 10 original + 8 revised.
  for (const [id, insight] of reviewedAnswerInsights) {
    assert.ok(insight.short && insight.more, id);
    assert.ok(insight.short.split(/\s+/).length <= 32, id);
    assert.ok(insight.more.split(/\s+/).length <= 65, id);
    assert.deepEqual(
      citations(insight.sources.map(s => s.url).join(';'), insight.sources.map(s => s.label).join(';')),
      insight.sources.map(s => ({url: new URL(s.url).href, label: s.label})), id,
    );
  }
  assert.equal(answerInsight('490e4646-9fbe-42b6-9030-fb2eae2211e2'), answerInsight('40a00002-0000-4000-8000-000000000007'));
  for (const id of ['1e15c9c3-bb3d-4ce2-b9f9-11e1771ad95b', 'f913e918-ec5b-493c-a53a-3898d0d8c7c9', '2597594b-ea42-433c-a4c1-09ccc577db68', 'bf6193f7-e025-4c82-9951-886cd1f205f4']) assert.ok(answerInsight(id));
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
