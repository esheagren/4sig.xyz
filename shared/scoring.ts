/** Shared scoring math. Ranked answers are always scored and saved by the server. */
export class Score {
  static calculateScore(
    lower: number,
    upper: number,
    answer: number,
    zeroReferenceScale = 1,
  ): number {
    if (![lower, upper, answer].every(Number.isFinite) || lower > upper)
      throw new Error("Invalid interval");
    if (!Score.inBounds(lower, upper, answer)) return 0;
    if (lower === upper) return 10000;
    const magnitude = answer === 0 ? zeroReferenceScale : Math.abs(answer);
    if (!Number.isFinite(magnitude) || magnitude <= 0)
      throw new Error("Invalid zero-answer reference");
    return (
      Math.round(
        Math.min(10000, 50 * (magnitude / (upper - lower)) ** 0.7) * 10,
      ) / 10
    );
  }
  static computeScore(
    lower: number,
    upper: number,
    answer: number,
    zeroReferenceScale = 1,
  ) {
    return Score.calculateScore(lower, upper, answer, zeroReferenceScale);
  }
  static inBounds(lower: number, upper: number, answer: number) {
    return lower <= answer && answer <= upper;
  }
  static calculateTotalScore(scores: number[]) {
    return Math.round(scores.reduce((sum, value) => sum + value, 0) * 10) / 10;
  }
}
