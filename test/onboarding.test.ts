import test from 'node:test';
import assert from 'node:assert/strict';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import auth from '../api/auth.ts';
import session from '../api/session.ts';
import { query } from '../api/_lib/db.ts';
import { startGame } from '../api/_lib/session-storage.ts';
import { onboardingQuestions as legacyQuestions, ONBOARDING_VERSION as legacyVersion } from '../api/_lib/onboarding-data-v1.ts';
import { onboardingQuestions } from '../api/_lib/onboarding-data.ts';

type Browser = { cookie?: string; ip: string };
async function call(handler: typeof session, path: string, browser: Browser, body: unknown = {}, method = 'POST') {
  let status = 200;
  let data: ReturnType<typeof JSON.parse>;
  const response = {
    setHeader(key: string, value: string) {
      if (key.toLowerCase() === 'set-cookie') {
        const pair = value.split(';')[0];
        browser.cookie = [...(browser.cookie?.split('; ') ?? []).filter(c => c.split('=')[0] !== pair.split('=')[0]), pair].join('; ');
      }
      return response;
    },
    status(value: number) { status = value; return response; },
    json(value: unknown) { data = value; return response; },
    end() { return response; },
  };
  await handler({ url: path, body, method, query: {}, headers: { host: 'localhost', cookie: browser.cookie }, socket: { remoteAddress: browser.ip } } as unknown as VercelRequest, response as unknown as VercelResponse);
  return { status, data };
}

test('first-eight release has explicit definitions and supported, bounded reference values', () => {
  assert.equal(onboardingQuestions.length, 8);
  assert.equal(new Set(onboardingQuestions.map(q => q.id)).size, 8);
  for (const q of onboardingQuestions) {
    assert.ok(q.trueValue > 0 && q.trueValue <= (q.max ?? Infinity));
    assert.ok(q.sourceUrl?.startsWith('https://'));
    assert.ok(q.observationPeriod && q.answerContext && q.topic);
    assert.ok(q.glossary?.length);
    for (const term of q.glossary!) {
      assert.ok(q.prompt.slice(term.start, term.end).length > 0);
      assert.ok(term.definition.length <= 450);
    }
  }
});

test('two phones on the same network cannot resume or finalize each other’s scorecards', async () => {
  const firstPhone: Browser = { ip: 'shared-phone-network' };
  const secondPhone: Browser = { ip: 'shared-phone-network' };
  const freshPhone: Browser = { ip: 'shared-phone-network' };
  const first = await call(session, '/api/session/start', firstPhone);
  const second = await call(session, '/api/session/start', secondPhone);
  assert.notEqual(first.data.sessionId, second.data.sessionId);
  assert.notEqual(firstPhone.cookie, secondPhone.cookie);
  for (const question of first.data.questions) {
    assert.equal((await call(session, '/api/session/answer', firstPhone, {
      sessionId: first.data.sessionId, questionId: question.id, lower: 0, upper: 1,
    })).status, 200);
  }
  await call(auth, '/api/auth/claim-username', firstPhone, { username: 'IsolationPhoneA' });
  await call(auth, '/api/auth/profile', firstPhone, { avatarIcon: 'wave', avatarColor: '#276c66' });
  const completed = await call(session, '/api/session/finalize', firstPhone, { sessionId: first.data.sessionId });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.share.player.username, 'IsolationPhoneA');

  // A copied local resume ID is not a credential, before or after claiming a name.
  for (const phone of [secondPhone, freshPhone]) {
    const resumed = await call(session, '/api/session/start', phone, { resumeId: first.data.sessionId });
    assert.equal(resumed.status, 200);
    assert.notEqual(resumed.data.sessionId, first.data.sessionId);
    assert.deepEqual(resumed.data.judgements, []);
    assert.equal(resumed.data.completed, false);
    assert.equal((await call(auth, '/api/auth/me', phone, {}, 'GET')).data.user.isAnonymous, true);
  }
  await call(auth, '/api/auth/claim-username', secondPhone, { username: 'IsolationPhoneB' });
  await call(auth, '/api/auth/profile', secondPhone, { avatarIcon: 'orbit', avatarColor: '#ad4128' });
  const resumed = await call(session, '/api/session/start', secondPhone, { resumeId: first.data.sessionId, playDaily: true });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.data.sessionId, second.data.sessionId);
  assert.deepEqual(resumed.data.judgements, []);
  assert.equal((await call(session, '/api/session/finalize', secondPhone, { sessionId: first.data.sessionId })).status, 404);
  assert.equal((await call(auth, '/api/auth/me', secondPhone, {}, 'GET')).data.user.displayName, 'IsolationPhoneB');
  assert.equal((await call(session, '/api/session/start', firstPhone)).data.sessionId, first.data.sessionId);
});

test('first visit plays five shared daily questions, then claims a name and saves the score', async () => {
  const browser: Browser = { ip: 'daily-first' }, peer: Browser = { ip: 'daily-peer' };
  const before = (await query('SELECT count(*)::int n FROM users')).rows[0].n;
  const first = await call(session, '/api/session/start', browser, {onboarding:true});
  assert.equal(first.status, 200);
  assert.equal(first.data.kind, 'daily');
  assert.equal(first.data.showIntro, true);
  assert.equal(first.data.questions.length, 5);
  assert.equal((await query('SELECT count(*)::int n FROM users')).rows[0].n, before);
  assert.doesNotMatch(JSON.stringify(first.data), /trueValue|answerContext|answerInsight|sourceUrl|"hit"|"score"/);
  const other = await call(session, '/api/session/start', peer);
  assert.deepEqual(other.data.questions, first.data.questions);
  assert.equal((await call(session, '/api/session/finalize', browser, {sessionId:first.data.sessionId})).status, 401);
  for (const [i,q] of first.data.questions.entries()) {
    const saved = await call(session, '/api/session/answer', browser, {sessionId:first.data.sessionId,questionId:q.id,lower:0,upper:1e100});
    assert.equal(saved.status,200);
    assert.equal(saved.data.judgement.questionId,q.id);
    assert.equal(typeof saved.data.judgement.trueValue,'number');
    assert.equal(saved.data.savedAnswers.length,i+1);
    const resumed = await call(session,'/api/session/start',browser);
    assert.equal(resumed.data.sessionId,first.data.sessionId);
    assert.equal(resumed.data.showIntro,false);
    assert.equal(resumed.data.judgements.length,i+1);
    assert.doesNotMatch(JSON.stringify(resumed.data.questions),/trueValue|answerContext|answerInsight|sourceUrl/);
  }
  await call(auth,'/api/auth/claim-username',browser,{username:'FirstDailyPlayer'});
  assert.equal((await call(session,'/api/session/finalize',browser,{sessionId:first.data.sessionId})).status,409);
  await call(auth,'/api/auth/profile',browser,{avatarIcon:'wave',avatarColor:'#276c66'});
  const finished = await call(session,'/api/session/finalize',browser,{sessionId:first.data.sessionId});
  assert.equal(finished.status,200);
  assert.equal(finished.data.share.kind,'daily');
  assert.equal(finished.data.judgements.length,5);
  assert.equal(finished.data.dailyStats.personalDailyGames,1);
  const user = (await call(auth,'/api/auth/me',browser,{},'GET')).data.user;
  assert.equal(user.gamesPlayed,1);
  assert.equal(user.questionsAnswered,5);
  assert.equal(user.onboarding,null);
  assert.equal(user.totalScore,finished.data.score);
  assert.equal((await call(session,'/api/session/start',browser)).data.sessionId,first.data.sessionId);
  await call(auth,'/api/auth/claim-account',browser,{email:'firstdaily@example.invalid',password:'A-long-test-password-123'});
  // An older game is history, so a new daily session skips the intro even on another device.
  await query("UPDATE game_sessions SET edition='2000-01-01' WHERE id=$1",[first.data.sessionId]);
  const returning: Browser = {ip:'daily-new-device'};
  await call(auth,'/api/auth/login',returning,{email:'firstdaily@example.invalid',password:'A-long-test-password-123'});
  const nextDay = await call(session,'/api/session/start',returning);
  assert.equal(nextDay.data.kind,'daily');
  assert.equal(nextDay.data.showIntro,false);
  assert.notEqual(nextDay.data.sessionId,first.data.sessionId);
  assert.equal(nextDay.data.questions.length,5);
  const practice = await call(session,'/api/session/start',returning,{practice:true});
  assert.equal(practice.data.showIntro,false);
  assert.equal(practice.data.isRanked,false);
});

test('previous ten-question games retain their answers and can still be completed and reviewed', async () => {
  const browser: Browser = { ip: 'onboarding-legacy' };
  await call(auth, '/api/auth/claim-username', browser, { username: 'LegacyBaseline' });
  await call(auth, '/api/auth/profile', browser, { avatarIcon: 'wave', avatarColor: '#276c66' });
  const userId = (await query("SELECT id FROM users WHERE username='LegacyBaseline'")).rows[0].id;
  const original = await startGame(userId, '2000-01-01', legacyQuestions, false, 'onboarding', legacyVersion);
  for (const q of legacyQuestions.slice(0, 8)) {
    assert.equal((await call(session, '/api/session/answer', browser, {
      sessionId: original.sessionId, questionId: q.id, lower: 0, upper: q.max ?? 1000,
    })).status, 200);
  }
  const resumed = await call(session, '/api/session/start', browser, {resumeId:original.sessionId});
  assert.equal(resumed.data.sessionId, original.sessionId);
  assert.equal(resumed.data.questions.length, 10);
  assert.equal(resumed.data.savedAnswers.length, 8);
  assert.deepEqual(resumed.data.questions.map((q: { id: string }) => q.id), legacyQuestions.map(q => q.id));
  assert.equal((await call(session, '/api/session/finalize', browser, { sessionId: original.sessionId })).status, 409);
  for (const q of legacyQuestions.slice(8)) await call(session, '/api/session/answer', browser, {
    sessionId: original.sessionId, questionId: q.id, lower: 0, upper: q.max ?? 1000,
  });
  const completed = await call(session, '/api/session/finalize', browser, { sessionId: original.sessionId });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.judgements.length, 10);
  assert.ok(completed.data.judgements[0].answerInsight.short);
  const user = (await call(auth, '/api/auth/me', browser, {}, 'GET')).data.user;
  assert.equal(user.onboarding.count, 10);
  assert.equal(user.onboarding.hits, 10);
  assert.equal(user.questionsAnswered, 10);
  const daily = await call(session, '/api/session/start', browser);
  assert.equal(daily.data.kind, 'daily');
  assert.equal(daily.data.showIntro, false);
  const review = await call(session, '/api/session/start', browser, {onboarding:true});
  assert.equal(review.data.sessionId, original.sessionId);
  assert.equal(review.data.completed, true);
  assert.equal(review.data.dailyAvailable, true);
});

test('untouched legacy introductions open daily play without rewriting old snapshots', async () => {
  const browser: Browser = {ip:'untouched-legacy'};
  const fresh = (await call(session,'/api/session/start',browser)).data;
  const row = (await query('SELECT guest_session_hash FROM game_sessions WHERE id=$1',[fresh.sessionId])).rows[0];
  const original = await startGame(`guest:${row.guest_session_hash}`,'2000-01-01',legacyQuestions,false,'onboarding',legacyVersion);
  const resumed = await call(session,'/api/session/start',browser,{resumeId:original.sessionId});
  assert.equal(resumed.data.kind,'daily');
  assert.equal(resumed.data.showIntro,true, 'an unopened legacy introduction has not taught the controls');
  assert.equal(resumed.data.questions.length,5);
  assert.equal((await query('SELECT count(*)::int n FROM game_questions WHERE session_id=$1',[original.sessionId])).rows[0].n,10);
  assert.equal((await query('SELECT count(*)::int n FROM game_answers WHERE session_id=$1',[original.sessionId])).rows[0].n,0);
});

test('a finished guest daily game can be claimed across midnight without losing answers', async () => {
  const browser: Browser = {ip:'midnight-claim'};
  const game = (await call(session,'/api/session/start',browser)).data;
  for (const q of game.questions) await call(session,'/api/session/answer',browser,{sessionId:game.sessionId,questionId:q.id,lower:0,upper:1e100});
  await query("UPDATE game_sessions SET edition='2000-02-01' WHERE id=$1",[game.sessionId]);
  const resumed = await call(session,'/api/session/start',browser,{resumeId:game.sessionId});
  assert.equal(resumed.data.sessionId,game.sessionId);
  assert.equal(resumed.data.judgements.length,5);
  assert.equal(resumed.data.showIntro,false);
  await call(auth,'/api/auth/claim-username',browser,{username:'MidnightDaily'});
  await call(auth,'/api/auth/profile',browser,{avatarIcon:'orbit',avatarColor:'#ad4128'});
  const attached = await call(session,'/api/session/start',browser,{resumeId:game.sessionId});
  assert.equal(attached.data.sessionId,game.sessionId);
  const finished = await call(session,'/api/session/finalize',browser,{sessionId:game.sessionId});
  assert.equal(finished.status,200);
  assert.equal(finished.data.totalQuestions,5);
  assert.equal(finished.data.edition,'2000-02-01');
  const today = await call(session,'/api/session/start',browser);
  assert.notEqual(today.data.sessionId,game.sessionId);
  assert.equal(today.data.showIntro,false);
});
