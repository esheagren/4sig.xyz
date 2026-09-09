# Your starting calibration

New visitors see a welcome, then an unscored example using the live estimate,
range, edit-bound and hold-to-confirm controls. The practice asks for the height of One World Trade Center, including its spire,
in feet. The official World Trade Center site gives 1,776 feet, chosen to mark
the year of American independence; the reveal links to that source. Practice uses
the normal ruler reveal and previews points from the same scoring function as
ranked games, without saving them. After the player taps Next, a separate scoring screen uses five aligned range
diagrams to compare a wide hit (500–5,000), a close hit (1,000–2,000),
a very close hit (1,600–1,900), an exact hit and a near miss (1,778–1,780).
All five examples use the same scale. The correct value sits above the first dot, with each range's endpoints labeled
at its brackets. Next opens a compact worldview page: nine illustrated topics
cover technology and AI, health and biotechnology (including biology and longevity), economics and business,
global development, China and global power, energy and climate, population
and demography, cities and urbanism, and governance and institutions.
Next opens a final setup page explaining four daily questions and the initial
calibration, with score and calibration illustrated side by side. Begin starts
the shared eight-question release. Untouched older quizzes switch to the
current release when resumed, under the same session lock used to save answers.
Once any answer is submitted, the quiz keeps its original questions; the setup
uses the actual session count. Everyone on a release takes
the same questions in the same order. Each submitted interval is locked and saved on the
server. Each submission reveals that question’s correct value, points and source
using the same ruler animation as daily play. Next advances to the next question;
the final reveal leads to a summary of score and calibration, after choosing
a username, pattern and color. Unanswered questions stay concealed. Resuming
a game restores its submitted results and continues from the next question.

The initial pattern and color are randomized from the existing six choices.
The “Claim username” screen places the pattern button left of the username.
It opens one panel with pattern choices and a color subsection beneath them.
The picker follows reduced-motion preferences, and typing does not reset its
animations. Availability checks are debounced;
the existing case-insensitive database uniqueness constraint is authoritative.
The draft identity survives a refresh in the same tab. Guest game ownership and
account attachment use the existing HttpOnly cookies.

## Baseline and daily rounds

Onboarding resumes across Pacific calendar days. A player has one ranked
baseline across all onboarding versions. It is excluded from daily rankings,
daily averages and streaks, but its answers and points contribute to personal
overall calibration and total points. Practice is excluded from all aggregates.
Signing in after playing another baseline retains that run as practice and
preserves the original baseline.

Calibration is captured answers / answered questions, not the distance from 95%.
The scorecard displays the sample count and a 95% target. It does not diagnose
overconfidence from a small starting sample or suggest that 100% is automatically bad.
Points retain the existing relative-precision-v1 formula.

For new players, daily rounds unlock on the Pacific calendar day after baseline
completion. The default returning screen is the baseline scorecard, with a
button to start or resume today's four and overall progress once available.
Players with existing daily games keep their flow and can opt into the first
calibration from Profile. `/?onboarding=1` opens the baseline or starts it once.

## Frozen content

`api/_lib/onboarding-data.ts` defines `first-eight-v1`, including dates, source
links, explanation, units, maximum bounds and glossary definitions. Answers
never enter the client bundle. The installation script persists an immutable
release and dedicated `usage_type='onboarding'` question records outside the
daily pool. Existing glossary components display the definitions; onboarding
snapshots also preserve their original wording. Presentation-only wording edits
in `api/_lib/question-copy.ts` apply consistently to questions and reveals,
with glossary offsets recalculated. The maritime prompt omits its source preamble
and “approximately”; “by volume” stays in the question to define the measure.
Sources, context, answer values and saved snapshots are unchanged.

The order is median age (2020, UN rounded benchmark), urbanization (1950, UN 2018 report), agricultural
employment (2022), seaborne goods trade (UNCTAD rounded
reference), nuclear electricity (2024), freshwater in ice (USGS reference
inventory), genome sequencing (May 2022 NHGRI production benchmark), and women
in national parliaments (1 January 2026). Reference estimates are not presented
as live measurements. The genome benchmark retains the existing bank's dated
NHGRI observation. Future revisions must use a new version and question IDs.

`onboarding-data-v1.ts` preserves the original `first-ten-v1` release. The new
eight-question release omits the EU language survey and US food spending
questions and uses distinct question and glossary IDs. Migration 008 allows
both edition lengths; the installer validates existing releases without changing
them. Existing answers, quizzes with submitted answers, completed baselines and scores
remain attached to their original release. New players receive eight questions.

## Installation

Vercel runs the upgrade with its deployment-injected database credentials before
the production build. The schema and seed run in one transaction under an advisory
lock, so concurrent builds serialize and a failed upgrade stops the release.
Existing installations are checked without rewriting the published baseline.
The commands below also support an explicit manual upgrade.

Apply after PostgreSQL upgrades 001, 002, 003, 005 and 006, before deploying the
new API. Use the preview database first:

```sh
npx tsx scripts/postgres/upgrade-onboarding.ts .env.preview.local
npm run check
npm test
npm run build
```

Then apply the same additive upgrade to the explicitly selected production
environment before production deployment. The script refuses to overwrite a
different published release. No production database is modified by tests.

`FOUR_SIGMA_ONBOARDING=off` temporarily disables new automatic onboarding starts
for a staged rollout; existing baseline games still resume and retain the same
concealment rules. The integration runner uses this switch only for the legacy
daily API suite, then runs the onboarding suite with it enabled.

## Shareable scorecard

Completed calibration and daily games, including shared-score links, show one
scorecard with the player's name and pattern, points, calibration, and hit marks.
Only the background pattern animates; reduced-motion settings keep the on-screen
card still. **Copy and Share** sends a looping GIF, score caption, and an explicit
`https://4sig.xyz/` URL through native sharing when supported. GIF preparation
loads only on results screens, streams one frame at a time through a worker,
and stops when the card unmounts. The GIF is 960 × 720, 160 frames, and 16 seconds.

Clipboard sharing includes a 1920 × 1440 PNG, plain-text caption with score and
game links, and rich HTML containing the image and game link. The receiving app
chooses which representation to paste; image-only apps may omit the link.
**Copy link** and **Save GIF** provide explicit alternatives. When clipboard
image access fails, the card downloads and the caption/link is copied if allowed.
If image creation fails, selectable score/link text remains available.

`shared/scorecard.ts` defines every image frame used on screen and in exports.
Protected Designspace retains paper, ink, and emblem studies at
`/designspace?view=scorecards`; the game uses Ink. Studies use sample results.
