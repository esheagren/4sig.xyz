BEGIN;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS editorial_status text NOT NULL DEFAULT 'needs_review' CHECK (editorial_status IN ('needs_review','ready','retired'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS editorial_role text NOT NULL DEFAULT 'core' CHECK (editorial_role IN ('core','reference'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS editorial_topic text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS observation_period text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS geography text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS measure_definition text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS verified_at date;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS review_due date;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS verification_notes text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='questions_ready_evidence') THEN
  ALTER TABLE questions ADD CONSTRAINT questions_ready_evidence CHECK (editorial_status <> 'ready' OR (
   is_active AND answer_value > 0 AND verified_at IS NOT NULL AND review_due IS NOT NULL AND review_due >= verified_at
   AND COALESCE(length(trim(editorial_topic)),0)>0 AND COALESCE(length(trim(observation_period)),0)>0
   AND COALESCE(length(trim(geography)),0)>0 AND COALESCE(length(trim(measure_definition)),0)>0
   AND COALESCE(length(trim(source_url)),0)>0 AND COALESCE(length(trim(source_name)),0)>0
   AND COALESCE(length(trim(verification_notes)),0)>0));
 END IF;
END $$;
ALTER TABLE daily_questions ADD COLUMN IF NOT EXISTS question_snapshot jsonb;
ALTER TABLE daily_questions ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS editorial_releases (id text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
COMMIT;
