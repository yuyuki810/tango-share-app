import type { SupabaseClient } from '@supabase/supabase-js';
import { getDifficultyStages } from '@/lib/streak/updateWordCorrectStreaks';

export { getDifficultyStages };

const DEFAULT_REFERENCE_MAX_SCORE = 50;
const MAX_WEIGHT = 1.5;
const MIN_WEIGHT = 0.5;

export function difficultyWeight(stage: number): number {
  const clamped = Math.min(Math.max(0, stage), 6);
  return MAX_WEIGHT - (MAX_WEIGHT - MIN_WEIGHT) * (clamped / 6);
}

export function diminishingReturnFactor(
  orderIndexToday: number,
  fullValueThreshold: number = DEFAULT_REFERENCE_MAX_SCORE
): number {
  const threshold = Math.max(1, fullValueThreshold);
  if (orderIndexToday <= threshold) return 1.0;
  return Math.sqrt(threshold / orderIndexToday);
}

export function scoreForWord(
  isCorrect: boolean,
  stage: number,
  orderIndexToday: number,
  fullValueThreshold: number = DEFAULT_REFERENCE_MAX_SCORE
): number {
  if (!isCorrect) return 0;
  return difficultyWeight(stage) * diminishingReturnFactor(orderIndexToday, fullValueThreshold);
}

export interface ComputeScoreParams {
  supabase: SupabaseClient;
  userId: string;
  date: string;
  answers: Array<{ wordId: string; isKnown: boolean }>;
  targetWordCount?: number;
}

export interface ComputedDailyScoreResult {
  userId: string;
  date: string;
  rawScore: number;
  normalizedScore: number;
  wordCount: number;
  accuracyRate: number;
  avgDifficultyWeight: number;
  avgDiminishingFactor: number;
  referenceMaxScore: number;
}

export async function computeAndSaveDailyScore(
  params: ComputeScoreParams
): Promise<ComputedDailyScoreResult | null> {
  const { supabase, userId, date, answers, targetWordCount } = params;
  if (!answers || answers.length === 0) return null;

  const uniqueAnswers: Array<{ wordId: string; isKnown: boolean }> = [];
  const seenWordIds = new Set<string>();

  for (const ans of answers) {
    if (!seenWordIds.has(ans.wordId)) {
      seenWordIds.add(ans.wordId);
      uniqueAnswers.push({ wordId: ans.wordId, isKnown: ans.isKnown });
    }
  }

  const wordCount = uniqueAnswers.length;
  if (wordCount === 0) return null;

  const R = targetWordCount && targetWordCount > 0
    ? targetWordCount
    : (wordCount > 0 ? wordCount : DEFAULT_REFERENCE_MAX_SCORE);
  const K = R;

  const stagesMap = await getDifficultyStages(supabase, userId, Array.from(seenWordIds));

  let rawScore = 0;
  let correctCount = 0;
  let totalDifficultyWeight = 0;
  let totalDiminishingFactor = 0;

  uniqueAnswers.forEach((item, index) => {
    const orderIndex = index + 1;
    const stage = stagesMap.get(item.wordId) ?? 0;
    const dWeight = difficultyWeight(stage);
    const dFactor = diminishingReturnFactor(orderIndex, K);

    totalDifficultyWeight += dWeight;
    totalDiminishingFactor += dFactor;

    if (item.isKnown) {
      correctCount += 1;
      rawScore += dWeight * dFactor;
    }
  });

  const normalizedScore = Math.min(
    100,
    Math.round((rawScore / R) * 100)
  );

  const accuracyRate =
    wordCount > 0 ? Math.round((correctCount / wordCount) * 10000) / 10000 : 0;
  const avgDifficultyWeight =
    wordCount > 0
      ? Math.round((totalDifficultyWeight / wordCount) * 10000) / 10000
      : 1.0;
  const avgDiminishingFactor =
    wordCount > 0
      ? Math.round((totalDiminishingFactor / wordCount) * 10000) / 10000
      : 1.0;
  const rawScoreRounded = Math.round(rawScore * 10000) / 10000;

  const { error: upsertError } = await supabase
    .from('daily_score_entries')
    .upsert(
      {
        user_id: userId,
        date: date,
        raw_score: rawScoreRounded,
        normalized_score: normalizedScore,
        word_count: wordCount,
        accuracy_rate: accuracyRate,
        avg_difficulty_weight: avgDifficultyWeight,
        avg_diminishing_factor: avgDiminishingFactor,
        reference_max_score: R,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

  if (upsertError) {
    console.error('Failed to upsert daily_score_entries:', upsertError);
  }

  return {
    userId,
    date,
    rawScore: rawScoreRounded,
    normalizedScore,
    wordCount,
    accuracyRate,
    avgDifficultyWeight,
    avgDiminishingFactor,
    referenceMaxScore: R,
  };
}
