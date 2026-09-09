import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { ONBOARDING_VERSION, onboardingQuestions } from '../../api/_lib/onboarding-data.js';

const envFile = process.argv[2];
if (!envFile) throw new Error('Pass an explicit target environment file or --environment for deployment-injected credentials.');
if (envFile !== '--environment') dotenv.config({ path: envFile, override: true, quiet: true });
if (!process.env.DATABASE_URL && !process.env.PGHOST) throw new Error('A database target is required.');
const { pool, transaction } = await import('../../api/_lib/db.js');
try {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('onboarding-release'))");
    const installed = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_sessions' AND column_name='kind'");
    if (!installed.rowCount) {
      const migration = await readFile(new URL('./007_onboarding.sql', import.meta.url), 'utf8');
      await client.query(migration.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''));
    }
    const { rows } = await client.query('SELECT questions FROM onboarding_editions WHERE version=$1', [ONBOARDING_VERSION]);
    if (rows[0]) {
      if (JSON.stringify(rows[0].questions) !== JSON.stringify(JSON.parse(JSON.stringify(onboardingQuestions)))) {
        // jsonb key order differs from JS; compare canonical structures below.
        const canonical = (v: unknown): string => JSON.stringify(v, (_key, value) =>
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
        if (canonical(rows[0].questions) !== canonical(onboardingQuestions)) throw new Error('Published onboarding version differs. Create a new version instead.');
      }
      return;
    }
    for (const q of onboardingQuestions) {
      await client.query(`INSERT INTO questions(id,question_text,answer_value,source_name,source_url,answer_context,usage_type,
        editorial_status,editorial_topic,observation_period,geography,measure_definition,verified_at,review_due,verification_notes)
        VALUES($1,$2,$3,$4,$5,$6,'onboarding','ready',$7,$8,'As specified in the prompt',$6,'2026-09-08','2027-09-08','Frozen first-ten-v1 reference observation; source precision retained.')`,
        [q.id,q.prompt,q.trueValue,q.source,q.sourceUrl,q.answerContext,q.topic,q.observationPeriod]);
      for (const term of q.glossary ?? []) {
        await client.query(`INSERT INTO glossary_terms(id,title,definition,source_url,verified_at) VALUES($1,$2,$3,$4,'2026-09-08')`,
          [term.termId,term.title,term.definition,q.sourceUrl!.split(';')[0].trim()]);
        await client.query('INSERT INTO question_glossary(question_id,term_id,match_text) VALUES($1,$2,$3)',
          [q.id,term.termId,q.prompt.slice(term.start,term.end)]);
      }
    }
    await client.query('INSERT INTO onboarding_editions(version,questions) VALUES($1,$2)', [ONBOARDING_VERSION,JSON.stringify(onboardingQuestions)]);
  });
  console.log('Onboarding schema and immutable first-ten-v1 installed. Existing games retained.');
} finally { await pool.end(); }
