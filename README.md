# Four Sigma

A daily estimation game. Choose a username and symbol, enter an estimate (including `4E5` or `-196`), then draw your range. Misses score zero; hits reward precision relative to the answer's magnitude. Your first attempt each Pacific calendar day is ranked; later attempts are practice. Refreshing resumes your first attempt.

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

For an empty database, apply `scripts/postgres/001_schema.sql`. To import the verified Supabase export into an empty database instead:

```sh
npm run db:migrate -- /absolute/path/to/supabase-export
npm run db:check
```

The migration checks hashes, imports in one transaction, and refuses to overwrite an existing schema. All source rows are retained in `legacy.supabase_exports`; only editorial data enters the active game. Old test accounts and scores do not affect new rankings. Ten unfinished zero-valued questions are inactive; any scheduled occurrences are replaced. Review and verify them before reactivating. Historical Supabase SQL remains in `scripts/migrations/` for reference and must not be applied to Neon.

Questions belong to units and optionally multiple subcategories. Daily schedules have unique positions and question IDs per date. Each edition holds four questions: a transaction tops up any date short of that (including the imported schedule) from active daily questions, preferring those not used in the previous week. The bank eventually repeats; add verified questions regularly.

A game snapshots question text, truth, units and citations at start. Each locked answer is stored once, with a composite foreign key to that game's questions. The server computes the score and only reveals a truth after saving a range. Completion is idempotent. Totals, hit rates and leaderboards are derived from completed ranked games, without mutable duplicate counters. Practice games are saved but excluded from rankings and profile totals.

Profiles use server-generated random session cookies (HttpOnly, SameSite, Secure in production); only token hashes are stored. Empty visitors do not create users. Optional email/password sign-in uses salted scrypt hashes and shared database rate limits. There is no email verification or password-reset mail service yet; do not treat email as verified. Username-only profiles are retained in that browser; adding sign-in enables another device.

## Deployment

The repository is linked to Vercel's `4-sigma` project, serving `4sig.xyz`. Run a preview deployment and check `/api/health`, the full play flow, sharing, and profile before deploying production. Vercel injects the environment-specific `DATABASE_URL`. Keep `.env*`, `.vercel`, exports, and database credentials out of git.

See [migration review](docs/postgres-migration.md) for the model changes and migration record.
