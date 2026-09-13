export function chooseQuestions<
  T extends {
    id: string;
    editorial_topic: string | null;
    editorial_role: string;
  },
>(selected: T[], candidates: T[]) {
  const result = [...selected],
    remaining = [...candidates];
  while (result.length < 5) {
    const topics = new Set(result.map((q) => q.editorial_topic));
    const permitted = remaining.filter(
      (q) =>
        !result.some((r) => r.id === q.id) &&
        !(
          q.editorial_role === "reference" &&
          result.some((r) => r.editorial_role === "reference")
        ),
    );
    const next =
      permitted.find((q) => !topics.has(q.editorial_topic)) ?? permitted[0];
    if (!next) break;
    result.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return result;
}
