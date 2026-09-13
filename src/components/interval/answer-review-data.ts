import type { AnswerInsight } from "../../../shared/answer-insight";

export function reviewInsight(
  context: string,
  supplied?: AnswerInsight,
): AnswerInsight {
  if (supplied) return supplied;
  const text = context.trim();
  // Preserve the question bank's context; never manufacture an explanation.
  const sentences =
    typeof Intl.Segmenter === "function"
      ? [
          ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(
            text,
          ),
        ].map((part) => part.segment.trim())
      : [text];
  return {
    short: sentences[0] || "Sources",
    more: sentences.slice(1).join(" "),
    sources: [],
  };
}

export const reviewNumber = (value: number) => {
  const size = Math.abs(value);
  return size >= 1e7 || (size > 0 && size < 0.001)
    ? value
        .toExponential(3)
        .replace(/\.?0+e/, "e")
        .replace("e+", "e")
    : new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(
        value,
      );
};

export function reviewRange(lower: number, upper: number, actual: number) {
  const start = Math.min(lower, actual),
    end = Math.max(upper, actual);
  const spread = Math.max(end - start, Math.abs(actual) * 0.12) || 1;
  const x = (value: number) =>
    26 + ((value - start + spread * 0.2) / (end - start + spread * 0.4)) * 268;
  return { l: x(lower), u: x(upper), a: x(actual) };
}
