#!/usr/bin/env node

/**
 * Populate Daily Questions Script
 *
 * Populates the daily_questions table with active questions.
 * Each day gets 3 questions, starting from today and continuing
 * until all questions are used.
 *
 * Usage:
 *   npm run populate-daily-questions
 *   npm run populate-daily-questions -- --dry-run
 *   npm run populate-daily-questions -- --start-date 2025-01-01
 */

import { supabase, testConnection } from '../utils/supabase-client.js';

const QUESTIONS_PER_DAY = 3;

interface Question {
  id: string;
  question_text: string;
}

interface PopulateStats {
  questionsFound: number;
  daysPopulated: number;
  dailyQuestionsCreated: number;
  errors: string[];
}

const stats: PopulateStats = {
  questionsFound: 0,
  daysPopulated: 0,
  dailyQuestionsCreated: 0,
  errors: [],
};

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Format date as YYYY-MM-DD in Pacific time
 * This ensures consistency with the daily questions retrieval logic
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Fetch all active questions
 */
async function fetchActiveQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text')
    .eq('is_active', true)
    .eq('usage_type', 'daily');

  if (error) {
    throw new Error(`Failed to fetch questions: ${error.message}`);
  }

  return data || [];
}

/**
 * Clear existing daily questions (for fresh population)
 */
async function clearExistingDailyQuestions(dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log('  [DRY RUN] Would clear all existing daily_questions');
    return;
  }

  const { error } = await supabase
    .from('daily_questions')
    .delete()
    .gte('date', '1900-01-01'); // Delete all records

  if (error) {
    throw new Error(`Failed to clear daily_questions: ${error.message}`);
  }

  console.log('  Cleared existing daily_questions');
}

/**
 * Populate daily questions
 */
async function populateDailyQuestions(
  questions: Question[],
  startDate: Date,
  dryRun: boolean
): Promise<void> {
  const shuffled = shuffle(questions);
  const totalDays = Math.floor(shuffled.length / QUESTIONS_PER_DAY);

  console.log(`\n  Shuffled ${shuffled.length} questions`);
  console.log(`  Will populate ${totalDays} days (${totalDays * QUESTIONS_PER_DAY} questions used)`);
  console.log(`  Starting from: ${formatDate(startDate)}`);
  console.log(`  Ending on: ${formatDate(addDays(startDate, totalDays - 1))}\n`);

  const remainingQuestions = shuffled.length % QUESTIONS_PER_DAY;
  if (remainingQuestions > 0) {
    console.log(`  Note: ${remainingQuestions} question(s) will not be used (not enough for a full day)\n`);
  }

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 50; // 10 days worth
  const records: Array<{
    question_id: string;
    date: string;
    display_order: number;
    is_published: boolean;
  }> = [];

  for (let day = 0; day < totalDays; day++) {
    const date = formatDate(addDays(startDate, day));
    const startIdx = day * QUESTIONS_PER_DAY;

    for (let order = 0; order < QUESTIONS_PER_DAY; order++) {
      const question = shuffled[startIdx + order];
      records.push({
        question_id: question.id,
        date,
        display_order: order,
        is_published: true,
      });
    }
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would create ${records.length} daily_question records`);
    console.log('\n  Sample (first 3 days):');
    for (let day = 0; day < Math.min(3, totalDays); day++) {
      const date = formatDate(addDays(startDate, day));
      const dayRecords = records.filter(r => r.date === date);
      console.log(`    ${date}:`);
      dayRecords.forEach((r, i) => {
        const q = shuffled.find(q => q.id === r.question_id);
        console.log(`      ${i + 1}. ${q?.question_text.substring(0, 60)}...`);
      });
    }
    stats.daysPopulated = totalDays;
    stats.dailyQuestionsCreated = records.length;
    return;
  }

  // Insert in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('daily_questions').insert(batch);

    if (error) {
      stats.errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
      console.error(`  Error inserting batch: ${error.message}`);
    } else {
      stats.dailyQuestionsCreated += batch.length;
      process.stdout.write(`\r  Inserted ${stats.dailyQuestionsCreated}/${records.length} records`);
    }
  }

  console.log('\n');
  stats.daysPopulated = totalDays;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Parse start date
  const startDateIndex = args.indexOf('--start-date');
  let startDate = new Date();
  if (startDateIndex !== -1 && args[startDateIndex + 1]) {
    startDate = new Date(args[startDateIndex + 1]);
    if (isNaN(startDate.getTime())) {
      console.error('Invalid start date. Use format: YYYY-MM-DD');
      process.exit(1);
    }
  }

  console.log('\n================================');
  console.log('Four Sigma - Populate Daily Questions');
  console.log('================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Start Date: ${formatDate(startDate)}`);
  console.log('');

  // Test connection
  if (!dryRun) {
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }
  }

  // Fetch active questions
  console.log('\n1. Fetching active questions...');
  const questions = await fetchActiveQuestions();
  stats.questionsFound = questions.length;
  console.log(`   Found ${questions.length} questions`);

  if (questions.length < QUESTIONS_PER_DAY) {
    console.error(`\n   Not enough questions! Need at least ${QUESTIONS_PER_DAY}, found ${questions.length}`);
    process.exit(1);
  }

  // Clear existing daily questions
  console.log('\n2. Clearing existing daily questions...');
  await clearExistingDailyQuestions(dryRun);

  // Populate new daily questions
  console.log('\n3. Populating daily questions...');
  await populateDailyQuestions(questions, startDate, dryRun);

  // Print summary
  console.log('================================');
  console.log('Summary');
  console.log('================================');
  console.log(`Questions found:        ${stats.questionsFound}`);
  console.log(`Days populated:         ${stats.daysPopulated}`);
  console.log(`Daily questions created: ${stats.dailyQuestionsCreated}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors: ${stats.errors.length}`);
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\nDone!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
