# Four Sigma

A daily game of the numbers that matter for understanding the world, with four questions. Play immediately: enter an estimate (including `4E5`), then draw your range. Hold the circular ink arrow for half a second to confirm; release early to cancel. Misses score zero; hits reward precision relative to the answer's magnitude. Your first attempt each Pacific calendar day is ranked; later attempts are practice. Refreshing resumes your first attempt.

## Brand and editorial direction

Use the [brand and editorial brief](docs/brand-and-editorial-brief.md) when developing questions, product copy, design, or other materials. Four Sigma centers on carefully selected numbers that help people understand the world; question quality is the core editorial promise.

See the [September 2026 question-bank audit](docs/audits/2026-09-08-question-bank.md) for the current inventory, editorial recommendations, and sourcing issues.

## Development

Node 22+, PostgreSQL 15+, and npm are required.

```sh
npm install
# Set DATABASE_URL in .env (never VITE_DATABASE_URL).
npm run dev
```

The React client runs through Vite. The Express development server invokes the same handlers as Vercel, so local and production scoring, accounts, and transactions are identical.

```sh
npm run check
npm run build
npm test
```

`npm test` creates and removes an isolated PostgreSQL server using `initdb` and `pg_ctl`; it never connects to the live database. To verify an exported dataset as well:

```sh
bash test/database.integration.sh /absolute/path/to/supabase-export
```

## Database

Neon Postgres is provisioned through the Vercel Marketplace. Production and preview use separate Free-plan databases, in the same `iad1` region as the API. Database credentials stay on the server. There is no Supabase runtime dependency.

For an empty database, apply `scripts/postgres/001_schema.sql` followed by `scripts/postgres/002_player_identity.sql` and `scripts/postgres/003_play_first.sql`. To import the verified Supabase export into an empty database instead:

```sh
npm run db:migrate -- /absolute/path/to/supabase-export
npm run db:check
```

The migration checks hashes, imports in one transaction, and refuses to overwrite an existing schema. All source rows are retained in `legacy.supabase_exports`; only editorial data enters the active game. Old test accounts and scores do not affect new rankings. Ten unfinished zero-valued questions are inactive; any scheduled occurrences are replaced. Review and verify them before reactivating. Historical Supabase SQL remains in `scripts/migrations/` for reference and must not be applied to Neon.

Questions belong to units and optionally multiple subcategories. Daily schedules have unique positions and question IDs per date. When the imported schedule runs out, a transaction creates a shared four-question edition from active daily questions, preferring those not used in the previous week. Short imported editions are filled to four without reordering existing questions. `scripts/postgres/ensure-four-questions.ts` takes an explicit environment file and upgrades upcoming schedules and unfinished games while preserving completed scores. The bank eventually repeats; add verified questions regularly.

A game snapshots question text, truth, units and citations at start. Each locked answer is stored once, with a composite foreign key to that game's questions. The server computes the score and only reveals a truth after saving a range. Completion is idempotent. Totals, hit rates and leaderboards are derived from completed ranked games, without mutable duplicate counters. Practice games are saved but excluded from rankings and profile totals.

Profiles use server-generated random session cookies (HttpOnly, SameSite, Secure in production); only token hashes are stored. Empty visitors do not create users. Optional email/password sign-in uses salted scrypt hashes and shared database rate limits. There is no email verification or password-reset mail service yet; do not treat email as verified. Username-only profiles are retained in that browser; adding sign-in enables another device.

## Mathematical identity

The game opens directly on the first question. Only after the last answer do new players choose a username and personality; returning players with a saved personality skip this step. The game uses the Mathematical Espresso design. Players choose Orbit, Wave, Spiral, Pendulum, Bloom or Braid, plus one of six preset colors. Original mathematical SVG loops pause offscreen, in hidden tabs, and under reduced-motion preferences. The picker and score pages also provide pause controls.

Apply the additive upgrade to an existing Neon target before deploying this version:

```sh
npx tsx scripts/postgres/upgrade-identity.ts .env.preview.local
npx tsx scripts/postgres/upgrade-identity.ts .env
```

The upgrade retains legacy avatar values and adds `users.avatar_color` and `users.identity_chosen`. Anonymous games use a separate, expiring HttpOnly guest cookie and a hashed owner token, without creating placeholder users. Refreshing resumes the game. On finalization after username creation or sign-in, the guest game transfers atomically to the authenticated account. If that account already has a ranked game for the edition, the transferred run becomes practice, preserving both sets of answers and the existing ranking. Old Spark, Diamond and Crosshair choices display as Bloom, Spiral and Pendulum. The profile editor saves the name, pattern and color together.

Finalization prepares one unlisted `result_shares` record per completed game with an immutable username/pattern/color snapshot. `/api/share?id=…` returns only that identity, edition, score, hit tiles and ranked/practice status. `/share/:id` displays the same animation without requiring sign-in. Shares contain no email, user ID, question text, truth or submitted bounds. Share Score immediately copies a spoiler-free personal signature and link; it never sends messages or opens a sharing app automatically. Later profile changes do not rewrite existing shares.

## Deployment

### Private design previews

`/designspace` retains all thirteen interactive visual studies, with welcome, estimate, range and score screens. It is a separate server-rendered page; the preview content is not included in the public game bundle. Its sample scores do not create accounts or write game results.

Set `DESIGNSPACE_PASSWORD_HASH` (the existing `scrypt-v1` password format) and `DESIGNSPACE_SESSION_SECRET` (at least 32 random characters) as server-only environment variables. Access fails closed when either is missing. A successful password check sets a signed, HttpOnly cookie for 24 hours; changing the session secret invalidates existing access. Login uses the existing shared rate limiter. Responses disable caching, indexing and framing. Keep these values out of git and never prefix them with `VITE_`.

The dedicated access checks can run without a database using `npx tsx --test test/designspace.test.ts`; they are also included in `npm test`. Local Vite requests to `/designspace` proxy to the Express server. The protected page source is `api/_lib/designspace.html`, included only in the server function deployment.

### Hosting

The repository is linked to Vercel's `4-sigma` project, serving `4sig.xyz`. Run a preview deployment and check `/api/health`, the full play flow, sharing, and profile before deploying production. Vercel injects the environment-specific `DATABASE_URL`. Keep `.env*`, `.vercel`, exports, and database credentials out of git.

See [migration review](docs/postgres-migration.md) for the model changes and migration record.
