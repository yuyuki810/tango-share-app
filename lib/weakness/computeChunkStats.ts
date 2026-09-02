import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChunkMistakeWord {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  number: number;
  wrongCount: number;
  totalCount: number;
}

export interface ChunkStat {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  totalAttempts: number;
  mistakeCount: number;
  mistakeRate: number;
  history: Array<{ testDate: string; mistakeRate: number }>;
  needsAttention: boolean;
  mistakeWords: ChunkMistakeWord[];
}

export async function computeChunkStats(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string
): Promise<ChunkStat[]> {
  // 1. 対象ユーザー・単語帳の「進める日 (is_review_day = false)」の daily_assignments を取得
  const { data: assignments, error: assignError } = await supabase
    .from('daily_assignments')
    .select('id, range_start, range_end, date')
    .eq('user_id', userId)
    .eq('wordbook_id', wordbookId)
    .eq('is_review_day', false)
    .order('date', { ascending: true });

  if (assignError || !assignments || assignments.length === 0) {
    return [];
  }

  // 2. 単語帳の全単語情報を取得（メモリ上でのO(1)参照マップ）
  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId);

  if (wordsError || !words || words.length === 0) {
    return [];
  }

  const wordMap = new Map<string, { id: string; word: string; pronunciation?: string | null; meaning: string; number: number }>();
  words.forEach((w) => {
    wordMap.set(w.id, w);
  });

  // 3. ユーザーの全回答履歴をセッション経由で取得（URL文字数制限を完全回避）
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('id, date, created_at, test_answers(id, is_known, origin_daily_assignment_id, word_id, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const allAnswers: Array<{
    id: string;
    is_known: boolean;
    origin_daily_assignment_id?: string | null;
    word_id: string;
    session_id: string;
    date: string;
    created_at: string;
  }> = [];

  (sessions ?? []).forEach((s: any) => {
    const answersList = s.test_answers ?? [];
    answersList.forEach((a: any) => {
      allAnswers.push({
        id: a.id,
        is_known: a.is_known,
        origin_daily_assignment_id: a.origin_daily_assignment_id,
        word_id: a.word_id,
        session_id: s.id,
        date: s.date,
        created_at: a.created_at || s.created_at,
      });
    });
  });

  // 4. 各チャンクごとに集計
  return assignments.map((assignment) => {
    const chunkAnswers = allAnswers.filter((ans) => {
      if (ans.origin_daily_assignment_id === assignment.id) {
        return true;
      }
      const w = wordMap.get(ans.word_id);
      return w && w.number >= assignment.range_start && w.number <= assignment.range_end;
    });

    const totalAttempts = chunkAnswers.length;
    const mistakeCount = chunkAnswers.filter((a) => !a.is_known).length;

    // history: テストセッションごとにグルーピング
    const sessionMap = new Map<string, { date: string; created_at: string; answers: typeof chunkAnswers }>();
    chunkAnswers.forEach((ans) => {
      const sId = ans.session_id;
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, { date: ans.date, created_at: ans.created_at, answers: [] });
      }
      sessionMap.get(sId)!.answers.push(ans);
    });

    const sortedSessions = Array.from(sessionMap.values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    const history = sortedSessions.map((s) => {
      const sTotal = s.answers.length;
      const sMistakes = s.answers.filter((a) => !a.is_known).length;
      return {
        testDate: s.date,
        mistakeRate: sTotal > 0 ? Math.round((sMistakes / sTotal) * 100) / 100 : 0,
      };
    });

    // 最新のミス率
    let currentMistakeRate = 0;
    if (history.length > 0) {
      currentMistakeRate = history[history.length - 1].mistakeRate;
    } else if (totalAttempts > 0) {
      currentMistakeRate = Math.round((mistakeCount / totalAttempts) * 100) / 100;
    }

    // needsAttention 判定
    let needsAttention = false;
    if (history.length === 1) {
      needsAttention = history[0].mistakeRate > 0.3;
    } else if (history.length >= 2) {
      const recent2 = history.slice(-2);
      const avg = (recent2[0].mistakeRate + recent2[1].mistakeRate) / 2;
      needsAttention = avg > 0.3;
    }

    // 間違えた単語リストの集約
    const wordStatsMap = new Map<string, { mistakes: number; total: number }>();
    chunkAnswers.forEach((a) => {
      const cur = wordStatsMap.get(a.word_id) ?? { mistakes: 0, total: 0 };
      cur.total += 1;
      if (!a.is_known) cur.mistakes += 1;
      wordStatsMap.set(a.word_id, cur);
    });

    const mistakeWords: ChunkMistakeWord[] = [];
    wordStatsMap.forEach((stats, wordId) => {
      if (stats.mistakes > 0) {
        const wInfo = wordMap.get(wordId);
        if (wInfo) {
          mistakeWords.push({
            wordId: wInfo.id,
            headword: wInfo.word,
            pronunciation: wInfo.pronunciation ?? undefined,
            meaning: wInfo.meaning,
            number: wInfo.number,
            wrongCount: stats.mistakes,
            totalCount: stats.total,
          });
        }
      }
    });

    mistakeWords.sort((a, b) => b.wrongCount - a.wrongCount || a.number - b.number);

    return {
      chunkId: assignment.id,
      rangeStart: assignment.range_start,
      rangeEnd: assignment.range_end,
      originDate: assignment.date,
      totalAttempts,
      mistakeCount,
      mistakeRate: currentMistakeRate,
      history,
      needsAttention,
      mistakeWords,
    };
  });
}
