# Question bank audit — September 8, 2026

## Conclusion

The bank contains a useful foundation, but it is not yet a consistently curated collection of numbers that matter. The biggest issue is the quality and definition of the individual questions, not simply their age or the number of facts available.

Of **98 active questions**, this editorial review recommends retaining **43 core subjects**, keeping **23 as occasional supporting questions**, replacing **31**, and merging **one duplicate**. Retain means the subject is worth developing; it does **not** certify its current answer. Many of the best topics have some of the most consequential definition problems.

Separately, **40 active questions are flagged P0**: resolve the definition, contradictory notes, unsupported numerical inference, or source mismatch before serving the same wording again. This is a remediation recommendation, not a claim that 40 answers have been independently proven false. Another 35 have P1 work, and 23 have P2 work. No question, answer, active flag, daily schedule, or completed-game record was changed by this audit.

## Scope and method

Read all 109 rows from the production Neon `questions` table, their units and taxonomy, the actual question-column schema, and the 32 published schedule rows from September 8–15. The extraction used a PostgreSQL read-only transaction and did not read accounts, credentials, or game answers. Snapshot time is recorded in the linked inventory.

Every prompt, stored answer, source field, and explanation was reviewed. The complete [question-by-question review](2026-09-08-question-inventory.md) maps all recommendations to full database IDs. Editorial classifications are judgments against the [brand brief](../brand-and-editorial-brief.md).

Six targeted external checks are documented below. This is a full editorial and internal-consistency audit with targeted factual checking, **not a fresh independent verification of every stored answer or every source URL**. Source access failures were not interpreted as proof that a claim was false. No replacement answer should be published solely because it appears in this report; first finalize its precise prompt and source period.

## Inventory

| Measure | Finding |
| --- | ---: |
| Stored questions | 109 |
| Active daily questions | 98 |
| Inactive questions | 11 |
| Active core topics worth developing | 43 |
| Active occasional/supporting questions | 23 |
| Active questions recommended for replacement | 31 |
| Active duplicate recommended for merge | 1 |
| Active changing quantities, by manual classification | 72 |
| Active reference quantities, by manual classification | 26 |
| Active prompts with relative-time wording | 38 |
| Active prompts containing an explicit calendar year | 8 |
| Active records with multiple URLs packed into `source_url` | 95 |
| Active records missing a source URL entirely | 0 |

Relative-time wording means current/currently/right now/last year/latest/most recent. A year appearing in a prompt does not necessarily establish the answer's measurement period: one is a birth-cohort year. Changing quantities include catalog counts and live prices, so the 72 changing facts should not be mistaken for 72 strong editorial choices.

All 109 creation timestamps fall on December 18, 2025. This does not establish when their answers were last verified; there is no dedicated verification-date field. The 11 inactive records consist of ten zero-valued unfinished placeholders and the negative-temperature question previously retired. They are not eleven legitimate zero-answer facts.

At four per day, 98 questions provide only 24 full editions plus two questions before a repeat is mathematically unavoidable if each question is used once. The scheduler can repeat earlier: its preference is to avoid the preceding seven days, not to exhaust the bank first.

## What deserves to stay

The strongest material concerns fertility and aging, economic size and inequality, electricity and decarbonization, cities and transport, refugees, public health, and geopolitical capacity. These subjects can accumulate into a useful understanding of the world.

Examples: China's and the US's shares of world GDP; Japan's and Niger's median ages; global and South Korean fertility; renewable electricity; solar electricity; China's rail network; refugee numbers; smoking; public debt; and shipping costs. Each requires a fixed measure and period rather than generic current wording.

The duplicate is Japan's median age: Q007 and Q017 both store 49.8 under slightly different prompts. They represent one editorial subject, not two different learning opportunities.

Useful occasional references include Earth–Moon light time, atmospheric nitrogen, carbon-14's half-life, the depth of Challenger Deep, the approximate human protein-coding gene count, and land below sea level in the Netherlands. These should provide perspective without crowding out contemporary quantitative literacy. Other occasional questions need stronger framing before earning that status.

## What should be replaced

The 31 replacement recommendations concern questions with weak explanatory payoff, excessive specialization, or both. Examples include technetium isotope mass, vancomycin functional groups, the number of primes below a million, phonemes in Rotokas, Linux kernel line count, longest chess game, LEGO pieces manufactured, and Unicode 15.0's character count.

This is not a verdict that the subjects are uninteresting. They do little work toward the stated purpose in their current form. For example, replacing the Linux line count with a measure of digital infrastructure, or a weekly oil-rig count with oil production or productivity, preserves the broader subject while improving its usefulness.

## Evidence of factual and definition risk

| Question | Problem | Evidence and required correction |
| --- | --- | --- |
| Q018, active CRISPR-Cas9 trials | The stored 250 is all tracked gene-editing trials, not the requested active Cas9 subset. | The register's February 2025 description distinguishes approximately 250 tracked trials from more than 150 active trials and includes multiple editing technologies. Use a defined registry query and dated status. [CRISPR Medicine News register](https://crisprmedicinenews.com/clinical-trials/) |
| Q019, effective federal funds rate | Notes call the target-range midpoint the effective rate. | EFFR is a volume-weighted median of reported overnight transactions. The midpoint is a different quantity. Use an actual NY Fed observation with a date. [New York Fed methodology](https://www.newyorkfed.org/markets/reference-rates/effr.html) |
| Q037, Singapore port containers | Whole-port prompt stores a PSA-terminal number and uses “last year.” | MPA reports 41.12 million TEUs for PSA and Jurong Port together in 2024. That differs from the stored 40.9 million PSA figure. Use the whole-port observation and explain TEU. [MPA 2024 performance release](https://www.mpa.gov.sg/media-centre/details/strong-growth-momentum-for-maritime-singapore) |
| Q083, bot-generated internet traffic | A vendor-network web-traffic observation is presented as all current internet traffic. | The cited 2025 report analyzes 2024 data from Imperva's global network. Bind the prompt to that report, year, and measured scope. [Thales/Imperva research description](https://cpl.thalesgroup.com/about-us/newsroom/2025-imperva-bad-bot-report-ai-internet-traffic) |
| Q093, lactose intolerance | Stored notes use malabsorption prevalence as symptomatic intolerance prevalence. | These are different conditions: people can have malabsorption without symptoms. Use the condition actually measured by the study. [NIH explanation](https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance), [research review](https://pmc.ncbi.nlm.nih.gov/articles/PMC6839734/) |
| Q101, US nuclear energy share | Prompt asks total energy production; the answer and notes concern electricity generation, including a monthly figure. | EIA reports primary energy production separately from electricity generation; its 2024 summary assigns nuclear different shares to the two denominators. Select one measure and an explicit annual period. [EIA energy statistics](https://www.eia.gov/energyexplained/us-energy-facts/data-and-statistics.php) |

Additional flags come directly from stored records and need primary-source follow-up:

- Q005/Q041 omit nominal versus PPP GDP; Q079 mixes debt concepts.
- Q020 describes a forecast as an operating rail-network count; Q021 substitutes a seasonal CO2 peak for an unspecified current level.
- Q031 asks for male life expectancy but links the World Bank's both-sexes series.
- Q056's stated population divided by stated area does not reproduce its stored density; city proper and metropolitan boundaries are mixed.
- Q059 asks about parliament but uses the lower house; Q064 asks a container “price” but stores a freight rate.
- Q084's own explanation cites a 272-move game after calling a 269-move game the longest.
- Q090 confuses distinct brick types with total pieces and includes an unrelated shipwreck source.
- Q096 asks for greenhouse gases while its explanation supports a CO2 claim.
- Q105 attaches a current-strain R0 estimate to an older study without establishing that estimate. A point answer cannot be justified by a generic seasonal-flu range.

## Sourcing and maintenance are product issues

**Citation links:** 95 active records store semicolon-separated URL lists in a scalar `source_url`. `api/_lib/questions.ts` passes that field through unchanged, and `IntervalGame.tsx` assigns it to one anchor's `href`. The app therefore does not provide separate usable links to the intended sources. Presence of a URL is not the same as usable sourcing. Repair citation rendering, validate each link, and eventually store citations as structured records with their roles.

**Missing editorial metadata:** The actual question table has no dedicated measurement period, geography, denominator/definition, observation-versus-projection status, verified-at date, review-due date, or verification state. `created_at` and `updated_at` cannot substitute for these. These omissions help explain why December 2025 “current” claims remain in a September 2026 game.

**Taxonomy:** All active rows have a category path, but some classifications are misleading: the chess record sits under Sports Betting Volume, shipwrecks under Piracy Incidents, LEGO under Gaming Hardware Sales, and adult bones under Metabolic Rates. Repair the editorial taxonomy before using it to balance daily sets.

**Reveals:** Many explanations contain several extra claims, competing definitions, speculative extrapolations, or interpretive assertions. Each extra number adds a maintenance obligation. Prefer one verified answer, one explanation of why it matters, and at most one useful sourced comparison. Uncertain estimates need a fair treatment consistent with the scoring model; a confident-looking point value is insufficient.

**Preservation:** Keep original snapshots for completed games. Do not silently rewrite historical scores when correcting a source. Any remediation should separately handle question records, not-yet-started editions, and already-started sessions.

## Coverage gaps

The bank's broad labels overstate its fit. It has many biology questions but few on disease burden, prevention, health-system access, or population outcomes. It has technology questions but little direct coverage of AI adoption, investment, compute, economic impact, or energy use. The bot-traffic question is not a substitute for an AI section.

The China coverage is concentrated in GDP share, railway length, and Shenzhen skyscrapers. WeChat exists only as an inactive placeholder. Housing affordability and construction, household incomes, productivity, global poverty, education attainment, public-health progress, and the scale of AI are clear development priorities based on the reviewed prompts. These are proposed areas for sourcing, not newly verified facts.

## Immediate schedule exposure

There are eight already-published four-question editions in the snapshot, September 8–15. The appendix records their question IDs and flags. The September 10 edition is entirely biodiversity/physical-reference material; the September 11 edition includes LEGO pieces and steel sound speed. The scheduler currently selects by activity and recent use, without an editorial relevance, verification, or topic-balance gate.

Resolve or replace P0 items in future, unstarted editions first. Today's edition already includes bot traffic, transatlantic latency, and Norwegian EV share, which need scope or period clarification. This report does not change a live edition mid-game.

## Recommended sequence

1. Fix usable citations and create an editorial ready/needs-review/retired distinction alongside the existing active flag. Define observation periods and a verification record.
2. Repair the strongest core questions first, especially P0 questions already scheduled. Publish dated prompts, primary citations, and shorter explains-why-it-matters reveals.
3. Merge the Japan duplicate and replace the 31 weak-fit questions over time. Keep the 11 inactive records inactive until a deliberate replacement or repair is verified.
4. Build a compact, excellent bank before aiming for 3,000. Fill the substantive coverage gaps and review each four-question edition as a coherent selection.
5. Introduce source-appropriate review intervals. Annual population estimates, quarterly statistics, and daily financial quotes need different handling; some live quotes are better replaced with dated comparisons.

The intended standard is that someone is glad to have learned the answer even after scoring zero.
