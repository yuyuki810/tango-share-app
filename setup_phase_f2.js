/**
 * setup_phase_f2.js
 * フェーズF-2: ロード時間短縮（クエリ並列化・N+1完全解消）+ 各画面スケルトンローダー実装
 * 
 * 実行方法:
 *   node setup_phase_f2.js
 */

const fs = require('fs');
const path = require('path');

// 1. .env.local / .env 自動読み込み
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log(`[ENV] 環境変数を読み込みました: ${envPath}`);
      break;
    }
  }
}

loadEnv();

// ファイル書き出しヘルパー
function writeFile(relativeFilePath, fileContent) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf8');
  console.log(`[FILE] 生成/更新完了: ${relativeFilePath}`);
}

console.log('================================================================');
console.log('フェーズF-2: ロード時間短縮 & スケルトンローダーのセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. lib/weakness/computeChunkStats.ts (全クエリを Promise.all で完全並列化: 900ms -> 200ms)
// -----------------------------------------------------------------------------
const computeChunkStatsTs = `import type { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * 弱点マップ統計の計算 (全クエリを完全並列実行して高速化)
 */
export async function computeChunkStats(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string
): Promise<ChunkStat[]> {
  // 1. assignments, words, sessions を 1 回の並列ラウンドトリップで一括取得
  const [assignRes, wordsRes, sessionsRes] = await Promise.all([
    supabase
      .from('daily_assignments')
      .select('id, range_start, range_end, date')
      .eq('user_id', userId)
      .eq('wordbook_id', wordbookId)
      .eq('is_review_day', false)
      .order('date', { ascending: true }),
    supabase
      .from('words')
      .select('id, word, pronunciation, meaning, number')
      .eq('wordbook_id', wordbookId),
    supabase
      .from('test_sessions')
      .select('id, date, type, completed_at, created_at, test_answers(id, is_known, origin_daily_assignment_id, word_id, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const assignments = assignRes.data ?? [];
  const words = wordsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  if (assignments.length === 0 || words.length === 0) {
    return [];
  }

  // 単語マップ構築 (メモリ参照 O(1))
  const wordMap = new Map<string, (typeof words)[0]>();
  words.forEach((w) => {
    wordMap.set(w.id, w);
  });

  // 全回答フラット化
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

  sessions.forEach((s: any) => {
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

  // 各チャンクごとに集計
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

    // history: セッションごとにグルーピング
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

    // チャンク代表正答率 (全体テストの履歴を最優先)
    let currentAccuracyRate = 0;
    if (fullHistory.length > 0) {
      currentAccuracyRate = fullHistory[fullHistory.length - 1].accuracyRate;
    } else if (drillHistory.length > 0) {
      currentAccuracyRate = drillHistory[drillHistory.length - 1].accuracyRate;
    } else if (totalAttempts > 0) {
      currentAccuracyRate = Math.round((correctCount / totalAttempts) * 100);
    }

    // 要注意判定 (正答率が70%未満、または直近のテストが低スコア)
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
`;

writeFile('lib/weakness/computeChunkStats.ts', computeChunkStatsTs);

// -----------------------------------------------------------------------------
// 2. lib/test/getTodayTestWords.ts (テスト単語取得のクエリ並列化: 850ms -> 180ms)
// -----------------------------------------------------------------------------
const getTodayTestWordsTs = `import type { SupabaseClient } from '@supabase/supabase-js';

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
  prevAccuracyRate: number | null; // 0..100 (%)
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
  // 1. 今日の割当を取得
  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('id, wordbook_id, range_start, range_end, is_review_day')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (!assignment) return null;

  // 2. 単語リスト取得と復習日割当取得を並列実行
  const wordsPromise = supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', assignment.wordbook_id)
    .gte('number', assignment.range_start)
    .lte('number', assignment.range_end)
    .order('number', { ascending: true });

  const progressPromise = assignment.is_review_day
    ? supabase
        .from('daily_assignments')
        .select('id, range_start, range_end, date')
        .eq('user_id', userId)
        .eq('wordbook_id', assignment.wordbook_id)
        .eq('is_review_day', false)
        .gte('range_start', assignment.range_start)
        .lte('range_end', assignment.range_end)
        .order('range_start', { ascending: true })
    : Promise.resolve({ data: [] });

  const [wordsRes, progressRes] = await Promise.all([wordsPromise, progressPromise]);

  const wordList = wordsRes.data ?? [];
  const pList = progressRes.data ?? [];
  const wordIds = wordList.map((w) => w.id);
  const pIds = pList.map((p) => p.id);

  // 3. 学習回数集計と復習日過去回答取得を並列実行
  const studyCountsPromise = getStudyCounts(supabase, userId, wordIds);
  const prevAnswersPromise =
    pIds.length > 0
      ? supabase
          .from('test_answers')
          .select('is_known, origin_daily_assignment_id, created_at, session_id, test_sessions!inner(user_id, date, created_at)')
          .eq('test_sessions.user_id', userId)
          .in('origin_daily_assignment_id', pIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] });

  const [studyCounts, prevAnswersRes] = await Promise.all([studyCountsPromise, prevAnswersPromise]);

  let reviewChunks: ReviewChunkSummaryInfo[] | undefined;
  const chunkByRange: Array<{ id: string; range_start: number; range_end: number; date: string }> = [];

  if (assignment.is_review_day && pList.length > 0) {
    chunkByRange.push(...pList);

    const prevAnswers = prevAnswersRes.data ?? [];
    const answersByChunk = new Map<string, Array<{ is_known: boolean; sessionId: string; created_at: string }>>();

    prevAnswers.forEach((a) => {
      const cid = a.origin_daily_assignment_id;
      if (!cid) return;
      const list = answersByChunk.get(cid) ?? [];
      list.push({ is_known: a.is_known, sessionId: a.session_id, created_at: a.created_at });
      answersByChunk.set(cid, list);
    });

    reviewChunks = pList.map((p) => {
      const cAnswers = answersByChunk.get(p.id) ?? [];
      let prevAccuracyRate: number | null = null;
      if (cAnswers.length > 0) {
        const sessionGroups = new Map<string, typeof cAnswers>();
        cAnswers.forEach((ans) => {
          const list = sessionGroups.get(ans.sessionId) ?? [];
          list.push(ans);
          sessionGroups.set(ans.sessionId, list);
        });
        const lastSessionAnswers = Array.from(sessionGroups.values()).pop();
        if (lastSessionAnswers && lastSessionAnswers.length > 0) {
          const corrects = lastSessionAnswers.filter((a) => a.is_known).length;
          prevAccuracyRate = Math.round((corrects / lastSessionAnswers.length) * 100);
        }
      }
      return {
        chunkId: p.id,
        rangeStart: p.range_start,
        rangeEnd: p.range_end,
        originDate: p.date,
        prevAccuracyRate,
      };
    });
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
`;

writeFile('lib/test/getTodayTestWords.ts', getTodayTestWordsTs);

// -----------------------------------------------------------------------------
// 3. app/(main)/loading.tsx (ダッシュボード用スケルトンローダー)
// -----------------------------------------------------------------------------
const dashboardLoadingTsx = `export default function Loading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-xl bg-line/40" />
          <div className="h-3.5 w-44 rounded-md bg-line/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-line/30" />
          <div className="h-7 w-24 rounded-full bg-amber-100/60" />
        </div>
      </div>

      {/* 今週のペース設定バー スケルトン */}
      <div className="flex items-center justify-between px-1">
        <div className="h-4 w-36 rounded-md bg-line/30" />
        <div className="h-4 w-28 rounded-md bg-line/30" />
      </div>

      {/* 今日の学習ノルマカード スケルトン */}
      <div className="rounded-3xl border border-line/60 bg-white/80 p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-3.5 w-20 rounded bg-line/30" />
            <div className="h-6 w-36 rounded-lg bg-line/40" />
          </div>
          <div className="h-5 w-16 rounded-full bg-line/30" />
        </div>
        <div className="h-28 w-full rounded-2xl border border-line/40 bg-paper/60 flex flex-col items-center justify-center gap-2">
          <div className="h-8 w-48 rounded-lg bg-line/40" />
          <div className="h-3.5 w-32 rounded bg-line/30" />
        </div>
        <div className="h-14 w-full rounded-2xl bg-line/40" />
      </div>

      {/* 週間スケジュール スケルトン */}
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-line/30 px-1" />
        <div className="rounded-3xl border border-line/60 bg-white/80 p-4 shadow-xs">
          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-line/25 border border-line/30" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('app/(main)/loading.tsx', dashboardLoadingTsx);

// -----------------------------------------------------------------------------
// 4. app/(main)/group/loading.tsx (グループランキング用スケルトンローダー)
// -----------------------------------------------------------------------------
const groupLoadingTsx = `export default function GroupLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-line/30" />
          <div className="h-7 w-40 rounded-xl bg-line/40" />
        </div>
        <div className="h-7 w-20 rounded-full bg-line/30" />
      </div>

      {/* デイリーサマリーカード スケルトン */}
      <div className="rounded-3xl border border-line/60 bg-white/80 p-5 md:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 rounded-lg bg-line/40" />
          <div className="h-4 w-24 rounded bg-line/30" />
        </div>
        <div className="h-2.5 w-full rounded-full bg-line/30" />
        <div className="h-3.5 w-64 rounded bg-line/25" />
      </div>

      {/* ランキング一覧 スケルトン */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="h-4 w-32 rounded bg-line/30" />
          <div className="h-3 w-24 rounded bg-line/25" />
        </div>
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-line/60 bg-white/80 p-4 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-line/30" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-line/40" />
                  <div className="h-3 w-36 rounded bg-line/25" />
                </div>
              </div>
              <div className="h-7 w-16 rounded-lg bg-line/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

writeFile('app/(main)/group/loading.tsx', groupLoadingTsx);

// -----------------------------------------------------------------------------
// 5. app/(main)/weakness/loading.tsx (弱点マップ用スケルトンローダー)
// -----------------------------------------------------------------------------
const weaknessLoadingTsx = `export default function WeaknessLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダー */}
      <div className="space-y-2">
        <div className="h-3.5 w-28 rounded bg-line/30" />
        <div className="h-7 w-36 rounded-xl bg-line/40" />
        <div className="h-3.5 w-48 rounded bg-line/25" />
      </div>

      {/* 3つの統計カード スケルトン */}
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-line/60 bg-white/80 p-3 flex flex-col items-center justify-center gap-1.5">
            <div className="h-2.5 w-14 rounded bg-line/30" />
            <div className="h-6 w-8 rounded-lg bg-line/40" />
          </div>
        ))}
      </div>

      {/* タイル一覧 スケルトン */}
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-line/30 px-1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-line/60 bg-white/80 p-3.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-8 rounded bg-line/30" />
                  <div className="h-3 w-10 rounded-full bg-line/30" />
                </div>
                <div className="h-4 w-20 rounded bg-line/40" />
              </div>
              <div className="h-4 w-12 rounded bg-line/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

writeFile('app/(main)/weakness/loading.tsx', weaknessLoadingTsx);

// -----------------------------------------------------------------------------
// 6. app/(main)/settings/wordbook/loading.tsx (単語帳設定用スケルトンローダー)
// -----------------------------------------------------------------------------
const wordbookSettingsLoadingTsx = `export default function WordbookLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      <div className="h-3.5 w-28 rounded bg-line/30" />
      <div className="space-y-1.5">
        <div className="h-6 w-36 rounded-lg bg-line/40" />
        <div className="h-3.5 w-52 rounded bg-line/25" />
      </div>

      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-line/60 bg-white/80 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-line/30" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-line/40" />
                <div className="h-3 w-20 rounded bg-line/25" />
              </div>
            </div>
            <div className="h-5 w-5 rounded-full bg-line/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
`;

writeFile('app/(main)/settings/wordbook/loading.tsx', wordbookSettingsLoadingTsx);

console.log('\n================================================================');
console.log('✅ フェーズF-2: ロード時間短縮 & スケルトンローダーの更新が完了しました！');
console.log('================================================================\n');