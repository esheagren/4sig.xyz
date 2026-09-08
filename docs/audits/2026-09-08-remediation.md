# Question-bank remediation — September 8, 2026

This implements the first repair pass from the [109-question audit](2026-09-08-question-bank.md). It does not certify the entire old bank.

## Result

| State | Questions | Meaning |
|---|---:|---|
| Ready | 24 | 19 core topics and 5 occasional reference questions, rechecked against named sources |
| Needs review | 42 | Useful candidates held out of future editions until their evidence and definitions are repaired |
| Retired | 43 | 31 weak questions, the duplicate Japan median-age record, and 11 already inactive records |

The old 98-question active bank is intentionally smaller. Twenty-four questions provide six days of four questions by raw count; the topic mix and reference limit mean this is not a promise of six entirely nonrepeating editions. This is a launch-quality repair pass, not sufficient long-term variety. The next work should restore high-value questions from the backlog, then expand coverage, especially AI, housing, China and public health.

## Repairs

Follow-up: Q004 now asks “Approximately how many genes in the human genome code for proteins?” and stores **20,000 genes**, rather than 20 thousands. The table below records the initial repair pass; the [gene-unit correction](../../editorial/releases/2026-09-08-gene-units.json) supersedes that row.

Prompts now name the relevant observation period and denominator. Reveals explain what the number means without unsupported extra statistics. Dated observations are not presented as the latest available figures; some are retained as explicit 2023–2025 baselines. Provisional estimates and provider-specific samples are identified.

Notable corrections include whole-port Singapore container throughput (41.12 million TEU), annual Norwegian zero-emission new-car registrations (88.9% in 2024), nuclear's share of US electricity rather than all energy (about 18% in 2024), and the effective federal funds rate rather than a target midpoint (4.33% on December 31, 2024). The CRISPR register question now asks total tracked gene-editing trials, rather than mislabeling all 250 as active CRISPR trials. GDP shares use a common World Bank vintage and market-exchange-rate denominator.

World Bank API observations were retrieved September 8, 2026 from the July 13, 2026 WDI vintage. NOAA's annual Mauna Loa data file was dated August 5, 2026. Source-specific evidence and any arithmetic/rounding are recorded in the release manifest. For the 2022 South Africa Gini observation, the WDI index of 54.1 is expressed as 0.541 on the question's existing 0–1 scale.

| Audit ID | Revised question | Scored answer | Source | Review due |
|---|---|---:|---|---|
| Q004 | Approximately how many thousands of protein-coding genes are in the human genome? | 20 thousands | [National Human Genome Research Institute](https://www.genome.gov/genetics-glossary/Gene) | 2027-09-08 |
| Q005 | Approximately what share of world GDP did China account for in 2024, at market exchange rates? | 16.8 % | [World Bank — World Development Indicators](https://api.worldbank.org/v2/country/CHN/indicator/NY.GDP.MKTP.CD?date=2024&format=json) | 2027-03-08 |
| Q009 | How many people per square kilometre did Singapore have in 2024? | 8,207 people/km² | [Singapore Department of Statistics — Population Trends 2024](https://www.singstat.gov.sg/-/media/files/publications/population/population2024.pdf) | 2027-03-08 |
| Q010 | Approximately how many children per woman did the global fertility rate imply in 2023? | 2.2 children per woman | [World Bank — World Development Indicators](https://api.worldbank.org/v2/country/WLD/indicator/SP.DYN.TFRT.IN?date=2023&format=json) | 2027-03-08 |
| Q013 | What was South Africa’s Gini coefficient in the World Bank’s 2022 estimate, on a scale from 0 to 1? | 0.541 coefficient (0-1) | [World Bank — World Development Indicators](https://api.worldbank.org/v2/country/ZAF/indicator/SI.POV.GINI?date=2022&format=json) | 2027-03-08 |
| Q018 | About how many gene-editing clinical trials did CRISPR Medicine News track in February 2025? | 250 count | [CRISPR Medicine News — clinical trial register](https://crisprmedicinenews.com/clinical-trials/) | 2026-12-08 |
| Q019 | What was the effective federal funds rate on the last day of 2024? | 4.33 % | [Federal Reserve Bank of New York](https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2024-12-31&endDate=2024-12-31) | 2027-03-08 |
| Q020 | Approximately how many kilometres of high-speed railway were operating in China at the end of 2024? | 48,000 km | [State Council of China — railway statistics](https://english.www.gov.cn/news/202502/13/content_WS67ad629bc6d0868f4e8ef9c2.html) | 2027-03-08 |
| Q021 | What was the annual average atmospheric CO₂ concentration at Mauna Loa in 2024? | 424.61 ppm | [NOAA Global Monitoring Laboratory](https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt) | 2027-03-08 |
| Q025 | Approximately what percentage of Dutch land lies below sea level, according to PBL? | 26 % | [PBL Netherlands Environmental Assessment Agency](https://themasites.pbl.nl/o/flood-risks/) | 2027-09-08 |
| Q031 | Approximately what was male life expectancy at birth in Sierra Leone in 2023? | 60.1 years | [World Bank — World Development Indicators](https://api.worldbank.org/v2/country/SLE/indicator/SP.DYN.LE00.MA.IN?date=2023&format=json) | 2027-03-08 |
| Q033 | In Gallup’s July 2023 poll, what percentage of US adults described themselves as vegetarian? | 4 % | [Gallup — Consumption Habits poll, 2023](https://news.gallup.com/poll/510038/identify-vegetarian-vegan.aspx) | 2027-03-08 |
| Q037 | How many twenty-foot equivalent units of containers did the Port of Singapore handle in 2024? | 41,120,000 TEU | [Maritime and Port Authority of Singapore](https://www.mpa.gov.sg/media-centre/details/strong-growth-momentum-for-maritime-singapore) | 2027-03-08 |
| Q041 | Approximately what share of world GDP did the United States account for in 2024, at market exchange rates? | 26.2 % | [World Bank — World Development Indicators](https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD?date=2024&format=json) | 2027-03-08 |
| Q048 | About how many nuclear warheads did the Federation of American Scientists estimate France had in July 2025? | 290 count | [FAS Nuclear Notebook — French nuclear weapons, 2025](https://thebulletin.org/premium/2025-07/french-nuclear-weapons-2025/) | 2026-12-08 |
| Q053 | What was South Korea’s total fertility rate in the provisional figures for 2024? | 0.75 children per woman | [Statistics Korea — Birth and Death Statistics in 2024](https://www.kostat.go.kr/boardDownload.es?bid=11773&list_no=436027&seq=2) | 2026-12-08 |
| Q059 | After Rwanda’s 2024 election, what percentage of seats in its lower house were held by women? | 63.75 % | [Inter-Parliamentary Union — November 2024 ranking](https://data.ipu.org/women-ranking/?date_month=11&date_year=2024) | 2027-03-08 |
| Q066 | About how many refugees were under UNHCR’s mandate at the end of 2024? | 31,000,000 count | [UNHCR — Global Trends 2024](https://www.unhcr.org/sites/default/files/2025-06/global-trends-report-2024.pdf) | 2027-03-08 |
| Q074 | What was Spain’s annual unemployment rate in 2024, according to the ILO estimate? | 11.4 % | [World Bank — ILO modeled estimates](https://api.worldbank.org/v2/country/ESP/indicator/SL.UEM.TOTL.ZS?date=2024&format=json) | 2027-03-08 |
| Q077 | Approximately what percentage of dry air is nitrogen, by volume? | 78.084 % | [NOAA — JetStream: The Atmosphere](https://www.noaa.gov/jetstream/atmosphere) | 2027-09-08 |
| Q078 | As of September 2026, how many amendments had been ratified to the US Constitution? | 27 count | [US National Archives](https://www.archives.gov/founding-docs/amendments-11-27) | 2027-09-08 |
| Q083 | In Imperva’s 2024 web-traffic analysis, what percentage of traffic came from automated bots? | 51 % | [Thales / Imperva — 2025 Bad Bot Report](https://cpl.thalesgroup.com/about-us/newsroom/2025-imperva-bad-bot-report-ai-internet-traffic) | 2027-03-08 |
| Q086 | What percentage of new passenger cars registered in Norway in 2024 were zero-emission vehicles? | 88.9 % | [Norwegian Road Federation (OFV)](https://ofv.no/bilsalget/bilsalget-i-desember-2024) | 2027-03-08 |
| Q101 | Approximately what percentage of US electricity generation came from nuclear power in 2024? | 18 % | [US Energy Information Administration](https://www.eia.gov/energyexplained/us-energy-facts/data-and-statistics.php) | 2027-03-08 |

Follow-up: Q011 has also been repaired and admitted through the [sequencing-cost correction](../../editorial/releases/2026-09-08-sequencing-cost.json), using NHGRI’s May 2022 benchmark. The initial inventory and research queue below remain a record of the first pass; this brings the live bank to 25 ready, 41 needing review and 43 retired.

## Product and data safeguards

- Source lists are rendered as individual links in both round reveals and the final recap. This fixes the 95 active legacy records that packed several URLs into a single broken link, including links in old game snapshots.
- A review gate keeps `needs_review`, retired and overdue questions out of future selection. Every newly admitted question has a definition, geography, period, evidence note and review deadline.
- Future editions contain four eligible questions, favor different topics and least-recent use, and contain no more than one occasional reference. The imported taxonomy remains archived; reviewed topics drive selection.
- Today's edition, past schedules, and any already-started future edition retain frozen wording and answers. Existing game snapshots, answers and scores are preserved. The release checks their fingerprints and takes a private backup before committing.
- No question records or user accounts are deleted. Retired placeholders can be rebuilt later if the underlying subject earns a place.

## Research queue

Start with renewable and solar electricity shares, Japan/Niger population age, the US incarceration measure, and well-defined health and technology questions. The current sources for these were not fully recertified in this pass. In particular, a plausible stored answer or a secondary citation was not enough to mark a record ready.

| Audit ID | Question held for review | Required work |
|---|---|---|
| Q001 | How many living species have been scientifically described and catalogued as of 2025? | Useful biodiversity anchor; bind the count to the January 2025 catalogue release and trim speculative synonym estimates in the reveal. |
| Q002 | What percentage of global electricity generation came from renewable sources in 2024? | Strong topic and dated prompt; replace the 2024 report citation with the 2025 report covering 2024, and verify the generation breakdown. |
| Q003 | What is the incarceration rate per 100,000 people in the United States as of 2025? | Keep; define which detention populations the rate includes and the observation date, then check the numerator and population denominator together. |
| Q007 | What is the current median age in years in Japan? | Keep one Japan median-age question; specify UN revision and observation year. Merge the duplicate at Q017. |
| Q008 | How many Nobel Prizes have been awarded to women from 1901 through 2024? | Prompt asks prizes through 2024, while notes distinguish women from awards and use an inconsistent count. Recount dated official laureate entries. |
| Q011 | What is the cost in USD to sequence a full human genome? | A vendor's minimum sequencing cost is not an all-in clinical genome price. Fix platform, coverage, date, and included costs. |
| Q015 | What is the current percentage of global electricity generation provided by solar photovoltaics? | Keep; replace current with a named annual period, cite the matching report, and avoid clustering it with the renewable-share question. |
| Q016 | What is the median age of the population in Niger? | Strong counterpart to Japan; specify Niger's reference year and UN revision and verify the extra fertility claims. |
| Q022 | How many living languages are currently cataloged? | Language diversity can earn a place; specify Ethnologue edition, then explain language loss rather than relying on a catalog count alone. |
| Q024 | What is the current installed capacity of wind energy in Texas in gigawatts? | Keep with year and official capacity table; distinguish Texas from ERCOT and capacity from generation in the reveal. |
| Q027 | What is the total tonnage of plastic estimated to be floating in the Great Pacific Garbage Patch? | Worthwhile if tied to a particular study estimate; disclose uncertainty and avoid mixing the 2018 estimate with a later website summary. |
| Q028 | What is the current yield on the US 10-Year Treasury note? | Replace current with an explicit observation date or monthly average. A December 2025 snapshot cannot remain a live-market question. |
| Q029 | How many distinct active satellites are currently tracked in Low Earth Orbit? | Useful space-infrastructure topic, but 8,800 is an inference from all-orbit totals and an approximate share. Use a direct, dated LEO count; remove unrelated exoplanet URL. |
| Q030 | What is the average latency in milliseconds between New York and London via the fastest fiber optic cable? | Potential latency yardstick; the source is a 2015 route claim. Define endpoints and round-trip versus one-way, and drop unsupported current-fastest/average wording. |
| Q032 | What is the current number of unicorn companies (startups valued over $1B)? | Keep only with named registry/date and a reason unicorn counts illuminate investment scale. Registry definitions currently conflict. |
| Q035 | What is the total number of Wikipedia articles in the English language? | Possible knowledge-infrastructure scale question; date the Wikimedia count and reduce meaningless precision and incidental statistics. |
| Q040 | What is the distance to the Voyager 1 probe in Astronomical Units right now? | Possible space-distance yardstick; anchor date and Earth-versus-Sun distance, or replace with a stable Earth–Sun/light-time reference. |
| Q047 | What is the average height of a Dutch male born in 2000? | Can illustrate nutrition and cohort change; fix birth-year and measurement-age mismatch rather than treating height as generic trivia. |
| Q049 | What is the percentage of global caloric intake provided by rice? | Strong food-system fact; use a dated FAO food-balance measure and distinguish calories supplied from calories actually consumed. |
| Q051 | What is the current prevalence of myopia in urban Asian teenagers? | Important public-health topic, but urban Asian teenagers is not a defined population. Choose age, geography, year, study, and diagnostic threshold. |
| Q052 | How many milliseconds does it take for light to travel from the Moon to Earth? | Good reusable light-time yardstick. Say mean Earth–Moon distance and use a primary astronomical reference; do not imply constant distance. |
| Q054 | What is the estimated number of synapses in the average adult human brain? | A broad synapse estimate is poorly suited to exact-bound scoring. Reframe to a named study estimate or choose a better measured biology yardstick. |
| Q056 | What is the current population density of Manila in people per square kilometer? | Define city proper versus metropolitan area and use one census boundary. The notes' population divided by area does not produce the stored density. |
| Q057 | How many patents were granted by the USPTO last year? | Innovation subject worth keeping, but distinguish utility patents from all grants and calendar from fiscal year. Replace last year with a fixed official reporting period. |
| Q060 | How many distinct indigenous groups are recognized in Brazil? | Could illuminate census recognition and diversity; specify IBGE 2022 ethnic-group definition and use the primary release rather than an undated count. |
| Q062 | What is the current market capitalization of the largest publicly traded company in the world? | Concentration and AI investment are strong subjects; name the company and market close/date or choose a less volatile revenue/investment measure. |
| Q063 | How many distinct subway stations are there in the New York City Transit system? | Useful transit scale reference; name the MTA station-count convention and date. Ridership or access may be a stronger core question. |
| Q064 | What is the current price of a standard shipping container from Shanghai to Los Angeles? | Prompt sounds like container purchase price but notes are a freight spot rate. Specify shipment, 40-foot unit, route, date, and benchmark coverage. |
| Q067 | How many active aircraft carriers does the Indian Navy currently operate? | Useful strategic-capacity anchor in moderation; define commissioned/in-service carriers and the reference date using a naval source. |
| Q069 | How many years is it estimated the longest-lived vertebrate (Greenland Shark) lives for? | Fun biological scale question, but 400 summarizes an uncertain individual-age estimate, not a precise species lifespan. Reframe or use outside ranked play. |
| Q070 | What is the percentage of the French population that smokes daily? | Strong public-health topic; the prompt says the French population while notes concern surveyed adults and mix 2021 with 2025. Specify ages/year and daily smoking. |
| Q071 | What is the depth of the Mariana Trench in meters? | Good physical-scale yardstick; specify deepest measured point, survey, and approximation instead of treating measurement revisions as error. |
| Q079 | What is the current debt-to-GDP ratio of Japan? | Central versus general government and gross versus net debt are mixed. Use a defined debt-to-nominal-GDP series and reference period. |
| Q081 | How many active volcanoes are there worldwide? | Stored count is potentially active volcanoes, not currently erupting ones. Specify definition and registry/date; a hazard-exposure measure may be stronger. |
| Q082 | What is the half-life of Carbon-14 in years? | Useful dating-timescale yardstick; retain sparingly with a primary physical reference and concise explanation of what the scale enables. |
| Q088 | What is the current inflation rate in Argentina? | Strong inflation example; state month/year and year-on-year CPI, use INDEC, and keep monthly and annual rates separate. |
| Q093 | What is the percentage of the world's population that is lactose intolerant? | 68% describes lactose malabsorption, not necessarily symptomatic intolerance. Align condition, adult population, and study definition. |
| Q096 | What is the percentage of global greenhouse gas emissions attributed to cement production? | Prompt asks all greenhouse gases; notes support a CO2 share. Specify CO2, production/process boundary, reference year, and source estimate. |
| Q097 | What is the number of active subscribers to the New York Times Digital edition? | Paid-news scale can be useful occasionally; specify digital-only subscribers and quarter and use company filings rather than secondary summaries. |
| Q105 | What is the current R0 (reproduction number) of the most prevalent flu strain? | Important transmission concept, unsupported current-strain estimate. The linked older study cannot establish the claimed 2025 strain R0; choose a named study or a better measured burden statistic. |
| Q106 | How many distinct skyscrapers (over 150m) are in Shenzhen? | Possible urban-growth comparison; specify completed buildings above 150m, registry, and date, or prefer housing and density measures. |
| Q108 | What is the current homicide rate per 100k people in El Salvador? | Important safety topic; fix completed-year versus projection, official reporting scope, denominator, and exclusions. Do not present a contested reported count as unquestioned current truth. |

The [release manifest](../../editorial/releases/2026-09-08.json) records all 109 dispositions and their reasons. The [editorial workflow](../../editorial/README.md) covers subsequent repairs, review dates and deployment.
