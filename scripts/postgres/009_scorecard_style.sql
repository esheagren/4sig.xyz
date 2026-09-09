-- Nullable for existing accounts; their pattern selects the matching default style.
ALTER TABLE users ADD COLUMN IF NOT EXISTS scorecard_style text
  CHECK (scorecard_style IN ('orbit','wave','spiral','pendulum','bloom','braid','halo','horizon'));
