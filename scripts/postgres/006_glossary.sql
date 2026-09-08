BEGIN;
CREATE TABLE IF NOT EXISTS glossary_terms (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]*$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  definition text NOT NULL CHECK (length(definition) BETWEEN 1 AND 450),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  verified_at date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS question_glossary (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  term_id text NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE,
  match_text text NOT NULL CHECK (length(trim(match_text)) BETWEEN 1 AND 100),
  PRIMARY KEY (question_id, term_id, match_text)
);
CREATE INDEX IF NOT EXISTS question_glossary_term_idx ON question_glossary(term_id);
COMMIT;
