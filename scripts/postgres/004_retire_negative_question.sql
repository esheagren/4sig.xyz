-- Retire the sole negative-answer question, preserving historical games.
-- Replace upcoming scheduled appearances so editions keep their question count.
BEGIN;
UPDATE questions SET is_active = false, updated_at = now()
WHERE id = 'f4d61446-ffef-4919-9681-9b16158942cf' AND is_active;

DO $$
DECLARE
  scheduled record;
  replacement uuid;
BEGIN
  FOR scheduled IN
    SELECT id, date FROM daily_questions
    WHERE question_id = 'f4d61446-ffef-4919-9681-9b16158942cf'
      AND date >= CURRENT_DATE
    ORDER BY date
  LOOP
    SELECT q.id INTO replacement FROM questions q
    WHERE q.is_active AND q.usage_type = 'daily' AND q.answer_value >= 0
      AND NOT EXISTS (
        SELECT 1 FROM daily_questions d WHERE d.question_id = q.id
          AND d.date BETWEEN scheduled.date - 7 AND scheduled.date + 7
      )
    ORDER BY q.id LIMIT 1;
    IF replacement IS NULL THEN
      RAISE EXCEPTION 'No replacement question for %', scheduled.date;
    END IF;
    UPDATE daily_questions SET question_id = replacement WHERE id = scheduled.id;
  END LOOP;
END $$;
COMMIT;
