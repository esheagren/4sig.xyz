# Your first ten

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
cover technology and AI, biology and biotechnology, economics and trade,
health and longevity, China and global power, energy and resources, population
and demography, cities and urbanism, and climate and environment.
It introduces the ten-question entry test. Everyone takes the same ten
questions in the same order. Each submitted interval is locked and saved on the
server. Scores, truths, sources and hit flags are withheld until all ten answers
are saved and the player has chosen a username, pattern and color.

The initial pattern and color are randomized from the existing six choices.
The pattern button sits left of the username. Availability checks are debounced;
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
overconfidence from ten observations or suggest that 100% is automatically bad.
Points retain the existing relative-precision-v1 formula.

For new players, daily rounds unlock on the Pacific calendar day after baseline
completion. The default returning screen is the baseline scorecard, with a
button to start or resume today's four and overall progress once available.
Players with existing daily games keep their flow and can opt into the first
ten from Profile. `/?onboarding=1` opens the baseline or starts it once.

## Frozen content

`api/_lib/onboarding-data.ts` defines `first-ten-v1`, including dates, source
links, explanation, units, maximum bounds and glossary definitions. Answers
never enter the client bundle. The installation script persists an immutable
release and dedicated `usage_type='onboarding'` question records outside the
daily pool. Existing glossary components display the definitions; onboarding
snapshots also preserve their original wording.

The order is median age (2020, UN rounded benchmark), EU multilingualism
(2023 survey, ages 15+), urbanization (1950, UN 2018 report), agricultural
employment (2022), US food spending (2024), seaborne goods trade (UNCTAD rounded
reference), nuclear electricity (2024), freshwater in ice (USGS reference
inventory), genome sequencing (May 2022 NHGRI production benchmark), and women
in national parliaments (1 January 2026). Reference estimates are not presented
as live measurements. The genome benchmark retains the existing bank's dated
NHGRI observation. Future revisions must use a new version and question IDs.

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
