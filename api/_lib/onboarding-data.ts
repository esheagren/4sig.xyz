import type { Question } from './types.js';
import { onboardingQuestions as firstTen } from './onboarding-data-v1.js';

// New release; preserve the published ten-question edition and its question IDs.
export const ONBOARDING_VERSION = 'first-eight-v1';
const selected = [0, 2, 3, 5, 6, 7, 8, 9];
export const onboardingQuestions: Question[] = selected.map((sourceIndex, index) => ({
  ...firstTen[sourceIndex],
  id: `40a00002-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  glossary: firstTen[sourceIndex].glossary?.map(term => ({
    ...term, termId: `${ONBOARDING_VERSION}-${index + 1}`,
  })),
}));
