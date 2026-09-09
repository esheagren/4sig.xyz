import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { questionPrompt, withQuestionCopy } from '../api/_lib/question-copy.ts';
import { annotateQuestion } from '../src/lib/glossary.ts';
import { onboardingQuestions } from '../api/_lib/onboarding-data-v1.ts';

test('wording review preserves facts and recalculates surviving glossary spans', async () => {
  const review = JSON.parse(await readFile(new URL('../editorial/wording-review-2026-09-09.json', import.meta.url), 'utf8'));
  const glossary = JSON.parse(await readFile(new URL('../editorial/glossary.json', import.meta.url), 'utf8'));
  for (const row of review.records) {
    const links = glossary.links.filter((link: { questionId: string }) => link.questionId === row.id)
      .map((link: { termId: string; matchText: string }) => ({ ...link, ...glossary.terms.find((term: { id: string }) => term.id === link.termId) }));
    const original = { prompt: row.prompt, glossary: annotateQuestion(row.prompt, links), unit: '%', trueValue: 37, observationPeriod: '2024', source: 'Preserved source' };
    const snapshot = structuredClone(original);
    const edited = withQuestionCopy(original);
    assert.equal(edited.prompt, row.display_prompt);
    assert.equal(edited.trueValue, 37);
    assert.equal(edited.unit, '%');
    assert.equal(edited.source, original.source);
    assert.equal(edited.observationPeriod, original.observationPeriod);
    assert.deepEqual(original, snapshot);
    assert.deepEqual(withQuestionCopy(edited), edited);
    for (const span of original.glossary) {
      const phrase = original.prompt.slice(span.start, span.end);
      if (!edited.prompt.toLowerCase().includes(phrase.toLowerCase())) continue;
      assert.ok(edited.glossary.some(term => term.termId === span.termId && edited.prompt.slice(term.start, term.end).toLowerCase() === phrase.toLowerCase()));
    }
  }
  for (const original of onboardingQuestions) {
    const edited = withQuestionCopy(original);
    assert.equal(edited.trueValue, original.trueValue);
    assert.equal(edited.sourceUrl, original.sourceUrl);
    for (const term of edited.glossary ?? []) assert.equal(edited.prompt.slice(term.start, term.end).toLowerCase(), original.prompt.slice(original.glossary!.find(t => t.termId === term.termId)!.start, original.glossary!.find(t => t.termId === term.termId)!.end).toLowerCase());
  }
});

test('wording keeps essential sample definitions, dates and denominators', () => {
  assert.match(questionPrompt('About how many refugees were under UNHCR’s mandate at the end of 2024?'), /UNHCR’s mandate at the end of 2024/);
  assert.match(questionPrompt('In Imperva’s 2024 web-traffic analysis, what percentage of traffic came from automated bots?'), /2024.*web traffic measured by Imperva/);
  assert.match(questionPrompt('Approximately what share of world GDP did China account for in 2024, at market exchange rates?'), /2024, at market exchange rates/);
  assert.equal(questionPrompt('How many people live here?'), 'How many people live here?');
  assert.equal(questionPrompt('constructor'), 'constructor');
});
