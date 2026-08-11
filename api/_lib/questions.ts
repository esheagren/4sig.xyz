import { Question } from './types.js';
import { supabase } from './supabase.js';

/**
 * Get current date string in Pacific time (YYYY-MM-DD)
 * Handles PST/PDT automatically
 */
function getPacificDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Get a question by ID from Supabase
 */
export async function getQuestionById(id: string): Promise<Question | undefined> {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      answer_value,
      answer_context,
      source_url,
      source_name,
      units (name)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching question:', error);
    return undefined;
  }

  return {
    id: data.id,
    prompt: data.question_text,
    unit: (data.units as any)?.name || '',
    trueValue: data.answer_value,
    source: data.source_name || '',
    sourceUrl: data.source_url || '',
    answerContext: data.answer_context || undefined,
  };
}

/**
 * Get a set of random questions for a new session from Supabase
 */
export async function getQuestionsForSession(count: number = 3): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      answer_value,
      source_url,
      source_name,
      units (name)
    `)
    .eq('is_active', true)
    .limit(100);

  if (error || !data || data.length === 0) {
    console.error('Error fetching questions:', error);
    return [];
  }

  // Shuffle and pick `count` questions
  const shuffled = data.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map(q => ({
    id: q.id,
    prompt: q.question_text,
    unit: (q.units as any)?.name || '',
    trueValue: q.answer_value,
    source: q.source_name || '',
    sourceUrl: q.source_url || '',
  }));
}

/**
 * Get the daily questions for a specific date
 * All users get the same questions for a given day
 *
 * @param overrideDate - Optional date string (YYYY-MM-DD) for testing different days
 */
export async function getDailyQuestions(overrideDate?: string): Promise<Question[]> {
  const dateStr = overrideDate || getPacificDateString();

  const { data, error } = await supabase
    .from('daily_questions')
    .select(`
      id,
      display_order,
      questions!inner (
        id,
        question_text,
        answer_value,
        answer_context,
        source_url,
        source_name,
        units (name)
      )
    `)
    .eq('date', dateStr)
    .eq('is_published', true)
    .order('display_order');

  if (error) {
    console.error('Error fetching daily questions:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn(`No daily questions found for date: ${dateStr}`);
    return [];
  }

  return data.map((dq: any) => ({
    id: dq.questions.id,
    prompt: dq.questions.question_text,
    unit: dq.questions.units?.name || '',
    trueValue: dq.questions.answer_value,
    source: dq.questions.source_name || '',
    sourceUrl: dq.questions.source_url || '',
    answerContext: dq.questions.answer_context || undefined,
  }));
}
