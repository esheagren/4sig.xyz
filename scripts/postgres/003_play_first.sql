-- Anonymous play is owned by a separate, expiring browser token, not a fake user.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_chosen boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS guest_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE guest_sessions ADD COLUMN IF NOT EXISTS claimed_game_id uuid REFERENCES game_sessions(id) ON DELETE SET NULL;
ALTER TABLE game_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS guest_session_hash text REFERENCES guest_sessions(token_hash) ON DELETE CASCADE;
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_owner_check;
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_owner_check CHECK (num_nonnulls(user_id,guest_session_hash)=1);
CREATE UNIQUE INDEX IF NOT EXISTS one_guest_game_per_day ON game_sessions(guest_session_hash,edition) WHERE user_id IS NULL AND is_ranked;
COMMIT;
