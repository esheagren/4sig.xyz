# Postgres migration review

The previous model's question taxonomy and daily schedule are useful and retained. Gameplay previously duplicated answers in JSON and rows and incremented profile counters separately, which allowed drift and retry duplication. Several profile screens also used placeholder history. The new model derives statistics from completed games and displays actual history.

- `users`: only claimed profiles, case-insensitive unique usernames and optional emails; chosen symbol is constrained.
- `auth_sessions`, `user_credentials`: separate authentication records; session secrets and passwords never appear in browser storage or public responses.
- `questions`, `units`, `domains`, `categories`, `subcategories`, `question_subcategories`: editorial content, references and taxonomy. Original extra metadata is also retained in the archive.
- `daily_questions`: unique edition/order and edition/question pairs, one shared schedule in Pacific time.
- `game_sessions`: owner, edition, ranking eligibility, scoring version and completion time. One ranked game per user/edition.
- `game_questions`: ordered, immutable-in-application question snapshots tied to a game; unrevealed values remain server-side.
- `game_answers`: one immutable-in-application range, score and capture result per game/question.
- `completed_games`: view used for totals and rankings. Practice is excluded explicitly. Concurrent retries cannot count twice.
- `feedback`: optional profile reference and submitted text.
- `legacy.supabase_exports`: checksum-verified complete source tables, including all test users and results. No public API reads this schema.

## Source inventory (2026-09-05)

| Table                  | Rows |
| ---------------------- | ---: |
| questions              |  109 |
| users                  |  380 |
| game_sessions          |  274 |
| user_responses         |   66 |
| daily_questions        |  108 |
| domains                |   15 |
| categories             |  105 |
| subcategories          |  814 |
| question_subcategories |  109 |
| units                  |   96 |
| feedback               |    1 |

All 2,077 source rows are archived. None of the source users had email accounts; nine had claimed test usernames. New profiles start clean. Supabase itself is unchanged and can serve as a rollback source.

Ten question answers were zero placeholders (including WeChat usage, Mumbai billionaires and saffron prices). These are preserved but inactive, leaving 99 playable questions. This was a structural/content sanity review, not an independent fact-check of all 109 answers. Questions using “current” still need dated editorial review.

The active taxonomy remains larger than the question bank; unused taxonomy rows are harmless reference data and were retained. We did not keep unused aggregate tables or simulate statistics.

The scoring formula is `min(10000, 50 * (abs(answer) / width)^0.7)` on a hit, rounded to one decimal; a miss earns zero. An exact hit earns 10,000. For a verified zero answer, an explicit positive question reference scale replaces its magnitude. This rewards relative precision; it is not a proper score for calibrated 95% confidence intervals.

## Verification

The local PostgreSQL suite imports the real backup and verifies archive counts, username uniqueness, cookie/session ownership, signed scientific notation, server scoring, no truth disclosure at start, sequential answers, question snapshot stability, concurrent starts/submissions/finalization, refresh recovery, practice exclusion, profile history, password sign-in and logout revocation. It also verifies that direct invalid bounds violate database constraints.

The earlier proposed Supabase migrations were never applied remotely; the portable schema supersedes them. The original Supabase project and local backup are retained. Roll back an application deployment through Vercel if needed; do not run the old reset scripts against Neon.
