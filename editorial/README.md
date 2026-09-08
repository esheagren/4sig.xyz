# Editing the Four Sigma bank

The [brand and editorial brief](../docs/brand-and-editorial-brief.md) governs selection. Questions should teach a consequential number, with a defined population, period and measure. The first reviewed release is [2026-09-08.json](releases/2026-09-08.json); the [remediation report](../docs/audits/2026-09-08-remediation.md) explains its decisions.

## Review states

- `needs_review`: a research candidate, excluded from new editions even if `is_active` is accidentally enabled.
- `ready`: a positive, supported answer with a source, observation period, geography, definition, verification notes, verification date and review deadline. The database requires these fields; the release validator checks citation URLs. Read the source before using this status.
- `retired`: kept for history, excluded from new editions. A later reviewed release can deliberately bring back a rewritten subject.

`editorial_role` distinguishes core questions from occasional reference questions. The scheduler uses `editorial_topic` for variety; legacy imported taxonomy is retained for traceability but does not drive selection. It prefers different topics and least-recently-used questions, and admits at most one reference question per edition. It never fills a gap with an unreviewed or overdue question. Insufficient eligible questions produce a not-ready response rather than silently reverting to the old bank.

A review deadline is an editorial maintenance date, not a claim that a dated observation becomes false that day. At review, decide whether to update the observation, retain it as an explicit historical baseline, or hold it back. The first deadlines are December 8, 2026 for provisional/fast-moving subjects, March 8, 2027 for the other dated observations, and September 8, 2027 for durable references. There is no automatic fact verification or scheduled reminder.

## Releasing changes

Use a new immutable JSON manifest with the question UUIDs, expected pre-edit values, decisions, and verified repairs. Do not alter an already applied manifest: its checksum is stored in `editorial_releases`. The database script refuses conflicting checksums or questions changed since the audit.

For an existing installation, apply `scripts/postgres/005_editorial.sql` first. It is additive and idempotent. Deploy code that understands the new columns before applying the first data release. Until a release marker exists, the scheduler retains legacy eligibility. The marker and data changes commit together.

Run against the intended environment (load its `DATABASE_URL` without printing it):

```sh
npx tsx scripts/postgres/apply-editorial.ts editorial/releases/2026-09-08.json /absolute/private/backup-directory
```

The script requires a new private backup directory, backs up question and schedule tables before modifying them, checks expected question values, applies the release in one transaction, and rebuilds unstarted future editions. It fills at least the next 30 days and checks all previously scheduled future dates. A shortfall rolls back the entire release. Try the release on the separate preview database before production. Re-running an identical release with a fresh backup directory is a no-op.

Today's published edition and all past published editions are frozen before any repair. Any future edition already associated with a game is protected too. New editions freeze when first requested on their date. Game snapshots, answers and scores are never rewritten; the release verifies fingerprints of existing question snapshots and answers. Old three-question schedules remain an archive; the public game schedules four questions a day.

Validate with `npm run check`, `npm run lint`, `npm test`, and `npm run build`. Integration tests cover release idempotency, unchanged historical games, source parsing, eligibility, expiry, four-question editions and topic/reference balance.
