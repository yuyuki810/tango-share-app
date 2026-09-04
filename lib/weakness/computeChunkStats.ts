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

export interface ChunkHistoryPoint {
  testDate: string;
  accuracyRate: number; // 0..100 (%)
  correctCount: number;
  totalCount: number;
}

export interface ChunkStat {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  totalAttempts: number;
  correctCount: number;
  accuracyRate: number; // 0..100 (%)
  fullHistory: ChunkHistoryPoint[];  // 範囲全体テストの推移
  drillHistory: ChunkHistoryPoint[]; // 間違えた単語のみの再テスト推移
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

  // 2. 単語帳の全単語情報を取得
  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId);

  if (wordsError || !words || words.length === 0) {
    return [];
  }

  const wordMap = new Map<string, (typeof words)[0]>();
  words.forEach((w) => {
    wordMap.set(w.id, w);
  });

  // 3. ユーザーの全回答履歴を取得
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('id, date, type, completed_at, created_at, test_answers(id, is_known, origin_daily_assignment_id, word_id, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const allAnswers: Array<{
    id: string;
    is_known: boolean;
    origin_daily_assignment_id?: string | null;
    word_id: string;
    session_id: string;
    session_type: string;
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
        session_type: s.type || 'normal',
        date: s.date,
        created_at: a.created_at || s.created_at,
      });
    });
  });

  // 4. 各チャンクごとに集計
  return assignments.map((assignment) => {
    const chunkWordCount = assignment.range_end - assignment.range_start + 1;

    const chunkAnswers = allAnswers.filter((ans) => {
      if (ans.origin_daily_assignment_id === assignment.id) {
        return true;
      }
      const w = wordMap.get(ans.word_id);
      return w && w.number >= assignment.range_start && w.number <= assignment.range_end;
    });

    const totalAttempts = chunkAnswers.length;
    const correctCount = chunkAnswers.filter((a) => a.is_known).length;

    // history: テストセッションごとにグルーピング
    const sessionMap = new Map<
      string,
      { date: string; created_at: string; type: string; answers: typeof chunkAnswers }
    >();

    chunkAnswers.forEach((ans) => {
      const sId = ans.session_id;
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, {
          date: ans.date,
          created_at: ans.created_at,
          type: ans.session_type,
          answers: [],
        });
      }
      sessionMap.get(sId)!.answers.push(ans);
    });

    const sortedSessions = Array.from(sessionMap.values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    const fullHistory: ChunkHistoryPoint[] = [];
    const drillHistory: ChunkHistoryPoint[] = [];

    sortedSessions.forEach((s) => {
      const sTotal = s.answers.length;
      const sCorrect = s.answers.filter((a) => a.is_known).length;
      const accuracyRate = sTotal > 0 ? Math.round((sCorrect / sTotal) * 100) : 0;

      // 範囲全体テスト (daily_check または チャンク総単語数の70%以上) vs 苦手克服ドリル
      const isFullScope =
        s.type === 'daily_check' || sTotal >= Math.min(Math.ceil(chunkWordCount * 0.7), chunkWordCount);

      const point: ChunkHistoryPoint = {
        testDate: s.date,
        accuracyRate,
        correctCount: sCorrect,
        totalCount: sTotal,
      };

      if (isFullScope) {
        fullHistory.push(point);
      } else {
        drillHistory.push(point);
      }
    });

    // チャンクの代表正答率
    let currentAccuracyRate = 0;
    if (fullHistory.length > 0) {
      currentAccuracyRate = fullHistory[fullHistory.length - 1].accuracyRate;
    } else if (drillHistory.length > 0) {
      currentAccuracyRate = drillHistory[drillHistory.length - 1].accuracyRate;
    } else if (totalAttempts > 0) {
      currentAccuracyRate = Math.round((correctCount / totalAttempts) * 100);
    }

    // needsAttention 判定 (正答率が70%未満、または直近のテストが低スコア)
    let needsAttention = false;
    if (fullHistory.length > 0) {
      const recent = fullHistory.slice(-2);
      const avg = recent.reduce((sum, p) => sum + p.accuracyRate, 0) / recent.length;
      needsAttention = avg < 70;
    } else if (totalAttempts > 0) {
      needsAttention = currentAccuracyRate < 70;
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
      correctCount,
      accuracyRate: currentAccuracyRate,
      fullHistory,
      drillHistory,
      needsAttention,
      mistakeWords,
    };
  });
}
