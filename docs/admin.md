# Admin workspace

`/admin` is the private workspace for Questions, Analytics, and Design. It uses the existing designspace password and signed HttpOnly session cookie. `/designspace` remains a compatible legacy entry point; links inside the design tool use `/admin`. Isolated screen previews remain protected and cannot emit product events.

## Curation

- The next 14 days show locked, planned, or suggested editions, on Pacific dates. Reading the calendar does not create or publish schedules. Forecasts apply the game's topic-diversity and recency selection rules; intervening edits or saved lineups can change them.
- Adopt a suggested lineup, reorder it, or replace questions. A saved future lineup contains five distinct, eligible daily questions with at most one reference question. Review dates must cover the scheduled day. Started editions cannot be rescheduled.
- Edit the question, numerical answer, unit, short and expanded explanation, citations, taxonomy, verification evidence, and review status. Ready questions require the same core evidence as editorial releases. Retired and needs-review questions are excluded from future selection.
- Saves use optimistic revisions to prevent another tab's edits from being overwritten. Question and lineup changes have an audit trail. With the current shared-password login the audit actor is `admin`, not an individually identified editor.
- Question, truth, unit, and answer-source changes do not modify frozen editions or games. DB `answer_insight` overrides the reviewed code defaults when an answer is revealed; this lets historical answer explanations improve without rescoring anyone. The original numerical estimate is now saved alongside the final bounds. Older estimates remain unknown.

## Metrics and their limits

Saved-game metrics use ranked runs opened within the selected rolling 7/30/90-day window. A run opens when the game loads, before the visitor necessarily taps Start. Started means at least one saved answer; finished means server finalization succeeded. Returned counts owners who finished at least two distinct daily editions within this cohort; it is not a day-one retention rate.

The five-question progress chart follows a single cohort of daily runs with five questions. Legacy starting runs are included in overview totals but excluded from that chart. Question availability is inferred from submitted answers: the next unanswered question is available, not necessarily seen. Incomplete runs with no saved answer for 30 minutes are investigation leads, not proof of abandonment.

New first-party events record named screens, active visible time, username-claim attempts/results, request errors, and clipboard outcomes. A visit resets after 30 minutes without an event. The first-visit funnel includes visits that observed Welcome and reached the later steps in order within that visit. Return visits and resumed sessions have different paths. Browser/device comparisons report whether a visit observed a scorecard, not whether it completed a new game.

The dashboard explicitly dates the start of this tracking. Historical screen reach, time, and exits are unknown. Last-observed screens and copy events are not proof of departure or message delivery. Beacons can be lost when browsers close, block scripts, or lose connectivity.

User identity comes from validated server cookies. Browser UUIDs are analytics identifiers only and cannot authenticate an account or prove two visits were the same human. Session and question links in events are accepted only after ownership validation. Event ingestion uses an allowlist, bounded batches, deduplication IDs, and rate limits. It stores browser family, device class, and referrer host, not typed usernames, passwords, emails, raw user agents, IPs, or full referrer URLs. Submitted numerical answers are stored by the existing game API, not copied into generic event properties.

People shows recent owners and browser visits with detailed saved answers and an event timeline. Mark a user, guest owner, or browser as internal testing to exclude it without deleting records. A browser exclusion also removes games observed on that browser; shared browsers should be labeled carefully. Enable Include tests to restore excluded rows to the view or undo a label.

## Operations and validation

`010_admin.sql` is an additive, idempotent migration applied by the existing deployment upgrade script. No production test players or events are needed to validate it. `npm test` runs a disposable PostgreSQL integration environment, including authentication/CSRF checks, read-only forecasting, lineup conflicts, frozen-score preservation, original-estimate persistence, event attribution, funnel counts, and test exclusions. `npm run check`, `npm run lint`, and `npm run build` validate the client and API.

Keep the scheduler, admin planner, and game snapshots in agreement when extending curation. Use event names and metrics definitions deliberately; changing them silently breaks comparisons across releases. Revisit retention and event-volume limits as real usage grows.
