-- Retain the published ten-question edition while allowing the new eight-question release.
BEGIN;
ALTER TABLE onboarding_editions DROP CONSTRAINT IF EXISTS onboarding_editions_questions_check;
ALTER TABLE onboarding_editions ADD CONSTRAINT onboarding_editions_questions_check
  CHECK (jsonb_array_length(questions) IN (8, 10));
COMMIT;
