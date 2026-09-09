import type { SupabaseClient } from '@supabase/supabase-js';

export interface WeakWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  accuracyRate: number;
  number?: number;
  originDailyAssignmentId?: string;
  mistakeCount?: number;
  lastWrongAt?: string;
}

export interface GetWeakWordsOptions {
  chunkId?: string;
  chunkIds?: string[];
  rangeStart?: number;
  rangeEnd?: number;
  filterMode?: 'all' | 'mistakes' | 'recent';
  limit?: number;
  days?: number;
}

export async function getWeakWords(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string,
  options?: GetWeakWordsOptions
): Promise<WeakWordCard[]> {
  const filterMode = options?.filterMode || 'all';
  const targetLimit = options?.limit || (filterMode === 'all' ? 50 : 10);
  const filterDays = options?.days;
  const targetChunkId = options?.chunkId;

  let chunkRange: { start: number; end: number } | null = null;
  if (options?.rangeStart && options?.rangeEnd) {
    chunkRange = { start: options.rangeStart, end: options.rangeEnd };
  } else if (targetChunkId) {
    const { data: chunk } = await supabase
      .from('daily_assignments')
      .select('range_start, range_end')
      .eq('id', targetChunkId)
      .eq('user_id', userId)
      .single();

    if (chunk) {
      chunkRange = { start: chunk.range_start, end: chunk.range_end };
    }
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('test_sessions')
    .select('id, created_at, test_answers(id, is_known, word_id, created_at, origin_daily_assignment_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (sessionsError || !sessions || sessions.length === 0) return [];

  interface WordAgg {
    wordId: string;
    totalAttempts: number;
    correctCount: number;
    mistakeCount: number;
    lastWrongAt: string | null;
    lastAnswerKnown: boolean;
    originDailyAssignmentId?: string | null;
  }

  const aggMap = new Map<string, WordAgg>();

  sessions.forEach((s: any) => {
    const answersList = s.test_answers ?? [];
    answersList.forEach((a: any) => {
      const cur = aggMap.get(a.word_id) ?? {
        wordId: a.word_id,
        totalAttempts: 0,
        correctCount: 0,
        mistakeCount: 0,
        lastWrongAt: null,
        lastAnswerKnown: true,
        originDailyAssignmentId: a.origin_daily_assignment_id,
      };

      cur.totalAttempts += 1;
      cur.lastAnswerKnown = a.is_known;
      if (a.is_known) {
        cur.correctCount += 1;
      } else {
        cur.mistakeCount += 1;
        const answerCreatedAt = a.created_at || s.created_at;
        if (!cur.lastWrongAt || answerCreatedAt > cur.lastWrongAt) {
          cur.lastWrongAt = answerCreatedAt;
        }
      }

      aggMap.set(a.word_id, cur);
    });
  });

  const now = new Date();
  const daysThreshold = filterDays
    ? new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  let candidateAggs = Array.from(aggMap.values()).filter((agg) => {
    const accuracy =
      agg.totalAttempts > 0 ? Math.round((agg.correctCount / agg.totalAttempts) * 100) : 0;
    const isWeak = !agg.lastAnswerKnown || accuracy <= 60 || agg.mistakeCount > 0;
    if (!isWeak || agg.mistakeCount === 0) return false;

    if (filterMode === 'recent' && daysThreshold && agg.lastWrongAt) {
      if (agg.lastWrongAt < daysThreshold) return false;
    }

    return true;
  });

  if (candidateAggs.length === 0) return [];

  if (filterMode === 'mistakes') {
    candidateAggs.sort((a, b) => {
      if (b.mistakeCount !== a.mistakeCount) return b.mistakeCount - a.mistakeCount;
      return (b.lastWrongAt || '').localeCompare(a.lastWrongAt || '');
    });
  } else if (filterMode === 'recent') {
    candidateAggs.sort((a, b) => (b.lastWrongAt || '').localeCompare(a.lastWrongAt || ''));
  } else {
    candidateAggs.sort((a, b) => {
      const accA = a.totalAttempts > 0 ? (a.correctCount / a.totalAttempts) * 100 : 0;
      const accB = b.totalAttempts > 0 ? (b.correctCount / b.totalAttempts) * 100 : 0;
      if (accA !== accB) return accA - accB;
      return b.mistakeCount - a.mistakeCount;
    });
  }

  const targetWordIds = candidateAggs.map((c) => c.wordId);

  let wordQuery = supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId)
    .in('id', targetWordIds);

  if (chunkRange) {
    wordQuery = wordQuery.gte('number', chunkRange.start).lte('number', chunkRange.end);
  }

  const { data: words, error: wordsError } = await wordQuery;
  if (wordsError || !words || words.length === 0) return [];

  const wordMap = new Map((words ?? []).map((w) => [w.id, w]));

  const weakCards: WeakWordCard[] = [];
  for (const agg of candidateAggs) {
    const w = wordMap.get(agg.wordId);
    if (!w) continue;

    const accuracyRate =
      agg.totalAttempts > 0 ? Math.round((agg.correctCount / agg.totalAttempts) * 100) : 0;

    weakCards.push({
      wordId: w.id,
      headword: w.word,
      pronunciation: w.pronunciation ?? undefined,
      meaning: w.meaning,
      studyCount: agg.totalAttempts,
      accuracyRate,
      number: w.number,
      originDailyAssignmentId: targetChunkId || agg.originDailyAssignmentId || undefined,
      mistakeCount: agg.mistakeCount,
      lastWrongAt: agg.lastWrongAt || undefined,
    });

    if (weakCards.length >= targetLimit) {
      break;
    }
  }

  return weakCards;
}
