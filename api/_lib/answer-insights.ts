import type { AnswerInsight } from "../../shared/answer-insight.js";

// Verified editorial context; served only after an answer is revealed.
const insights: AnswerInsight[] = [
  {
    short:
      "The world’s median age rose by about nine years between 1970 and 2020.",
    more: "China’s more than doubled over that period, from about 18 to 37. In 2020, Japan’s median age was about 48, while Niger’s was about 15.",
    sources: [
      {
        label: "UN population estimates · via Our World in Data",
        url: "https://ourworldindata.org/grapher/median-age?tab=table&time=1970..2020&country=OWID_WRL~CHN~JPN~NER",
      },
    ],
  },
  {
    short:
      "By 2018, more than half the world lived in urban areas, up from less than a third in 1950.",
    more: "The number of urban residents grew from 751 million to 4.2 billion over that period. In 2018, Latin America and the Caribbean were 81% urban, compared with 43% in Africa.",
    sources: [
      {
        label: "UN · Urbanization, 2018",
        url: "https://www.un.org/development/desa/en/news/population/2018-revision-of-world-urbanization-prospects.html",
      },
    ],
  },
  {
    short:
      "In 2022, agriculture employed about 86% of workers in Burundi, compared with under 2% in the United States.",
    more: "Worldwide, its share of jobs fell from 40% in 2000 to about 26% in 2022. Yet the value of agricultural output grew by 89% after inflation over the same period.",
    sources: [
      {
        label: "ILO estimates · World Bank",
        url: "https://data.worldbank.org/indicator/SL.AGR.EMPL.ZS?locations=BI-US",
      },
      {
        label: "FAO · Statistical Yearbook 2024",
        url: "https://www.fao.org/newsroom/detail/fao-statistical-yearbook-2024-reveals-critical-insights-on-the-sustainability-of-agriculture-food-security-and-the-importance-of-agrifood-in-employment/",
      },
    ],
  },
  {
    short:
      "A shipping crisis can mean longer journeys even when little more is being traded.",
    more: "In 2023, cargo volume rose by 2.4%, but cargo weight multiplied by distance rose by 4.2%. Disruptions at the Suez and Panama canals sent ships on longer routes.",
    sources: [
      {
        label: "UNCTAD · Maritime Transport 2024",
        url: "https://unctad.org/publication/review-maritime-transport-2024",
      },
    ],
  },
  {
    short:
      "In 2024, nuclear power supplied about 67% of France’s electricity, but just 4.5% of China’s.",
    more: "Yet China generated more nuclear electricity in total: about 418 billion kilowatt-hours, compared with France’s 364 billion. China also had 28 reactors under construction at the end of that year.",
    sources: [
      {
        label: "IAEA · Nuclear Power Status 2024",
        url: "https://pris.iaea.org/PRIS/PRIS_poster_2024.pdf",
      },
    ],
  },
  {
    short: "Nearly all the fresh water that is not frozen lies underground.",
    more: "Groundwater holds about 30% of Earth’s fresh water, while lakes and rivers hold only about 0.3%. Lake Baikal alone holds about a fifth of the world’s fresh surface water.",
    sources: [
      {
        label: "USGS · Freshwater stores",
        url: "https://www.usgs.gov/water-science-school/science/freshwater-lakes-and-rivers-and-water-cycle",
      },
    ],
  },
  {
    short: "In 2006, sequencing a human genome still cost about $14 million.",
    more: "By late 2015, the research benchmark had fallen below $1,500. The sharp drop began in 2008, when sequencing centers switched to a new generation of machines.",
    sources: [
      {
        label: "NHGRI · Genome sequencing costs",
        url: "https://www.genome.gov/about-genomics/fact-sheets/Sequencing-Human-Genome-cost",
      },
      {
        label: "NHGRI · Cost data and technology change",
        url: "https://www.genome.gov/about-genomics/fact-sheets/DNA-Sequencing-Costs-Data",
      },
    ],
  },
  {
    short:
      "Women’s share of seats in national parliaments more than doubled between 1995 and 2026.",
    more: "But in 2025, it grew by just 0.3 percentage points. In January 2026, women held about 64% of seats in Rwanda’s lower house—the highest share in the world.",
    sources: [
      {
        label: "IPU · 1995–2020 review",
        url: "https://www.ipu.org/resources/publications/reports/2020-03/women-in-parliament-1995-2020-25-years-in-review",
      },
      {
        label: "IPU · Progress in 2025",
        url: "https://www.ipu.org/news/press-releases/2026-03/womens-representation-in-parliament-sees-sluggish-gains",
      },
      {
        label: "IPU · Women in Politics 2026",
        url: "https://www.ipu.org/file/23158/download",
      },
    ],
  },
];

const byId = new Map<string, AnswerInsight>();
const originalIndices = [0, 2, 3, 5, 6, 7, 8, 9];
insights.forEach((insight, index) => {
  byId.set(
    `40a00002-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    insight,
  );
  byId.set(
    `40a00001-0000-4000-8000-${String(originalIndices[index] + 1).padStart(12, "0")}`,
    insight,
  );
});
export const answerInsight = (questionId: string): AnswerInsight | undefined =>
  byId.get(questionId);
