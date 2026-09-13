export type CompetitionStats = {
  dailyRank?: number | null;
  totalParticipantsToday?: number;
  todaysAverage?: number | null;
  // Design fixture only for now. A live percentile needs this server aggregate;
  // rank alone cannot distinguish the number of tied and lower scores.
  playersBelowToday?: number;
};

export function competitionValues(
  score: number,
  stats: CompetitionStats | null,
) {
  const count = stats?.totalParticipantsToday;
  const rank = stats?.dailyRank;
  if (
    !count ||
    !Number.isInteger(count) ||
    !rank ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > count
  )
    return null;
  const below = stats?.playersBelowToday;
  const percentile =
    count >= 20 &&
    below !== undefined &&
    Number.isInteger(below) &&
    below >= 0 &&
    below <= count - rank
      ? Math.floor((100 * below) / (count - 1))
      : null;
  const mean = stats?.todaysAverage;
  const difference =
    Number.isFinite(score) && mean != null && Number.isFinite(mean) && mean > 0
      ? Math.round((score / mean - 1) * 100)
      : null;
  return { count, rank, percentile, difference };
}
