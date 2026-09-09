#!/bin/bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_db_dir="$(mktemp -d /private/tmp/4sig-database.XXXXXX)"
initdb -D "$test_db_dir/data" -A trust --no-locale > "$test_db_dir/init.log"
pg_ctl -D "$test_db_dir/data" -l "$test_db_dir/server.log" -o "-k $test_db_dir -c listen_addresses=''" start >/dev/null
trap 'pg_ctl -D "$test_db_dir/data" stop -m fast >/dev/null' EXIT
export PGHOST="$test_db_dir" PGDATABASE=postgres DATABASE_URL=''
cd "$repo_dir"
if [ -n "${1:-}" ]; then
  npx tsx scripts/postgres/migrate.ts "$1"
else
  psql -v ON_ERROR_STOP=1 -f scripts/postgres/001_schema.sql > "$test_db_dir/schema.log"
  psql -v ON_ERROR_STOP=1 -c "INSERT INTO questions(question_text,answer_value) VALUES ('Test one',123),('Test two',-196),('Test three',0.005),('Test four',5000);" >/dev/null
fi
psql -v ON_ERROR_STOP=1 -f scripts/postgres/002_player_identity.sql > "$test_db_dir/identity.log"
psql -v ON_ERROR_STOP=1 -f scripts/postgres/003_play_first.sql > "$test_db_dir/guest.log"
psql -v ON_ERROR_STOP=1 -f scripts/postgres/005_editorial.sql > "$test_db_dir/editorial.log"
psql -v ON_ERROR_STOP=1 -f scripts/postgres/006_glossary.sql > "$test_db_dir/glossary.log"
npx tsx scripts/postgres/upgrade-onboarding.ts /dev/null
FOUR_SIGMA_ONBOARDING=off npx tsx --test test/glossary.test.ts test/postgres.test.ts test/designspace.test.ts test/share-scorecard.test.ts test/ink-exploration.test.ts test/number-entry.test.ts test/range-drag.test.ts test/ruler-feedback.test.ts test/designspace-hold.test.mjs test/hold-control.test.mjs test/ruler-scale.test.ts test/number-display.test.ts test/question-copy.test.ts test/citations.test.ts test/editorial.test.ts

FOUR_SIGMA_ONBOARDING=on npx tsx --test test/onboarding.test.ts
