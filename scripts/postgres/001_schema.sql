-- Portable PostgreSQL. Apply to an empty database; never to the Supabase source.
BEGIN;
CREATE SCHEMA IF NOT EXISTS legacy;
CREATE TABLE IF NOT EXISTS legacy.supabase_exports (
  table_name text PRIMARY KEY, exported_at timestamptz NOT NULL,
  row_count integer NOT NULL, sha256 text NOT NULL, rows jsonb NOT NULL
);
REVOKE ALL ON SCHEMA legacy FROM PUBLIC;

CREATE TABLE IF NOT EXISTS domains (id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS categories (id uuid PRIMARY KEY, domain_id uuid REFERENCES domains, name text NOT NULL, slug text NOT NULL);
CREATE TABLE IF NOT EXISTS subcategories (id uuid PRIMARY KEY, category_id uuid REFERENCES categories, name text NOT NULL, slug text NOT NULL);
CREATE TABLE IF NOT EXISTS units (id uuid PRIMARY KEY, name text NOT NULL, symbol text);
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unit_id uuid REFERENCES units,
  question_text text NOT NULL, answer_value numeric NOT NULL,
  scoring_reference numeric NOT NULL DEFAULT 1 CHECK (scoring_reference > 0 AND scoring_reference <= 1e100),
  answer_context text, source_url text, source_name text,
  is_active boolean NOT NULL DEFAULT true, usage_type text NOT NULL DEFAULT 'daily',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (answer_value BETWEEN -1e100 AND 1e100)
);
CREATE TABLE IF NOT EXISTS question_subcategories (
  question_id uuid REFERENCES questions ON DELETE CASCADE, subcategory_id uuid REFERENCES subcategories,
  is_primary boolean NOT NULL DEFAULT false, PRIMARY KEY(question_id,subcategory_id)
);
CREATE TABLE IF NOT EXISTS daily_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid NOT NULL REFERENCES questions,
  date date NOT NULL, display_order integer NOT NULL CHECK (display_order >= 0),
  is_published boolean NOT NULL DEFAULT true,
  UNIQUE(date,question_id), UNIQUE(date,display_order)
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  avatar_icon text NOT NULL DEFAULT 'orbit' CHECK (avatar_icon IN ('orbit','spark','wave','diamond','crosshair')),
  email text, timezone text NOT NULL DEFAULT 'America/Los_Angeles', theme_preference text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(lower(email)) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE, password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key text PRIMARY KEY, attempts integer NOT NULL, resets_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users,
  edition date NOT NULL, is_ranked boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, scoring_version text NOT NULL DEFAULT 'relative-precision-v1'
);
-- Only the first game for an edition is ranked; refreshing resumes it.
CREATE UNIQUE INDEX IF NOT EXISTS one_ranked_game_per_day ON game_sessions(user_id,edition) WHERE is_ranked;
CREATE INDEX IF NOT EXISTS game_sessions_user ON game_sessions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS game_questions (
  session_id uuid REFERENCES game_sessions ON DELETE CASCADE,
  question_id uuid REFERENCES questions, position integer NOT NULL,
  -- Snapshot includes the original truth, units and citation, held only on the server.
  snapshot jsonb NOT NULL, PRIMARY KEY(session_id,question_id), UNIQUE(session_id,position)
);
CREATE TABLE IF NOT EXISTS game_answers (
  session_id uuid NOT NULL, question_id uuid NOT NULL,
  lower_bound numeric NOT NULL, upper_bound numeric NOT NULL,
  score numeric(8,1) NOT NULL CHECK (score BETWEEN 0 AND 10000), captured boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,question_id),
  FOREIGN KEY(session_id,question_id) REFERENCES game_questions ON DELETE CASCADE,
  CHECK (lower_bound BETWEEN -1e100 AND 1e100 AND upper_bound BETWEEN -1e100 AND 1e100 AND lower_bound <= upper_bound),
  CHECK (captured OR score = 0)
);
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users ON DELETE SET NULL,
  feedback_text text NOT NULL CHECK (length(feedback_text) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(), user_agent text, page_url text
);
CREATE OR REPLACE VIEW completed_games AS
SELECT s.id,s.user_id,s.edition,s.is_ranked,s.completed_at,
       sum(a.score)::float8 AS score,count(*)::int AS questions_answered,
       count(*) FILTER(WHERE a.captured)::int AS questions_captured
FROM game_sessions s JOIN game_answers a ON a.session_id=s.id
WHERE s.completed_at IS NOT NULL
GROUP BY s.id;
COMMIT;
