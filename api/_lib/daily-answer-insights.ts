import type { AnswerInsight } from "../../shared/answer-insight.js";

// Editorial review: 2026-09-13. Historical comparisons retain their dates.
// Server-only: these facts must never accompany an unanswered question.
const entry = (short: string, more: string, sources: [string, string][]): AnswerInsight => ({
  short, more, sources: sources.map(([label, url]) => ({ label, url })),
});
const wb = (countries: string, indicator: string, years: string) =>
  `https://api.worldbank.org/v2/country/${countries.replaceAll(";", "%3B")}/indicator/${indicator}?date=${years}&format=json&per_page=1000`;

export const dailyAnswerInsights: Record<string, AnswerInsight> = {
  "6d8f9967-d998-4bf4-9092-296c0ff4e5fa": entry(
    "China’s high-speed rail network grew to five times its 2012 length by 2024.",
    "It expanded from 9,356 to 48,000 kilometres in twelve years. In 2024 alone, China opened another 2,457 kilometres of high-speed track.",
    [["China State Council · Rail network, 2024", "https://english.www.gov.cn/news/202502/13/content_WS67ad629bc6d0868f4e8ef9c2.html"]]),
  "1e15c9c3-bb3d-4ce2-b9f9-11e1771ad95b": entry(
    "The Dutch floodplain covers more than twice as much land as the area below sea level.",
    "PBL puts the flood-prone share at 59%, compared with 26% below sea level: rivers can also flood land above the sea. The 1953 flood killed more than 1,800 people and led to the Delta Works, a vast system of coastal barriers and dams.",
    [["PBL · Flood risks in the Netherlands", "https://themasites.pbl.nl/o/flood-risks/"]]),
  "d1ebc954-164b-4e04-a45c-4c4ac9c0bba1": entry(
    "Singapore packed about 39% more people into each square kilometre in 2024 than in 2000.",
    "Its population density rose from 5,900 to 8,207 over that period. Even within those years, the path was uneven: density fell in 2020 and 2021 before rising again.",
    [["Singapore Department of Statistics · Population density", "https://data.gov.sg/datasets/d_3d227e5d9fdec73f3bcadce671c333a6/view"]]),
  "7aacb178-66ef-4bbe-94ba-2eefa06f24de": entry(
    "About nine-tenths of Singapore’s container traffic is cargo changing ships on its way somewhere else.",
    "The port handled 41.12 million container units in 2024, up 5.4% from 2023. Most of that cargo was passing through Singapore rather than being bought or sold there.",
    [["Maritime and Port Authority · 2024 results", "https://www.mpa.gov.sg/media-centre/details/strong-growth-momentum-for-maritime-singapore"]]),
  "6597b4e9-424f-4d6c-a2b9-4e569265de6d": entry(
    "China’s share of world output rose from about 3.6% in 2000 to 16.8% in 2024.",
    "Those figures convert output into dollars at market exchange rates. Adjust for what money buys locally, and the ranking changes: China’s economy was larger than the US economy in 2024.",
    [["World Bank · GDP at market exchange rates", wb("CHN;USA;WLD", "NY.GDP.MKTP.CD", "2000:2024")], ["World Bank · GDP adjusted for local prices", wb("CHN;USA", "NY.GDP.MKTP.PP.CD", "2024")]]),
  "a7678325-444d-46b3-9843-12557494f22b": entry(
    "The US produced about a quarter of world output in 2024 with only about 4% of its people.",
    "Its economy produced $29.3 trillion, compared with $18.7 trillion in China, at market exchange rates. The US share of world output was about 30% in 2000, versus 26% in 2024.",
    [["World Bank · GDP", wb("CHN;USA;WLD", "NY.GDP.MKTP.CD", "2000:2024")], ["World Bank · Population", wb("USA;WLD", "SP.POP.TOTL", "2024")]]),
  "f913e918-ec5b-493c-a53a-3898d0d8c7c9": entry(
    "South Africa’s inequality would be much higher without taxes and public spending.",
    "A World Bank study of 2010–11 put its income Gini at 0.77 before taxes and social spending, and 0.59 after them. That is a comparison within an older study, rather than a measure of change since then: public services such as health and education were counted alongside cash income.",
    [["World Bank · South Africa fiscal redistribution study, 2014", "https://www.worldbank.org/en/country/southafrica/publication/south-africa-economic-update-fiscal-policy-redistribution-unequal-society"]]),
  "53ac3dae-3cc4-4c3f-8598-f4c247461953": entry(
    "Spain’s unemployment rate more than halved after 2013, yet remained over three times Germany’s in 2024.",
    "It fell from 26.1% in 2013 to 11.4% in 2024. Germany’s rate was 3.4% in 2024, using the same international measure.",
    [["ILO estimates · World Bank", wb("ESP;DEU", "SL.UEM.TOTL.ZS", "2013:2024")]]),
  "edab299a-a721-4c8d-8a6f-255646b05465": entry(
    "Even after falling in 2024, the US overnight interest rate was far above its early-2022 level.",
    "The effective federal funds rate was 0.08% on the first trading day of 2022. It began 2024 at 5.33% and ended the year at 4.33%.",
    [["Federal Reserve Bank of New York · Daily rate history", "https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2022-01-03&endDate=2024-12-31"]]),
  "a1b5ddc6-979c-4e00-8a42-75fcaa85ceda": entry(
    "US nuclear plants generated about 91% of their full-power potential in 2024.",
    "Wind farms reached about 34%, and utility-scale solar panels about 23%. These figures compare actual generation with running at full power all year; weather and daylight limit wind and solar output.",
    [["US EIA · Electric Power Annual 2024, table 4.08", "https://www.eia.gov/electricity/annual/pdf/epa.pdf"]]),
  "42e9ce1c-61b4-4786-8efc-05f223b25849": entry(
    "Nearly nine in ten new Norwegian cars were electric in 2024, but fewer than three in ten cars on the road were.",
    "Electric cars made up 88.9% of new passenger-car registrations, up from 82.4% in 2023. Their share of the whole car fleet was only about 28%: replacing cars already on the road takes much longer than changing new sales.",
    [["OFV · New-car sales, 2024", "https://ofv.no/aktuelt/2025/nybilsalget-i-2024-9-av-10-nye-personbiler-var-elbiler"], ["Norwegian government · Electric vehicle fleet", "https://www.regjeringen.no/en/topics/transport-and-communications/veg/faktaartikler-vei-og-ts/norway-is-electric/id2677481/"]]),
  "3a81ece4-a9c0-4242-8e2d-e85f6a38e076": entry(
    "Mauna Loa’s annual CO₂ reading rose by about a third between 1959 and 2024.",
    "The annual average climbed from about 316 to 425 parts per million. The rise also sped up: it averaged about 0.9 parts per million each year from 1959 to 1969, compared with 2.6 from 2014 to 2024.",
    [["NOAA · Mauna Loa annual CO₂ measurements", "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt"]]),
  "d3723888-4569-4cb9-a2b9-1efd202c5cbb": entry(
    "Most of France’s nuclear arsenal is assigned to submarines.",
    "Researchers estimated about 240 submarine-launched warheads and 50 for aircraft in 2025. The total of about 290 had stayed broadly stable for a decade.",
    [["FAS · French nuclear weapons, 2025", "https://thebulletin.org/premium/2025-07/french-nuclear-weapons-2025/"], ["RECNA · French arsenal, 2025", "https://www.recna.nagasaki-u.ac.jp/recna/bd/files/04_france_2025_en.pdf"]]),
  "72ae7693-7798-48e1-9265-8941cd874ceb": entry(
    "Women in Rwanda’s lower house hold far more seats than its quota requires.",
    "Of its 80 seats, 24 are reserved for women. After the 2024 election, women held 51 seats, so more than half of its women MPs occupied seats outside that reserved group.",
    [["UN Rwanda · Parliamentary representation, 2024", "https://rwanda.un.org/en/282783-rwanda-reaffirms-its-unwavering-commitment-gender-equality-638-cent-women-chamber-deputies"]]),
  "78d133e2-43dd-4254-90f9-36fa08d4b19c": entry(
    "The most recent US constitutional amendment took more than 200 years to become law.",
    "Congress proposed it in 1789, but enough states approved it only in 1992. It prevents a change in congressional pay from taking effect before the next House election.",
    [["US National Archives · Amendments 11–27", "https://www.archives.gov/founding-docs/amendments-11-27"]]),
  "c8108aac-5ad4-421c-a8b8-1b6a9ded007f": entry(
    "The first CRISPR treatment won US approval in 2023, for sickle cell disease.",
    "Casgevy edits a patient’s own blood stem cells so they make more of the form of haemoglobin used before birth. In the trial reported at approval, 29 of the 31 patients with enough follow-up went at least a year without a severe pain crisis.",
    [["FDA · First CRISPR treatment approval, December 2023", "https://content.govdelivery.com/accounts/USFDA/bulletins/37efce0"]]),
  "dfead12a-2751-4788-ab45-174f13cb67aa": entry(
    "Scientists once expected about 100,000 human genes—roughly five times today’s protein-coding count.",
    "By 2004, the finished genome sequence had brought the estimate down to 20,000–25,000. Protein-coding regions make up only about 1.5% of the human genome.",
    [["NHGRI · Finished human genome, 2004", "https://www.genome.gov/12513430/2004-release-ihgsc-describes-finished-human-sequence"], ["NHGRI · Genes and the genome", "https://www.genome.gov/genetics-glossary/Gene"]]),
  "a8d275a9-f273-476a-af70-9d903ee2f544": entry(
    "Male life expectancy in Sierra Leone rose by about 16 years between 2000 and 2023.",
    "It increased from about 44 years in 2000 to 53 in 2013, then reached 60 in 2023. The low level in the question sits alongside a large improvement over a single generation.",
    [["World Bank · Male life expectancy", wb("SLE", "SP.DYN.LE00.MA.IN", "2000:2023")]]),
  "c76389bc-23e4-4475-969c-2d605abe4587": entry(
    "Vegetarianism remained a small minority choice across more than twenty years of Gallup polling.",
    "About 6% of US adults called themselves vegetarian in 1999, compared with 4% in 2023. Only 1% described themselves as vegan in the 2023 poll.",
    [["Gallup · Vegetarian and vegan identification, 2023", "https://news.gallup.com/poll/510038/identify-vegetarian-vegan.aspx"]]),
  "c58405a5-d624-4f8c-9867-e8c6e600e07e": entry(
    "Plants can run short of nitrogen while surrounded by air that is mostly nitrogen.",
    "Most plants cannot use nitrogen gas directly because its two atoms are bound tightly together. Bacteria, including those living in the roots of legumes, turn it into compounds plants can absorb.",
    [["NOAA · The nitrogen cycle", "https://gml.noaa.gov/outreach/info_activities/pdfs/TBI_nitrogen_cycle.pdf"]]),
  "d5186ee3-92c5-4d78-b916-00d72171f196": entry(
    "Most people forced from home remain inside their own country.",
    "At the end of 2024, 73.5 million people were displaced within their countries by conflict or violence—more than twice the 31 million refugees under UNHCR’s mandate. Even among refugees who had crossed a border, most were hosted in neighbouring countries.",
    [["UNHCR · Global Trends 2024", "https://www.unhcr.org/sites/default/files/2025-06/global-trends-report-2024.pdf"]]),
  "2597594b-ea42-433c-a4c1-09ccc577db68": entry(
    "The world’s fertility rate more than halved between 1970 and 2023.",
    "It fell from about 4.8 children per woman to 2.2. South Korea’s decline was steeper still: from about 4.5 in 1970 to 0.7 in 2023.",
    [["World Bank · Fertility over time", wb("WLD;KOR", "SP.DYN.TFRT.IN", "1970:2023")]]),
  "3da4f0e9-6b9e-465f-aa22-6d1cb68e7c27": entry(
    "South Korea’s very low fertility rate in 2024 was actually an increase.",
    "It rose from 0.72 children per woman in 2023 to 0.75 in the provisional 2024 figures. That was the first rise since 2015, when the rate was 1.24.",
    [["Statistics Korea · Birth statistics, 2024 provisional", "https://www.kostat.go.kr/boardDownload.es?bid=11773&list_no=436027&seq=2"]]),
  "bf6193f7-e025-4c82-9951-886cd1f205f4": entry(
    "Malicious bots alone generated more than a third of the web traffic in Imperva’s 2024 sample.",
    "Their share rose from 32% in 2023 to 37% in 2024. Including other automated traffic brought the bot total to 51%, just ahead of humans.",
    [["Imperva / Thales · Bad Bot Report 2025", "https://cpl.thalesgroup.com/about-us/newsroom/2025-imperva-bad-bot-report-ai-internet-traffic"]]),
};

export const remainingLegacyInsights: Record<string, AnswerInsight> = {
  "40a00001-0000-4000-8000-000000000002": entry(
    "Young Europeans were much more likely to speak another language than the population as a whole.",
    "In the survey published in 2024, 79% of people aged 15–24 said they could hold a conversation in another language, compared with 59% overall. Among that younger group, 39% could do so in at least two other languages.",
    [["European Commission · Europeans’ language skills", "https://translation.ec.europa.eu/languages-eu-why-multilingualism-matters/europeans-language-skills_en"]]),
  "40a00001-0000-4000-8000-000000000005": entry(
    "Farmers receive a much smaller slice of a restaurant dollar than a grocery dollar.",
    "In 2024, US farms received about 7 cents per dollar spent on food away from home, compared with about 19 cents for food bought to eat at home. The figures come from USDA’s updated 2026 model of where food spending goes.",
    [["USDA ERS · Farm share of food spending, 2024", "https://ers.usda.gov/data-products/charts-of-note/114103"]]),
};
