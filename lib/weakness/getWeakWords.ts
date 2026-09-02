import type { SupabaseClient } from '@supabase/supabase-js';

export interface WeakWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  mistakeRate: number;
  number?: number;
  originDailyAssignmentId?: string;
}

export async function getWeakWords(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string,
  scope?: { chunkId?: string }
): Promise<WeakWordCard[]> {
  let wordQuery = supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId);

  const targetChunkId = scope?.chunkId;

  if (targetChunkId) {
    const { data: chunk } = await supabase
      .from('daily_assignments')
      .select('id, range_start, range_end')
      .eq('id', targetChunkId)
      .eq('user_id', userId)
      .single();

    if (!chunk) return [];

    wordQuery = wordQuery
      .gte('number', chunk.range_start)
      .lte('number', chunk.range_end);
  }

  const { data: words, error: wordsError } = await wordQuery.order('number', { ascending: true });
  if (wordsError || !words || words.length === 0) return [];

  const wordMap = new Map<string, (typeof words)[0]>();
  words.forEach((w) => wordMap.set(w.id, w));

  // ユーザーの全回答を取得（URL文字数制限を回避）
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('id, created_at, test_answers(id, is_known, word_id, created_at, origin_daily_assignment_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const answersByWord = new Map<
    string,
    Array<{ is_known: boolean; created_at: string; origin_daily_assignment_id?: string | null }>
  >();

  (sessions ?? []).forEach((s: any) => {
    const answersList = s.test_answers ?? [];
    answersList.forEach((a: any) => {
      if (wordMap.has(a.word_id)) {
        const list = answersByWord.get(a.word_id) ?? [];
        list.push({
          is_known: a.is_known,
          created_at: a.created_at || s.created_at,
          origin_daily_assignment_id: a.origin_daily_assignment_id,
        });
        answersByWord.set(a.word_id, list);
      }
    });
  });

  const weakCards: WeakWordCard[] = [];

  for (const word of words) {
    const wordAnswers = answersByWord.get(word.id);
    if (!wordAnswers || wordAnswers.length === 0) continue;

    const totalAttempts = wordAnswers.length;
    const mistakeCount = wordAnswers.filter((a) => !a.is_known).length;
    const mistakeRate = mistakeCount / totalAttempts;
    const lastAnswer = wordAnswers[wordAnswers.length - 1];

    const isWeak = !lastAnswer.is_known || mistakeRate >= 0.4;

    if (isWeak) {
      weakCards.push({
        wordId: word.id,
        headword: word.word,
        pronunciation: word.pronunciation ?? undefined,
        meaning: word.meaning,
        studyCount: totalAttempts,
        mistakeRate: Math.round(mistakeRate * 100) / 100,
        number: word.number,
        originDailyAssignmentId: targetChunkId || lastAnswer.origin_daily_assignment_id || undefined,
      });
    }
  }

  weakCards.sort((a, b) => b.mistakeRate - a.mistakeRate || (a.number ?? 0) - (b.number ?? 0));

  return weakCards.slice(0, 50);
}
