import test from 'node:test';
import assert from 'node:assert/strict';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import auth from '../api/auth.ts';
import session from '../api/session.ts';
import { query } from '../api/_lib/db.ts';
import { execFileSync } from 'node:child_process';
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

test('first eight: per-answer reveal, ownership, cross-day resume, identity, daily gating and calibration', async () => {
  const browser: Browser = { ip: 'onboarding-first' };
  const outsider: Browser = { ip: 'onboarding-outsider' };
  const before = (await query('SELECT count(*)::int n FROM users')).rows[0].n;
  const first = await call(session, '/api/session/start', browser);
  assert.equal(first.status, 200);
  assert.equal(first.data.kind, 'onboarding');
  assert.equal(first.data.questions.length, 8);
  assert.equal((await query('SELECT count(*)::int n FROM users')).rows[0].n, before);
  assert.deepEqual(first.data.judgements, []);
  assert.doesNotMatch(JSON.stringify(first.data), /trueValue|answerContext|sourceUrl|"hit"|"score"/);
  const maritime = first.data.questions[3];
  assert.equal(maritime.prompt, 'What percentage of international trade in goods is carried by sea, by volume?');
  assert.equal(maritime.prompt.slice(maritime.glossary[0].start, maritime.glossary[0].end), 'by volume');
  assert.equal((await query('SELECT snapshot FROM game_questions WHERE session_id=$1 AND question_id=$2',
    [first.data.sessionId, maritime.id])).rows[0].snapshot.prompt, onboardingQuestions[3].prompt);
  await call(session, '/api/session/start', outsider);
  assert.equal((await call(session, '/api/session/answer', outsider, {
    sessionId: first.data.sessionId, questionId: first.data.questions[0].id, lower: 0, upper: 100,
  })).status, 404);
  assert.equal((await call(session, '/api/session/answer', browser, {
    sessionId: first.data.sessionId, questionId: first.data.questions[1].id, lower: 0, upper: 100,
  })).status, 409);
  for (let i = 0; i < 8; i++) {
    const payload = { sessionId: first.data.sessionId, questionId: first.data.questions[i].id, lower: 0, upper: i === 6 ? 1 : 100 };
    if (i === 1) assert.equal((await call(session, '/api/session/answer', browser, { ...payload, upper: 101 })).status, 400);
    const responses = await Promise.all([
      call(session, '/api/session/answer', browser, payload),
      call(session, '/api/session/answer', browser, payload),
    ]);
    for (const r of responses) {
      assert.equal(r.status, 200);
      assert.equal(r.data.savedAnswers.length, i + 1);
      assert.equal(r.data.judgement.questionId, onboardingQuestions[i].id);
      assert.equal(r.data.judgement.trueValue, onboardingQuestions[i].trueValue);
      assert.equal(r.data.judgement.prompt, first.data.questions[i].prompt);
      assert.equal(r.data.judgement.sourceUrl, onboardingQuestions[i].sourceUrl);
      assert.equal(typeof r.data.judgement.score, 'number');
      assert.equal(r.data.judgement.hit, i !== 6);
      assert.equal(r.data.judgements, undefined, 'answer response only reveals this submitted question');
    }
    assert.equal((await call(session, '/api/session/answer', browser, { ...payload, lower: 1 })).status, 409);
    if (i === 4) await query("UPDATE game_sessions SET edition='2000-01-01' WHERE id=$1", [first.data.sessionId]);
    const resumed = await call(session, '/api/session/start', browser);
    assert.equal(resumed.data.sessionId, first.data.sessionId);
    assert.equal(resumed.data.savedAnswers.length, i + 1);
    assert.equal(resumed.data.judgements.length, i + 1);
    assert.deepEqual(resumed.data.judgements.map((j: { questionId: string }) => j.questionId), onboardingQuestions.slice(0, i + 1).map(q => q.id));
    assert.doesNotMatch(JSON.stringify(resumed.data.questions), /trueValue|answerContext|sourceUrl|"hit"|"score"/, 'question list never contains future answers');
  }
  assert.equal((await call(session, '/api/session/finalize', browser, { sessionId: first.data.sessionId })).status, 401);
  const claimed = await call(auth, '/api/auth/claim-username', browser, { username: 'FirstTenPlayer' });
  assert.equal(claimed.status, 200);
  assert.equal((await call(auth, '/api/auth/check-username', outsider, { username: 'firsttenplayer' })).data.available, false);
  assert.equal((await call(auth, '/api/auth/claim-username', outsider, { username: 'firsttenplayer' })).status, 409);
  const resumed = await call(session, '/api/session/start', browser);
  assert.equal(resumed.data.sessionId, first.data.sessionId, 'claim-step resume without local storage, even across dates');
  assert.equal(resumed.data.savedAnswers.length, 8);
  assert.equal(resumed.data.judgements.length, 8);
  assert.equal((await call(session, '/api/session/finalize', browser, { sessionId: first.data.sessionId })).status, 409);
  await call(auth, '/api/auth/profile', browser, { avatarIcon: 'wave', avatarColor: '#276c66' });
  const finished = await Promise.all([
    call(session, '/api/session/finalize', browser, { sessionId: first.data.sessionId }),
    call(session, '/api/session/finalize', browser, { sessionId: first.data.sessionId }),
  ]);
  assert.equal(finished[0].status, 200);
  assert.equal(finished[0].data.share.id, finished[1].data.share.id);
  assert.equal(finished[0].data.share.kind, 'onboarding');
  assert.equal(finished[0].data.dailyStats, null);
  assert.equal(finished[0].data.judgements.filter((j: { hit: boolean }) => j.hit).length, 7);
  let user = (await call(auth, '/api/auth/me', browser, {}, 'GET')).data.user;
  assert.equal(user.gamesPlayed, 0);
  assert.equal(user.questionsAnswered, 8);
  assert.equal(user.calibrationRate, 0.875);
  assert.equal(user.totalScore, finished[0].data.score);
  assert.equal(user.onboarding.sessionId, first.data.sessionId);
  for (const body of [{}, { playDaily: true }, { practice: true }]) {
    const sameDay = await call(session, '/api/session/start', browser, body);
    assert.equal(sameDay.data.sessionId, first.data.sessionId);
    assert.equal(sameDay.data.dailyAvailable, false);
  }
  await query("UPDATE game_sessions SET completed_at=now()-interval '2 days' WHERE id=$1", [first.data.sessionId]);
  assert.equal((await call(session, '/api/session/start', browser)).data.dailyAvailable, true);
  const daily = await call(session, '/api/session/start', browser, { playDaily: true });
  assert.equal(daily.data.kind, 'daily');
  assert.equal(daily.data.questions.length, 4);
  for (const q of daily.data.questions) await call(session, '/api/session/answer', browser, {
    sessionId: daily.data.sessionId, questionId: q.id, lower: 0, upper: 1e100,
  });
  const dayResult = await call(session, '/api/session/finalize', browser, { sessionId: daily.data.sessionId });
  assert.equal(dayResult.status, 200);
  user = (await call(auth, '/api/auth/me', browser, {}, 'GET')).data.user;
  const dailyHits = dayResult.data.judgements.filter((j: { hit: boolean }) => j.hit).length;
  assert.equal(user.gamesPlayed, 1);
  assert.equal(user.questionsAnswered, 12);
  assert.equal(user.calibrationRate, (7 + dailyHits) / 12);
  assert.equal(user.onboarding.hits, 7, 'original baseline stays fixed');
  const standings = dayResult.data.dailyStats.todayLeaderboard.filter((r: { username: string }) => r.username === 'FirstTenPlayer');
  assert.equal(standings.length, 1);
  assert.equal(standings[0].score, dayResult.data.score);

  // A guest can sign in to an account with a baseline without replacing it.
  await call(auth, '/api/auth/claim-account', browser, { email: 'firstten@example.invalid', password: 'A-long-test-password-123' });
  const duplicate = (await call(session, '/api/session/start', outsider)).data;
  for (const q of duplicate.questions) await call(session, '/api/session/answer', outsider, {
    sessionId: duplicate.sessionId, questionId: q.id, lower: 0, upper: 100,
  });
  await call(auth, '/api/auth/login', outsider, { email: 'firstten@example.invalid', password: 'A-long-test-password-123' });
  const attached = await call(session, '/api/session/start', outsider, { resumeId: duplicate.sessionId });
  assert.equal(attached.data.isRanked, false);
  assert.equal(attached.data.judgements.length, 8);
  assert.equal((await call(session, '/api/session/finalize', outsider, { sessionId: duplicate.sessionId })).status, 200);
  assert.equal((await call(auth, '/api/auth/me', outsider, {}, 'GET')).data.user.questionsAnswered, 12);
});


test('ten-question games survive the eight-question upgrade and finish with their original baseline', async () => {
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
  execFileSync('npx', ['tsx', 'scripts/postgres/upgrade-onboarding.ts', '/dev/null'], { env: process.env });
  const resumed = await call(session, '/api/session/start', browser);
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
  const user = (await call(auth, '/api/auth/me', browser, {}, 'GET')).data.user;
  assert.equal(user.onboarding.count, 10);
  assert.equal(user.onboarding.hits, 10);
  assert.equal(user.questionsAnswered, 10);
});

test('untouched legacy quizzes resume as eight questions for guests and signed-in players', async () => {
  for (const signedIn of [false, true]) {
    const browser: Browser = { ip: `untouched-${signedIn}` };
    let owner: string;
    if (signedIn) {
      await call(auth, '/api/auth/claim-username', browser, { username: 'UntouchedLegacy' });
      owner = (await query("SELECT id FROM users WHERE username='UntouchedLegacy'")).rows[0].id;
    } else {
      const fresh = (await call(session, '/api/session/start', browser)).data;
      const row = (await query('SELECT guest_session_hash FROM game_sessions WHERE id=$1', [fresh.sessionId])).rows[0];
      owner = `guest:${row.guest_session_hash}`;
      await query('DELETE FROM game_sessions WHERE id=$1', [fresh.sessionId]);
    }
    const original = await startGame(owner, '2000-01-01', legacyQuestions, false, 'onboarding', legacyVersion);
    assert.equal(original.questions.length, 10);
    const resumes = await Promise.all([
      call(session, '/api/session/start', browser, { resumeId: original.sessionId }),
      call(session, '/api/session/start', browser, { resumeId: original.sessionId }),
    ]);
    for (const resumed of resumes) {
      assert.equal(resumed.status, 200);
      assert.equal(resumed.data.sessionId, original.sessionId);
      assert.equal(resumed.data.questions.length, 8);
      assert.deepEqual(resumed.data.questions.map((q: { id: string }) => q.id), onboardingQuestions.map(q => q.id));
      assert.deepEqual(resumed.data.savedAnswers, []);
      assert.doesNotMatch(JSON.stringify(resumed.data), /trueValue|answerContext|sourceUrl|"hit"|"score"/);
    }
    const answer = await call(session, '/api/session/answer', browser, {
      sessionId: original.sessionId, questionId: onboardingQuestions[0].id, lower: 0, upper: 100,
    });
    assert.equal(answer.status, 200);
    assert.equal(answer.data.savedAnswers.length, 1);
  }
});
