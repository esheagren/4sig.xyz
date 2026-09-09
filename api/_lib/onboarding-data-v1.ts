import type { Question } from './types.js';
import { annotateQuestion } from '../../src/lib/glossary.js';

// Immutable, dated reference observations. Never edit a published version in place.
export const ONBOARDING_VERSION = 'first-ten-v1';
const entries = [
  {
    prompt: 'In 2020, approximately what was the median age of the world\'s population?',
    unit: 'years', trueValue: 31, topic: 'Demography', period: '2020',
    source: 'UN DESA - Harnessing the economic dividends from demographic change',
    sourceUrl: 'https://policy.desa.un.org/publications/frontier-technology-issues-harnessing-the-economic-dividends-from-demographic-change',
    answerContext: 'The UN summary gives a rounded global median of 31 years for 2020. Age structure helps explain the demands on schools, workplaces and pensions; countries can have very different age profiles.',
    term: 'median age', definition: 'The age that divides a population into two equal halves: half the people are younger and half are older.'
  },
  {
    prompt: 'In the 2023 EU survey, what percentage of people aged 15 and over said they could hold a conversation in a language other than their mother tongue?',
    unit: '%', trueValue: 59, topic: 'Language', period: 'September-October 2023',
    source: 'European Commission - Special Eurobarometer 540',
    sourceUrl: 'https://luxembourg.representation.ec.europa.eu/actualites-et-evenements/actualites/new-eurobarometer-shows-europeans-positive-attitude-towards-language-learning-2024-05-21_en',
    answerContext: 'This is self-reported conversational ability, not a language exam or a measure of fluency. The survey covered the 27 EU member states; language skills shape opportunities to work, study and connect across borders.',
    term: 'mother tongue', definition: 'A language someone learned first while growing up; a person can have more than one.'
  },
  {
    prompt: 'According to the UN\'s 2018 urbanization report, approximately what percentage of the world\'s population lived in urban areas in 1950?',
    unit: '%', trueValue: 30, topic: 'History and cities', period: '1950; UN 2018 revision',
    source: 'UN DESA - World Urbanization Prospects 2018',
    sourceUrl: 'https://population.un.org/wup/Publications/Files/WUP2018-Report.pdf',
    answerContext: 'The report rounds the 1950 urban share to 30%. It uses national definitions of urban areas, which differ between countries; it is not the newer globally harmonized definition of cities.',
    term: 'urban areas', definition: 'Places classified as urban by each country, typically cities and towns; countries use different size, density and administrative rules.'
  },
  {
    prompt: 'In 2022, what percentage of the world\'s employed people worked in agriculture, forestry and fishing?',
    unit: '%', trueValue: 26.2, topic: 'Work', period: '2022; October 2024 release',
    source: 'FAO - Employment indicators 2000-2022',
    sourceUrl: 'https://www.fao.org/statistics/highlights-archive/highlights-detail/employment-indicators-2000-2022-%28september-2024-update%29/',
    answerContext: 'FAO reports 892 million workers, or 26.2% of total employment, using ILO estimates. This covers primary agriculture, forestry and fishing, rather than every job in the wider food system.',
    term: 'employed people', definition: 'People doing work for pay or profit, including self-employment; the denominator excludes people who are not employed.'
  },
  {
    prompt: 'In 2024, what percentage of total US food spending went to food away from home?',
    unit: '%', trueValue: 58.9, topic: 'Everyday economics', period: '2024',
    source: 'USDA Economic Research Service - Food Prices and Spending',
    sourceUrl: 'https://www.ers.usda.gov/data-products/ag-and-food-statistics-charting-the-essentials/food-prices-and-spending',
    answerContext: 'USDA reports 58.9% for food away from home in 2024. This is a share of spending, not meals or calories, and the national series includes purchases by businesses and government as well as households.',
    term: 'food away from home', definition: 'Food bought from restaurants, takeaways, cafeterias and similar outlets, even if you eat it at home; this measure counts money spent rather than meals.'
  },
  {
    prompt: 'According to UNCTAD\'s maritime trade benchmark, approximately what percentage of international trade in goods is carried by sea, by volume?',
    unit: '%', trueValue: 80, topic: 'Trade', period: 'UNCTAD benchmark, accessed September 2026',
    source: 'UNCTAD - Review of Maritime Transport',
    sourceUrl: 'https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport',
    answerContext: 'UNCTAD describes the share as around 80%; this question uses that published rounded benchmark. It concerns physical goods by volume, not the dollar value of trade or services, and helps explain the importance of ports and shipping routes.',
    term: 'by volume', definition: 'Measured by the physical quantity of cargo rather than its price; bulky, inexpensive goods count heavily in this measure.'
  },
  {
    prompt: 'In 2024, approximately what percentage of the world\'s electricity was generated by nuclear power?',
    unit: '%', trueValue: 9, topic: 'Energy', period: '2024; Global Energy Review 2025',
    source: 'IEA - Global Energy Review 2025: Electricity',
    sourceUrl: 'https://www.iea.org/reports/global-energy-review-2025/electricity',
    answerContext: 'The IEA reports a 9% nuclear share of global electricity generation in 2024. Electricity is only part of energy use; fuels burned directly in transport, heating and industry are outside this denominator.',
    term: 'electricity', definition: 'Electrical energy produced by generators; this excludes fuels used directly for transport or heating.'
  },
  {
    prompt: 'In the USGS global water inventory, what percentage of Earth\'s freshwater is held in ice caps, glaciers and permanent snow?',
    unit: '%', trueValue: 68.7, topic: 'Nature', period: 'USGS reference inventory',
    source: 'USGS - Ice, Snow, and Glaciers and the Water Cycle',
    sourceUrl: 'https://www.usgs.gov/water-science-school/science/ice-snow-and-glaciers-and-water-cycle',
    answerContext: 'The USGS reference inventory places 68.7% of freshwater in ice and permanent snow. The denominator is freshwater, not all water on Earth; this is a reference estimate rather than a live measurement of ice loss.',
    term: 'freshwater', definition: 'Water with very little dissolved salt, including frozen water and groundwater; salty ocean water is excluded.'
  },
  {
    prompt: 'In May 2022, approximately what did it cost in US dollars to sequence a human genome at NIH-funded centers?',
    unit: 'US dollars', trueValue: 525, topic: 'Technology', period: 'May 2022',
    source: 'NHGRI - DNA Sequencing Costs; NHGRI - May 2022 data table',
    sourceUrl: 'https://www.genome.gov/about-genomics/fact-sheets/DNA-Sequencing-Costs-Data; https://www.genome.gov/sites/default/files/media/files/2023-05/Sequencing_Cost_Data_Table_May2022.xls',
    answerContext: 'NHGRI\'s May 2022 production benchmark is $525 per human-sized genome, rounded to the nearest dollar. It includes sequencing labor, supplies and equipment, but not downstream interpretation; it is not a retail clinical test price.',
    term: 'sequence a human genome', definition: 'Read the order of the DNA letters across a person\'s genetic material; interpreting what those letters mean is a separate task.'
  },
  {
    prompt: 'On 1 January 2026, what percentage of seats in national parliaments worldwide were held by women?',
    unit: '%', trueValue: 27.5, topic: 'Political power', period: '1 January 2026',
    source: 'Inter-Parliamentary Union - Women in parliament 2025',
    sourceUrl: 'https://www.ipu.org/news/press-releases/2026-03/womens-representation-in-parliament-sees-sluggish-gains',
    answerContext: 'Women held 27.5% of national parliamentary seats at the start of 2026. This counts seats across parliamentary chambers worldwide, rather than taking an unweighted average of country percentages.',
    term: 'national parliaments', definition: 'National lawmaking bodies, including both chambers where a country has two; this excludes local councils and cabinet positions.'
  },
];
export const onboardingQuestions: Question[] = entries.map((entry, index) => ({
  id: `40a00001-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  prompt: entry.prompt, unit: entry.unit, trueValue: entry.trueValue,
  source: entry.source, sourceUrl: entry.sourceUrl, answerContext: entry.answerContext,
  scoringReference: 1, max: entry.unit === '%' ? 100 : undefined,
  topic: entry.topic, observationPeriod: entry.period,
  glossary: annotateQuestion(entry.prompt, [{
    termId: `first-ten-v1-${index + 1}`, matchText: entry.term,
    title: entry.term, definition: entry.definition,
  }]),
}));
