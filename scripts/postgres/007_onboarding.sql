-- Additive: preserve daily editions, answers, identities and existing rankings.
BEGIN;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'daily' CHECK (kind IN ('daily','onboarding'));
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS onboarding_version text;
ALTER TABLE game_sessions ADD CONSTRAINT onboarding_version_required CHECK ((kind='onboarding')=(onboarding_version IS NOT NULL));
DROP INDEX IF EXISTS one_ranked_game_per_day;
DROP INDEX IF EXISTS one_guest_game_per_day;
CREATE UNIQUE INDEX one_ranked_game_per_day ON game_sessions(user_id,edition) WHERE is_ranked AND kind='daily';
CREATE UNIQUE INDEX one_guest_game_per_day ON game_sessions(guest_session_hash,edition) WHERE user_id IS NULL AND is_ranked AND kind='daily';
CREATE UNIQUE INDEX one_onboarding_per_user ON game_sessions(user_id) WHERE is_ranked AND kind='onboarding';
CREATE UNIQUE INDEX one_onboarding_per_guest ON game_sessions(guest_session_hash) WHERE user_id IS NULL AND is_ranked AND kind='onboarding';
CREATE TABLE IF NOT EXISTS onboarding_editions (
  version text PRIMARY KEY,
  questions jsonb NOT NULL CHECK (jsonb_array_length(questions)=10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE VIEW completed_games AS
SELECT s.id,s.user_id,s.edition,s.is_ranked,s.completed_at,
       sum(a.score)::float8 AS score,count(*)::int AS questions_answered,
       count(*) FILTER(WHERE a.captured)::int AS questions_captured,
       s.kind,s.onboarding_version
FROM game_sessions s JOIN game_answers a ON a.session_id=s.id
WHERE s.completed_at IS NOT NULL GROUP BY s.id;
COMMIT;
