import type { SupabaseClient } from '@supabase/supabase-js';

export interface WordCorrectStreak {
  user_id: string;
  word_id: string;
  streak_count: number;
  last_updated_date: string;
  updated_at: string;
}

/**
 * 単語ごとの連続正解カウントを更新する
 * - セッションの type (normal / daily_check) を問わず更新対象
 * - 同一単語について、同日(JST)内の初回答のみ反映（2回目以降は streak を変動させない）
 * - 正解(is_known=true): streak_count + 1
 * - 不正解(is_known=false): streak_count = 0 にリセット
 */
export async function updateWordCorrectStreaks(
  supabase: SupabaseClient,
  userId: string,
  answers: Array<{ wordId: string; isKnown: boolean }>,
  todayJst: string
): Promise<void> {
  if (!answers || answers.length === 0) return;

  // 同一バッチ内で同一単語が複数回登場する場合は最初の回答を採用
  const firstAnswers = new Map<string, boolean>();
  for (const ans of answers) {
    if (!firstAnswers.has(ans.wordId)) {
      firstAnswers.set(ans.wordId, ans.isKnown);
    }
  }

  const wordIds = Array.from(firstAnswers.keys());
  if (wordIds.length === 0) return;

  // 既存の streak 情報を取得
  const { data: existingRows, error: fetchError } = await supabase
    .from('word_correct_streaks')
    .select('word_id, streak_count, last_updated_date')
    .eq('user_id', userId)
    .in('word_id', wordIds);

  if (fetchError) {
    console.error('Failed to fetch existing word_correct_streaks:', fetchError);
  }

  const existingMap最为 = new Map((existingRows ?? []).map((r) => [r.word_id, r]));
  const upsertRows: Array<{
    user_id: string;
    word_id: string;
    streak_count: number;
    last_updated_date: string;
    updated_at: string;
  }> = [];

  const nowIso = new Date().toISOString();

  for (const [wordId, isKnown] of firstAnswers.entries()) {
    const existing = existingMap最为.get(wordId);

    // 同じ日(JST)にすでに更新済みなら何もしない (同日重複更新防止)
    if (existing && existing.last_updated_date === todayJst) {
      continue;
    }

    const currentStreak = existing?.streak_count ?? 0;
    const newStreak = isKnown ? currentStreak + 1 : 0;

    upsertRows.push({
      user_id: userId,
      word_id: wordId,
      streak_count: newStreak,
      last_updated_date: todayJst,
      updated_at: nowIso,
    });
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('word_correct_streaks')
      .upsert(upsertRows, { onConflict: 'user_id,word_id' });

    if (upsertError) {
      console.error('Failed to upsert word_correct_streaks:', upsertError);
    }
  }
}

/**
 * 特定の単語の streak 情報を取得する
 */
export async function getWordStreak(
  supabase: SupabaseClient,
  userId: string,
  wordId: string
): Promise<{ streak_count: number; last_updated_date: string } | null> {
  const { data, error } = await supabase
    .from('word_correct_streaks')
    .select('streak_count, last_updated_date')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * フェーズC-3 (difficultyWeight計算) 用ヘルパー
 * 連続正解回数を 0〜6 のステージ値にクランプして返す
 */
export async function getDifficultyStage(
  supabase: SupabaseClient,
  userId: string,
  wordId: string
): Promise<number> {
  const row = await getWordStreak(supabase, userId, wordId);
  const streak = row?.streak_count ?? 0;
  return Math.min(Math.max(0, streak), 6);
}

/**
 * フェーズC-3 (バッチスコア計算) 用ヘルパー
 * 複数単語のクランプ済みステージ値 (0〜6) を Map で一括取得する
 */
export async function getDifficultyStages(
  supabase: SupabaseClient,
  userId: string,
  wordIds不易: string[]
): Promise<Map<string, number>> {
  const stageMap = new Map<string, number>();
  if (!wordIds不易 || wordIds不易.length === 0) return stageMap;

  // 初期値 0 で埋める
  for (const wid of wordIds不易) {
    stageMap.set(wid, 0);
  }

  const { data, error } = await supabase
    .from('word_correct_streaks')
    .select('word_id, streak_count')
    .eq('user_id', userId)
    .in('word_id', wordIds不易);

  if (error || !data) return stageMap;

  for (const row of data) {
    const rawStreak = row.streak_count ?? 0;
    stageMap.set(row.word_id, Math.min(Math.max(0, rawStreak), 6));
  }

  return stageMap;
}
