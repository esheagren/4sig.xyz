ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_insight jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS admin_revision integer NOT NULL DEFAULT 0;
ALTER TABLE game_answers ADD COLUMN IF NOT EXISTS initial_estimate numeric CHECK (initial_estimate BETWEEN -1e100 AND 1e100);
CREATE TABLE IF NOT EXISTS admin_changes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, subject text NOT NULL, actor text NOT NULL,
 before_value jsonb NOT NULL, after_value jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_changes_subject ON admin_changes(subject,created_at DESC);
CREATE TABLE IF NOT EXISTS product_events (
 id uuid PRIMARY KEY, visitor_id uuid NOT NULL, visit_id uuid NOT NULL,
 user_id uuid REFERENCES users ON DELETE SET NULL, session_id uuid REFERENCES game_sessions ON DELETE SET NULL,
 question_id uuid REFERENCES questions ON DELETE SET NULL,
 name text NOT NULL, screen text, properties jsonb NOT NULL DEFAULT '{}',
 browser text NOT NULL, device text NOT NULL, referrer_host text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_events_created ON product_events(created_at);
CREATE INDEX IF NOT EXISTS product_events_visit ON product_events(visit_id,created_at);
CREATE INDEX IF NOT EXISTS product_events_user ON product_events(user_id,created_at);
CREATE INDEX IF NOT EXISTS product_events_session ON product_events(session_id,created_at);
CREATE TABLE IF NOT EXISTS admin_exclusions (subject text PRIMARY KEY, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS admin_settings (key text PRIMARY KEY, value text NOT NULL);
INSERT INTO admin_settings(key,value) VALUES('tracking_started',now()::text) ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS game_sessions_created ON game_sessions(created_at);
CREATE INDEX IF NOT EXISTS product_events_visitor ON product_events(visitor_id,created_at);
