import { annotateQuestion, type GlossaryAnnotation } from '../../src/lib/glossary.js';

// Presentation-only edits: keep the underlying observations and scored snapshots intact.
const wording: Record<string, string> = {
  "According to UNCTAD's maritime trade benchmark, approximately what percentage of international trade in goods is carried by sea, by volume?":
    'What percentage of international trade in goods is carried by sea, by volume?',
};

export function questionPrompt(prompt: string): string {
  return Object.hasOwn(wording, prompt) ? wording[prompt] : prompt;
}

export function withQuestionCopy<T extends { prompt: string; glossary?: GlossaryAnnotation[] }>(question: T): T {
  const prompt = questionPrompt(question.prompt);
  if (prompt === question.prompt) return question;
  return {
    ...question,
    prompt,
    glossary: question.glossary && annotateQuestion(prompt, question.glossary.map(term => ({
      ...term, matchText: question.prompt.slice(term.start, term.end),
    }))),
  };
}
