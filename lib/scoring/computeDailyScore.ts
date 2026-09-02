import type { SupabaseClient } from '@supabase/supabase-js';
import { getDifficultyStages } from '@/lib/streak/updateWordCorrectStreaks';

const FULL_VALUE_THRESHOLD = 20;
const REFERENCE_MAX_SCORE = 20;
const MAX_WEIGHT = 1.5;
const MIN_WEIGHT = 0.5;

/**
 * 単語の習熟度ステージ (0〜6) に応じた難易度重みを計算する
 * ステージ0 (未習熟/新出) ほど重く (1.5), ステージ6 (定着済み) ほど軽く (0.5) する
 */
export function difficultyWeight(stage: number): number {
  const clamped = Math.min(Math.max(0, stage), 6);
  return MAX_WEIGHT - (MAX_WEIGHT - MIN_WEIGHT) * (clamped / 6);
}

/**
 * 逓減係数を計算する (20語までは満額 1.0、それ以降は平方根で緩やかに逓減)
 */
export function diminishingReturnFactor(
  orderIndexToday: number,
  fullValueThreshold = FULL_VALUE_THRESHOLD
): number {
  if (orderIndexToday <= fullValueThreshold) return 1.0;
  return Math.sqrt(fullValueThreshold / orderIndexToday);
}

/**
 * 単一単語の獲得スコアを計算する
 */
export function scoreForWord(
  isCorrect: boolean,
  stage: number,
  orderIndexToday: number
): number {
  if (!isCorrect) return 0;
  return difficultyWeight(stage) * diminishingReturnFactor(orderIndexToday);
}

export interface ComputeScoreParams {
  supabase: SupabaseClient;
  userId: string;
  date: string;
  answers: Array<{ wordId: string; isKnown: boolean }>;
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
}

/**
 * 本番デイリーチェックのスコアを算出して daily_score_entries に永続化する
 */
export async function computeAndSaveDailyScore(
  params: ComputeScoreParams
): Promise<ComputedDailyScoreResult | null> {
  const { supabase, userId, date, answers } = params;
  if (!answers || answers.length === 0) return null;

  // 1. word_id の重複を除き、初回出現順を対象にする
  const uniqueAnswers: Array<{ wordId: string; isKnown: boolean }> = [];
  const seenWordIds = new Set<string>();

  for (const ans of answers) {
    if (!seenWordIds.has(ans.wordId)) {
      seenWordIds.add(ans.wordId);
      uniqueAnswers.push({ wordId: ans.wordId, isKnown: ans.isKnown });
    }
  }

  const wordIds = uniqueAnswers.map((a) => a.wordId);
  const wordCount = wordIds.length;
  if (wordCount === 0) return null;

  // 2. getDifficultyStages で対象 word_id のステージを一括取得 (0〜6)
  const stagesMap = await getDifficultyStages(supabase, userId, wordIds);

  let rawScore = 0;
  let correctCount = 0;
  let totalDifficultyWeight = 0;
  let totalDiminishingFactor = 0;

  uniqueAnswers.forEach((item, index) => {
    const orderIndex = index + 1; // 1-based index
    const stage = stagesMap.get(item.wordId) ?? 0;
    const dWeight = difficultyWeight(stage);
    const dFactor = diminishingReturnFactor(orderIndex);

    totalDifficultyWeight += dWeight;
    totalDiminishingFactor += dFactor;

    if (item.isKnown) {
      correctCount += 1;
      rawScore += dWeight * dFactor;
    }
  });

  // 3. 正規化スコア (0〜100) の算出 (REFERENCE_MAX_SCORE = 20 を基準値とする)
  const normalizedScore = Math.min(
    100,
    Math.round((rawScore / REFERENCE_MAX_SCORE) * 100)
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

  // 4. daily_score_entries に upsert
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
  };
}
