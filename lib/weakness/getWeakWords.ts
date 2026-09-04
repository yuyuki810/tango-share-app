import type { SupabaseClient } from '@supabase/supabase-js';

export interface WeakWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  accuracyRate: number; // 0..100 (%)
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
    const correctCount = wordAnswers.filter((a) => a.is_known).length;
    const accuracyRate = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
    const lastAnswer = wordAnswers[wordAnswers.length - 1];

    // 苦手判定: 直近が不正解、または通算正答率が60%以下
    const isWeak = !lastAnswer.is_known || accuracyRate <= 60;

    if (isWeak) {
      weakCards.push({
        wordId: word.id,
        headword: word.word,
        pronunciation: word.pronunciation ?? undefined,
        meaning: word.meaning,
        studyCount: totalAttempts,
        accuracyRate,
        number: word.number,
        originDailyAssignmentId: targetChunkId || lastAnswer.origin_daily_assignment_id || undefined,
      });
    }
  }

  // 正答率の低い順（最も苦手な単語順）にソート
  weakCards.sort((a, b) => a.accuracyRate - b.accuracyRate || (a.number ?? 0) - (b.number ?? 0));

  return weakCards.slice(0, 50);
}
