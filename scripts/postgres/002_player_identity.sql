-- Additive upgrade. Existing users, games and legacy avatar choices are retained.
BEGIN;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_avatar_icon_check;
ALTER TABLE users ADD CONSTRAINT users_avatar_icon_check CHECK (avatar_icon IN ('orbit','wave','spiral','pendulum','bloom','braid','spark','diamond','crosshair'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color text NOT NULL DEFAULT '#ad4128' CHECK (avatar_color ~ '^#[0-9a-fA-F]{6}$');
CREATE TABLE IF NOT EXISTS result_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
  -- Frozen identity; no email, account ID, questions or answer values are public.
  player jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
