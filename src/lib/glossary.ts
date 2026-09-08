/** Offsets refer to the supplied question text, including frozen game wording. */
export type GlossaryAnnotation = {
  start: number;
  end: number;
  termId: string;
  title: string;
  definition: string;
};
export type GlossaryLink = {
  termId: string;
  matchText: string;
  title: string;
  definition: string;
};

export function annotateQuestion(
  text: string,
  links: GlossaryLink[],
): GlossaryAnnotation[] {
  const found: GlossaryAnnotation[] = [];
  // Prefer the complete concept over a shorter term inside it.
  for (const link of [...links].sort(
    (a, b) =>
      b.matchText.length - a.matchText.length ||
      a.termId.localeCompare(b.termId),
  )) {
    if (!link.matchText.trim()) continue;
    const escaped = link.matchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,
      "giu",
    );
    for (const match of text.matchAll(pattern)) {
      const start = match.index!,
        end = start + match[0].length;
      if (
        found.some((existing) => start < existing.end && end > existing.start)
      )
        continue;
      found.push({
        start,
        end,
        termId: link.termId,
        title: link.title,
        definition: link.definition,
      });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
