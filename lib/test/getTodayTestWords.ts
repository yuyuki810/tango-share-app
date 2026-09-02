import type { SupabaseClient } from '@supabase/supabase-js';

export interface TestWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  originDailyAssignmentId?: string;
  number?: number;
}

export interface ReviewChunkSummaryInfo {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  prevMistakeRate: number | null;
}

export interface TodayTestContext {
  dailyAssignmentId: string;
  wordbookId: string;
  isReviewDay: boolean;
  rangeStart: number;
  rangeEnd: number;
  cards: TestWordCard[];
  reviewChunks?: ReviewChunkSummaryInfo[];
}

export async function getTodayTestContext(
  supabase: SupabaseClient,
  userId: string,
  today: string
): Promise<TodayTestContext | null> {
  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('id, wordbook_id, range_start, range_end, is_review_day')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (!assignment) return null;

  const { data: words } = await supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', assignment.wordbook_id)
    .gte('number', assignment.range_start)
    .lte('number', assignment.range_end)
    .order('number', { ascending: true });

  const wordList = words ?? [];
  const studyCounts = await getStudyCounts(
    supabase,
    userId,
    wordList.map((w) => w.id)
  );

  let reviewChunks: ReviewChunkSummaryInfo[] | undefined;
  const chunkByRange: Array<{ id: string; range_start: number; range_end: number; date: string }> = [];

  if (assignment.is_review_day) {
    const { data: progressAssignments } = await supabase
      .from('daily_assignments')
      .select('id, range_start, range_end, date')
      .eq('user_id', userId)
      .eq('wordbook_id', assignment.wordbook_id)
      .eq('is_review_day', false)
      .gte('range_start', assignment.range_start)
      .lte('range_end', assignment.range_end)
      .order('range_start', { ascending: true });

    const pList = progressAssignments ?? [];
    chunkByRange.push(...pList);

    if (pList.length > 0) {
      const pIds = pList.map((p) => p.id);
      const { data: prevAnswers } = await supabase
        .from('test_answers')
        .select('is_known, origin_daily_assignment_id, created_at, session_id, test_sessions!inner(user_id, date, created_at)')
        .eq('test_sessions.user_id', userId)
        .in('origin_daily_assignment_id', pIds)
        .order('created_at', { ascending: true });

      const answersByChunk = new Map<string, Array<{ is_known: boolean; sessionId: string; created_at: string }>>();
      (prevAnswers ?? []).forEach((a) => {
        const cid = a.origin_daily_assignment_id;
        if (!cid) return;
        const list = answersByChunk.get(cid) ?? [];
        list.push({ is_known: a.is_known, sessionId: a.session_id, created_at: a.created_at });
        answersByChunk.set(cid, list);
      });

      reviewChunks = pList.map((p) => {
        const cAnswers = answersByChunk.get(p.id) ?? [];
        let prevMistakeRate: number | null = null;
        if (cAnswers.length > 0) {
          const sessionGroups = new Map<string, typeof cAnswers>();
          cAnswers.forEach((ans) => {
            const list = sessionGroups.get(ans.sessionId) ?? [];
            list.push(ans);
            sessionGroups.set(ans.sessionId, list);
          });
          const lastSessionAnswers = Array.from(sessionGroups.values()).pop();
          if (lastSessionAnswers && lastSessionAnswers.length > 0) {
            const mistakes = lastSessionAnswers.filter((a) => !a.is_known).length;
            prevMistakeRate = Math.round((mistakes / lastSessionAnswers.length) * 100) / 100;
          }
        }
        return {
          chunkId: p.id,
          rangeStart: p.range_start,
          rangeEnd: p.range_end,
          originDate: p.date,
          prevMistakeRate,
        };
      });
    }
  }

  const cards: TestWordCard[] = wordList.map((w) => {
    let originDailyAssignmentId: string | undefined;
    if (assignment.is_review_day) {
      const matched = chunkByRange.find(
        (c) => w.number >= c.range_start && w.number <= c.range_end
      );
      originDailyAssignmentId = matched?.id;
    } else {
      originDailyAssignmentId = assignment.id;
    }

    return {
      wordId: w.id,
      headword: w.word,
      pronunciation: w.pronunciation ?? undefined,
      meaning: w.meaning,
      studyCount: studyCounts.get(w.id) ?? 0,
      originDailyAssignmentId,
      number: w.number,
    };
  });

  return {
    dailyAssignmentId: assignment.id,
    wordbookId: assignment.wordbook_id,
    isReviewDay: assignment.is_review_day,
    rangeStart: assignment.range_start,
    rangeEnd: assignment.range_end,
    cards,
    reviewChunks,
  };
}

async function getStudyCounts(
  supabase: SupabaseClient,
  userId: string,
  wordIds: string[]
): Promise<Map<string, number>> {
  if (wordIds.length === 0) return new Map();

  const { data } = await supabase
    .from('test_answers')
    .select('word_id, test_sessions!inner(user_id)')
    .eq('test_sessions.user_id', userId)
    .in('word_id', wordIds);

  const counts = new Map<string, number>();
  (data ?? []).forEach((row: { word_id: string }) => {
    counts.set(row.word_id, (counts.get(row.word_id) ?? 0) + 1);
  });
  return counts;
}
