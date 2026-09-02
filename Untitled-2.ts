/**
 * setup_phase2.js
 * フェーズB: 弱点分析・苦手克服テスト 一括ファイル生成・更新スクリプト
 * 実行コマンド: node setup_phase2.js
 */

const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname, { recursive: true });
}

function writeFile(relativeFilePath, content) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  ensureDirectoryExistence(fullPath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[CREATED/UPDATED] ${relativeFilePath}`);
}

const files = {
  "lib/weakness/computeChunkStats.ts": `import type { SupabaseClient } from '@supabase/supabase-js';

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
  chunkId: string;        // daily_assignments.id(進める日)
  rangeStart: number;
  rangeEnd: number;
  originDate: string;     // その進める日の日付(タイル表示用ラベル)
  totalAttempts: number;  // このチャンクの単語が解答された延べ回数
  mistakeCount: number;
  mistakeRate: number;    // 0〜1
  history: Array<{ testDate: string; mistakeRate: number }>; // 時系列(古い→新しい)
  needsAttention: boolean; // 直近2件の平均mistakeRate > 0.3 (1件以下ならその1件 > 0.3)
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

  const chunkIds = assignments.map((a) => a.id);

  // 2. 対象チャンクに紐づく test_answers を取得
  const { data: answers } = await supabase
    .from('test_answers')
    .select(
      'id, is_known, origin_daily_assignment_id, word_id, session_id, created_at, test_sessions!inner(id, user_id, date, created_at)'
    )
    .eq('test_sessions.user_id', userId)
    .in('origin_daily_assignment_id', chunkIds)
    .order('created_at', { ascending: true });

  const allAnswers = answers ?? [];
  const allWordIds = Array.from(new Set(allAnswers.map((a) => a.word_id)));
  const wordMap = new Map<
    string,
    { id: string; word: string; pronunciation?: string | null; meaning: string; number: number }
  >();

  if (allWordIds.length > 0) {
    const { data: words } = await supabase
      .from('words')
      .select('id, word, pronunciation, meaning, number')
      .in('id', allWordIds);

    (words ?? []).forEach((w) => {
      wordMap.set(w.id, w);
    });
  }

  const answersByChunk = new Map<string, typeof allAnswers>();
  allAnswers.forEach((ans) => {
    const cid = ans.origin_daily_assignment_id;
    if (!cid) return;
    const list = answersByChunk.get(cid) ?? [];
    list.push(ans);
    answersByChunk.set(cid, list);
  });

  return assignments.map((assignment) => {
    const chunkAnswers = answersByChunk.get(assignment.id) ?? [];
    const totalAttempts = chunkAnswers.length;
    const mistakeCount = chunkAnswers.filter((a) => !a.is_known).length;
    const mistakeRate = totalAttempts > 0 ? mistakeCount / totalAttempts : 0;

    // history: セッションごとにグルーピング
    const sessionMap = new Map<string, { date: string; created_at: string; answers: typeof chunkAnswers }>();
    chunkAnswers.forEach((ans) => {
      const sessionRaw = ans.test_sessions;
      const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw;
      if (!session) return;
      const sId = session.id;
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, { date: session.date, created_at: session.created_at, answers: [] });
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
      mistakeRate: Math.round(mistakeRate * 100) / 100,
      history,
      needsAttention,
      mistakeWords,
    };
  });
}
`,

  "lib/weakness/getWeakWords.ts": `import type { SupabaseClient } from '@supabase/supabase-js';

export interface WeakWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  mistakeRate: number; // 0〜1
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

  const wordIds = words.map((w) => w.id);

  const { data: answers, error: answersError } = await supabase
    .from('test_answers')
    .select('word_id, is_known, created_at, origin_daily_assignment_id, test_sessions!inner(user_id)')
    .eq('test_sessions.user_id', userId)
    .in('word_id', wordIds)
    .order('created_at', { ascending: true });

  if (answersError || !answers || answers.length === 0) {
    return [];
  }

  const answersByWord = new Map<
    string,
    Array<{ is_known: boolean; created_at: string; origin_daily_assignment_id?: string | null }>
  >();
  answers.forEach((a) => {
    const list = answersByWord.get(a.word_id) ?? [];
    list.push(a);
    answersByWord.set(a.word_id, list);
  });

  const weakCards: WeakWordCard[] = [];

  for (const word of words) {
    const wordAnswers = answersByWord.get(word.id);
    if (!wordAnswers || wordAnswers.length === 0) continue;

    const totalAttempts = wordAnswers.length;
    const mistakeCount = wordAnswers.filter((a) => !a.is_known).length;
    const mistakeRate = mistakeCount / totalAttempts;
    const lastAnswer = wordAnswers[wordAnswers.length - 1];

    // 抽出基準: 直近解答が「わからなかった」 または mistakeRate >= 0.4
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

  // ミス率降順 & 番号順で最大50語に絞る
  weakCards.sort((a, b) => b.mistakeRate - a.mistakeRate || (a.number ?? 0) - (b.number ?? 0));

  return weakCards.slice(0, 50);
}
`,

  "lib/test/getTodayTestWords.ts": `import type { SupabaseClient } from '@supabase/supabase-js';

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
  today: string // YYYY-MM-DD
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
`,

  "components/weakness/WeaknessChunkTile.tsx": `"use client";

import React from 'react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessChunkTileProps {
  chunk: ChunkStat;
  onClick: (chunk: ChunkStat) => void;
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

export const WeaknessChunkTile: React.FC<WeaknessChunkTileProps> = ({ chunk, onClick }) => {
  const hasAttempts = chunk.totalAttempts > 0;
  const mistakePct = Math.round(chunk.mistakeRate * 100);

  // 4-5 配色設計: 既存トークンの濃淡だけで3段階を表現
  let styleClass = 'border-line bg-paper text-ink';
  let badgeText = '良好';
  let badgeStyle = 'bg-line/30 text-ink/70 border-line/60';

  if (!hasAttempts) {
    styleClass = 'border-line/60 bg-white text-ink/40';
    badgeText = '未実施';
    badgeStyle = 'bg-line/20 text-ink/40 border-line/40';
  } else if (chunk.mistakeRate >= 0.4) {
    styleClass = 'border-akashiito-border bg-akashiito/15 text-ink shadow-xs';
    badgeText = '要注意';
    badgeStyle = 'bg-akashiito/20 text-akashiito border-akashiito/30 font-bold';
  } else if (chunk.mistakeRate >= 0.15) {
    styleClass = 'border-highlighter/60 bg-highlighter/20 text-ink';
    badgeText = 'やや注意';
    badgeStyle = 'bg-highlighter/40 text-ink border-highlighter/60 font-semibold';
  }

  return (
    <button
      type="button"
      onClick={() => onClick(chunk)}
      className={`relative flex min-h-[120px] min-w-[130px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] hover:shadow-xs cursor-pointer ${styleClass}`}
    >
      {/* needsAttention の場合の控えめな赤ドット */}
      {chunk.needsAttention && (
        <span className="absolute right-2.5 top-2.5 flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-akashiito" />
        </span>
      )}

      {/* 上部: 日付 & 状態バッジ */}
      <div>
        <div className="flex items-center justify-between">
          <span className="font-maru text-[11px] font-bold text-ink/60">
            {formatDateLabel(chunk.originDate)}
          </span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${badgeStyle}`}>
            {badgeText}
          </span>
        </div>
        <p className="mt-1.5 font-mincho text-sm font-bold tracking-tight text-ink">
          No.{chunk.rangeStart}〜{chunk.rangeEnd}
        </p>
      </div>

      {/* 下部: ミス率 & テスト回数 */}
      <div className="mt-3 flex items-end justify-between border-t border-line/40 pt-2">
        <div>
          <span className="block font-maru text-[10px] text-ink/50">ミス率</span>
          <span className="font-mincho text-lg font-bold text-ink">
            {hasAttempts ? `${mistakePct}%` : '—'}
          </span>
        </div>
        <span className="font-maru text-[10px] text-ink/50">
          {hasAttempts ? `${chunk.history.length}回テスト` : '未受検'}
        </span>
      </div>
    </button>
  );
};
`,

  "components/weakness/WeaknessBottomSheet.tsx": `"use client";

import React, { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessBottomSheetProps {
  chunk: ChunkStat | null;
  onClose: () => void;
}

const DRAG_CLOSE_THRESHOLD = 80;

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

export function WeaknessBottomSheet({ chunk, onClose }: WeaknessBottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  const handlePointerDown = (e: ReactPointerEvent) => {
    dragStartY.current = e.clientY;
  };
  const handlePointerMove = (e: ReactPointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const handlePointerUp = () => {
    if (dragY > DRAG_CLOSE_THRESHOLD) {
      onClose();
    }
    setDragY(0);
    dragStartY.current = null;
  };

  if (!chunk) return null;

  const hasAttempts = chunk.totalAttempts > 0;
  const mistakePct = Math.round(chunk.mistakeRate * 100);

  // 折れ線グラフ用座標計算
  const chartWidth = 320;
  const chartHeight = 70;
  const paddingX = 35;
  const paddingY = 16;

  const historyPoints = chunk.history.map((h, i) => {
    const x =
      chunk.history.length === 1
        ? chartWidth / 2
        : paddingX + (i / (chunk.history.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - h.mistakeRate * (chartHeight - paddingY * 2);
    return {
      x,
      y,
      rate: Math.round(h.mistakeRate * 100),
      date: formatDateLabel(h.testDate),
    };
  });

  const pathD =
    historyPoints.length > 1
      ? historyPoints.reduce(
          (acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
          ''
        )
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `translateY(\${dragY}px)` }}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper shadow-2xl transition-transform duration-200 motion-reduce:transition-none"
      >
        {/* ドラッグハンドル & ヘッダー */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="sticky top-0 z-10 flex touch-none flex-col items-center bg-paper/95 px-4 pb-2 pt-3 backdrop-blur-xs border-b border-line/40"
        >
          <div className="h-1.5 w-12 rounded-full bg-line" />
          <div className="mt-2 flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-mincho text-lg font-bold text-ink">
                No.{chunk.rangeStart}〜{chunk.rangeEnd}
              </h2>
              <span className="font-maru text-xs text-ink/50">
                ({formatDateLabel(chunk.originDate)} 学習)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="flex min-h-[40px] min-w-[40px] items-center justify-center font-bold text-ink/40 hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4 pb-6">
          {/* サマリー統計 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs">
              <span className="block font-maru text-[11px] text-ink/50">現在のミス率</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mincho text-2xl font-bold text-ink">
                  {hasAttempts ? `${mistakePct}%` : '—'}
                </span>
                {chunk.needsAttention && (
                  <span className="rounded-full bg-akashiito/15 px-2 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                    要注意
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs">
              <span className="block font-maru text-[11px] text-ink/50">テスト回数</span>
              <p className="mt-1 font-mincho text-2xl font-bold text-ink">
                {chunk.history.length}{' '}
                <span className="font-maru text-xs font-normal text-ink/50">回</span>
              </p>
            </div>
          </div>

          {/* ミニ折れ線グラフ */}
          <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mincho text-xs font-bold text-ink/70">ミス率の推移</span>
              <span className="font-maru text-[10px] text-ink/40">古い順 → 最新</span>
            </div>

            {chunk.history.length === 0 ? (
              <p className="py-4 text-center font-maru text-xs text-ink/40">
                まだテスト履歴がありません
              </p>
            ) : (
              <div className="py-1">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-20 w-full overflow-visible">
                  <line
                    x1={paddingX}
                    y1={chartHeight - paddingY}
                    x2={chartWidth - paddingX}
                    y2={chartHeight - paddingY}
                    stroke="#EBE8DF"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  <line
                    x1={paddingX}
                    y1={chartHeight / 2}
                    x2={chartWidth - paddingX}
                    y2={chartHeight / 2}
                    stroke="#EBE8DF"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />

                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#232A3B"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {historyPoints.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="#232A3B"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <text
                        x={p.x}
                        y={p.y - 7}
                        textAnchor="middle"
                        className="fill-ink text-[10px] font-bold font-number"
                      >
                        {p.rate}%
                      </text>
                      <text
                        x={p.x}
                        y={chartHeight + 1}
                        textAnchor="middle"
                        className="fill-ink/40 text-[9px] font-maru"
                      >
                        {p.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* 間違えた単語一覧 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="font-mincho text-xs font-bold text-ink/70">
                間違えた単語 ({chunk.mistakeWords.length}語)
              </span>
            </div>

            {chunk.mistakeWords.length === 0 ? (
              <div className="rounded-2xl border border-line/60 bg-white p-4 text-center">
                <p className="font-mincho text-sm font-bold text-ink/70">間違えた単語はありません 🎉</p>
                <p className="mt-1 font-maru text-xs text-ink/40">この範囲はしっかり定着しています</p>
              </div>
            ) : (
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-0.5">
                {chunk.mistakeWords.map((w) => (
                  <div
                    key={w.wordId}
                    className="flex items-center justify-between rounded-xl border border-line bg-white p-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mincho text-base font-bold text-ink">{w.headword}</span>
                        {w.pronunciation && (
                          <span className="font-maru text-xs text-ink/40">{w.pronunciation}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-maru text-xs text-ink/70">{w.meaning}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-akashiito-border bg-akashiito/10 px-2 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                      {w.wrongCount}回ミス
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 下部アクションボタン */}
        <div className="sticky bottom-0 border-t border-line/80 bg-paper/95 p-4 backdrop-blur-xs">
          <Link
            href={`/test?mode=normal&originAssignmentId=${chunk.chunkId}`}
            className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
          >
            この範囲だけミニテストを行う
          </Link>
        </div>
      </div>
    </div>
  );
}
`,

  "components/weakness/ChunkSummaryScreen.tsx": `"use client";

import React from 'react';
import Link from 'next/link';

export interface ChunkResultItem {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  correctCount: number;
  totalCount: number;
  mistakeRate: number;
  prevMistakeRate: number | null;
  status: 'improved' | 'same' | 'worse' | 'first';
}

interface ChunkSummaryScreenProps {
  totalCorrect: number;
  totalCount: number;
  chunkResults: ChunkResultItem[];
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

export function ChunkSummaryScreen({
  totalCorrect,
  totalCount,
  chunkResults,
}: ChunkSummaryScreenProps) {
  const overallAccuracy = totalCount > 0 ? Math.round((totalCorrect / totalCount) * 100) : 0;

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between p-6 bg-paper">
      <div className="space-y-6">
        {/* ヘッダー・全体スコア */}
        <div className="text-center pt-4">
          <span className="inline-block rounded-full bg-highlighter/40 px-3 py-1 font-maru text-xs font-bold text-ink mb-2">
            総復習テスト完了 🎉
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">今週の復習サマリー</h1>
          <p className="mt-1 font-maru text-xs text-ink/60">
            各範囲の定着度を確認して、着実にステップアップしていきましょう
          </p>

          <div className="mt-5 rounded-3xl border border-line bg-white p-5 shadow-sm text-center">
            <span className="font-maru text-xs text-ink/50 block">全体の正答率</span>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-mincho text-4xl font-bold tracking-tight text-ink">
                {overallAccuracy}%
              </span>
              <span className="font-maru text-xs font-bold text-ink/50">
                ({totalCorrect} / {totalCount}語)
              </span>
            </div>
          </div>
        </div>

        {/* チャンク別目次リスト */}
        <div className="space-y-2.5">
          <h2 className="font-mincho text-xs font-bold text-ink/60 px-1">範囲ごとの定着状況</h2>
          <div className="space-y-2">
            {chunkResults.map((chunk) => {
              const accuracy =
                chunk.totalCount > 0
                  ? Math.round((chunk.correctCount / chunk.totalCount) * 100)
                  : 0;

              let badgeText = '初測定';
              let badgeClass = 'bg-line/20 text-ink/60 border-line/40';

              if (chunk.status === 'improved') {
                badgeText = '定着向上 ↑';
                badgeClass = 'bg-paper text-ink border-line font-bold';
              } else if (chunk.status === 'same') {
                badgeText = '維持 →';
                badgeClass = 'bg-paper text-ink/60 border-line/60';
              } else if (chunk.status === 'worse') {
                badgeText = '要注意 ⚠️';
                badgeClass = 'bg-akashiito/15 text-akashiito border-akashiito-border font-bold';
              }

              return (
                <div
                  key={chunk.chunkId}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 transition \${
                    chunk.status === 'worse'
                      ? 'border-akashiito-border/80 bg-akashiito/5'
                      : 'border-line bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mincho text-sm font-bold text-ink">
                        No.{chunk.rangeStart}〜{chunk.rangeEnd}
                      </span>
                      <span className="font-maru text-[10px] text-ink/40">
                        ({formatDateShort(chunk.originDate)})
                      </span>
                    </div>
                    <p className="mt-0.5 font-maru text-xs text-ink/60">
                      正解 {chunk.correctCount}/{chunk.totalCount}語 ({accuracy}%)
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs ${badgeClass}`}>
                      {badgeText}
                    </span>
                    {chunk.prevMistakeRate !== null && (
                      <span className="block mt-0.5 font-maru text-[10px] text-ink/40">
                        前回ミス率 {Math.round(chunk.prevMistakeRate * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* フッターアクション */}
      <div className="pt-6 pb-2">
        <Link
          href="/dashboard"
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}
`,

  "components/weakness/WeaknessMapClient.tsx": `"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';
import { WeaknessChunkTile } from './WeaknessChunkTile';
import { WeaknessBottomSheet } from './WeaknessBottomSheet';

interface WeaknessMapClientProps {
  chunks: ChunkStat[];
  wordbookName: string;
}

export function WeaknessMapClient({ chunks, wordbookName }: WeaknessMapClientProps) {
  const [selectedChunk, setSelectedChunk] = useState<ChunkStat | null>(null);

  const totalChunks = chunks.length;
  const attentionCount = chunks.filter((c) => c.needsAttention).length;
  const totalMistakes = chunks.reduce((acc, c) => acc + c.mistakeWords.length, 0);

  return (
    <div className="space-y-6">
      {/* ナビゲーション & ヘッダー */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-mincho text-2xl font-bold text-ink">弱点マップ</h1>
            <p className="font-maru text-xs text-ink/50 mt-0.5">
              {wordbookName || '単語帳'} の進度と定着傾向
            </p>
          </div>
        </div>
      </div>

      {/* サマリー概要 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">総学習範囲</span>
          <span className="font-mincho text-xl font-bold text-ink">{totalChunks}</span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">チャンク</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">要注意範囲</span>
          <span className={`font-mincho text-xl font-bold ${attentionCount > 0 ? 'text-akashiito' : 'text-ink'}`}>
            {attentionCount}
          </span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">箇所</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">苦手単語数</span>
          <span className="font-mincho text-xl font-bold text-ink">{totalMistakes}</span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">語</span>
        </div>
      </div>

      {/* チャンクタイル一覧 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs font-bold text-ink/60">学習範囲タイル一覧</h2>
          <span className="font-maru text-[10px] text-ink/40">タップして詳細・単語を確認</span>
        </div>

        {chunks.length === 0 ? (
          <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-xs">
            <p className="font-mincho text-base font-bold text-ink/70">まだ学習記録がありません</p>
            <p className="mt-1 font-maru text-xs text-ink/40">
              デイリーテストを進めると、ここに弱点分析が表示されます
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {chunks.map((chunk) => (
              <WeaknessChunkTile
                key={chunk.chunkId}
                chunk={chunk}
                onClick={setSelectedChunk}
              />
            ))}
          </div>
        )}
      </section>

      {/* 全体の苦手克服テスト CTA */}
      <div className="pt-2">
        <Link
          href="/test?mode=normal&weak=true"
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
        >
          単語帳全体の苦手克服テストを始める
        </Link>
      </div>

      {/* ボトムシート */}
      <WeaknessBottomSheet
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
}
`,

  "components/test/TestSessionRunner.tsx": `"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';
import { ChunkSummaryScreen, type ChunkResultItem } from '@/components/weakness/ChunkSummaryScreen';
import type { ReviewChunkSummaryInfo } from '@/lib/test/getTodayTestWords';

interface TestSessionRunnerProps {
  cards: WordCardData[];
  dailyAssignmentId: string | null;
  sessionType: 'daily_check' | 'normal';
  isReviewDay?: boolean;
  reviewChunks?: ReviewChunkSummaryInfo[];
}

export function TestSessionRunner({
  cards,
  dailyAssignmentId,
  sessionType,
  isReviewDay = false,
  reviewChunks = [],
}: TestSessionRunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Map<string, boolean>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    totalCorrect: number;
    totalCount: number;
    chunkResults: ChunkResultItem[];
  } | null>(null);

  const handleJudge = (wordId: string, isKnown: boolean) => {
    setAnswers((prev) => new Map(prev).set(wordId, isKnown));
  };

  const handleAllDone = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const results = cards.map((c) => ({
      wordId: c.wordId,
      isKnown: answers.get(c.wordId) ?? false,
      originDailyAssignmentId: c.originDailyAssignmentId,
    }));

    try {
      const res = await fetch('/api/test-sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyAssignmentId,
          type: sessionType,
          results,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save test session');
      }

      // 復習日のテストだった場合は中間サマリー画面を表示
      if (isReviewDay && reviewChunks.length > 0) {
        const correctCount = results.filter((r) => r.isKnown).length;
        const totalCount = results.length;

        const chunkResults: ChunkResultItem[] = reviewChunks.map((rc) => {
          const chunkCards = cards.filter(
            (c) =>
              c.originDailyAssignmentId === rc.chunkId ||
              (typeof c.number === 'number' &&
                c.number >= rc.rangeStart &&
                c.number <= rc.rangeEnd)
          );
          const cTotal = chunkCards.length;
          const cCorrect = chunkCards.filter((c) => answers.get(c.wordId) ?? false).length;
          const cMistakes = cTotal - cCorrect;
          const cMistakeRate = cTotal > 0 ? Math.round((cMistakes / cTotal) * 100) / 100 : 0;

          let status: 'improved' | 'same' | 'worse' | 'first' = 'first';
          if (rc.prevMistakeRate !== null) {
            const diff = cMistakeRate - rc.prevMistakeRate;
            if (diff <= -0.1) {
              status = 'improved';
            } else if (diff >= 0.1) {
              status = 'worse';
            } else {
              status = 'same';
            }
          }

          return {
            chunkId: rc.chunkId,
            rangeStart: rc.rangeStart,
            rangeEnd: rc.rangeEnd,
            originDate: rc.originDate,
            correctCount: cCorrect,
            totalCount: cTotal,
            mistakeRate: cMistakeRate,
            prevMistakeRate: rc.prevMistakeRate,
            status,
          };
        });

        setSummaryData({
          totalCorrect: correctCount,
          totalCount,
          chunkResults,
        });
        return;
      }
    } catch (err) {
      console.error('Error submitting test session', err);
    } finally {
      if (!isReviewDay || reviewChunks.length === 0) {
        router.push('/dashboard');
        router.refresh();
      }
    }
  };

  if (summaryData) {
    return (
      <ChunkSummaryScreen
        totalCorrect={summaryData.totalCorrect}
        totalCount={summaryData.totalCount}
        chunkResults={summaryData.chunkResults}
      />
    );
  }

  return (
    <WordJudgeCardScreen
      cards={cards}
      onJudge={handleJudge}
      onAllDone={handleAllDone}
    />
  );
}
`,

  "app/(main)/weakness/page.tsx": `import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeChunkStats } from '@/lib/weakness/computeChunkStats';
import { WeaknessMapClient } from '@/components/weakness/WeaknessMapClient';

export default async function WeaknessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/dashboard');
  }

  const wordbookName = (profile.wordbooks as { name?: string } | null)?.name ?? '';
  const chunks = await computeChunkStats(supabase, user.id, profile.wordbook_id);

  return (
    <main className="mx-auto max-w-md w-full px-4 pb-24 pt-6">
      <WeaknessMapClient chunks={chunks} wordbookName={wordbookName} />
    </main>
  );
}
`,

  "app/(main)/test/page.tsx": `import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { getTodayTestContext } from '@/lib/test/getTodayTestWords';
import { getWeakWords } from '@/lib/weakness/getWeakWords';
import { TestSessionRunner } from '@/components/test/TestSessionRunner';

interface TestPageProps {
  searchParams: Promise<{ mode?: string; originAssignmentId?: string; weak?: string }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const params = await searchParams;
  const sessionType = params.mode === 'normal' ? 'normal' : 'daily_check';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/dashboard');
  }

  // 1. チャンク指定の苦手克服テスト
  if (params.originAssignmentId) {
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id, {
      chunkId: params.originAssignmentId,
    });

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">この範囲に苦手な単語はありません！</p>
          <p className="font-maru text-xs text-ink/60">しっかり定着しています。次の学習に進みましょう。</p>
          <Link
            href="/weakness"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm"
          >
            弱点マップへ戻る
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={params.originAssignmentId}
          sessionType="normal"
          isReviewDay={false}
        />
      </main>
    );
  }

  // 2. 単語帳全体の苦手克服テスト
  if (params.weak === 'true') {
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id);

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">現在、苦手な単語はありません！</p>
          <p className="font-maru text-xs text-ink/60">日々の学習が成果に繋がっています。</p>
          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm"
          >
            ダッシュボードへ戻る
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={null}
          sessionType="normal"
          isReviewDay={false}
        />
      </main>
    );
  }

  // 3. 通常のデイリーテスト
  const today = getTodayJST();
  const context = await getTodayTestContext(supabase, user.id, today);

  if (!context || context.cards.length === 0) {
    return (
      <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-mincho text-lg text-ink">今日のテストはありません</p>
        <p className="font-maru text-xs text-ink/60">範囲が未設定か、今日はお休みです</p>
        <Link
          href="/dashboard"
          className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto h-[100dvh] max-w-md bg-paper">
      <TestSessionRunner
        cards={context.cards}
        dailyAssignmentId={context.dailyAssignmentId}
        sessionType={sessionType}
        isReviewDay={context.isReviewDay}
        reviewChunks={context.reviewChunks}
      />
    </main>
  );
}
`,

  "app/(main)/dashboard/page.tsx": `import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  getTodayJST,
  getThisWeekSaturdayJST,
  getPreviousSaturday,
  getWeekDates,
} from '@/lib/assignment/weekDates';
import { TodayRangeCard } from '@/components/dashboard/TodayRangeCard';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { SetRangeCTA } from '@/components/dashboard/SetRangeCTA';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import type { LastWeekData } from '@/components/weekly-range/CycleSettingsPanel';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name, total_words)')
    .eq('id', user.id)
    .single();

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST(); // 土曜起点
  const prevWeekStartDate = getPreviousSaturday(weekStartDate);
  const weekDates = getWeekDates(weekStartDate);

  // 1. 今週の週間範囲
  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  // 2. 先週の週間範囲
  const { data: prevWeeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', prevWeekStartDate)
    .maybeSingle();

  const lastWeekData: LastWeekData | undefined = prevWeeklyRange
    ? {
        rangeStart: prevWeeklyRange.range_start,
        rangeEnd: prevWeeklyRange.range_end,
        perDayCount:
          prevWeeklyRange.per_day_count ??
          Math.max(1, Math.round((prevWeeklyRange.range_end - prevWeeklyRange.range_start + 1) / 5)),
        cycleType: (prevWeeklyRange.cycle_type as CycleType) ?? 'five_two',
        customDayTypes: (prevWeeklyRange.custom_day_types as DayType[]) ?? undefined,
      }
    : undefined;

  // 3. 今週の日次割当
  const { data: assignments } = await supabase
    .from('daily_assignments')
    .select('date, range_start, range_end, is_review_day')
    .eq('user_id', user.id)
    .in('date', weekDates);

  const assignmentByDate = new Map((assignments ?? []).map((a) => [a.date, a]));

  const weekDays = weekDates.map((date) => {
    const a = assignmentByDate.get(date);
    return {
      date,
      rangeStart: a?.range_start ?? null,
      rangeEnd: a?.range_end ?? null,
      isReviewDay: a?.is_review_day ?? false,
    };
  });

  const todayAssignment = assignmentByDate.get(today);

  const wordbookData = profile?.wordbooks as { name?: string; total_words?: number } | null;
  const wordbookName = wordbookData?.name ?? '';
  const wordbookTotalWords = wordbookData?.total_words ?? 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-24 pt-6">
      {/* 上部ヘッダー */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-mincho text-2xl font-bold text-ink">単語帳</h1>
          <p className="font-maru text-xs text-ink/50">毎日コツコツ、記憶を定着</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-akashiito/30 bg-akashiito/10 px-3 py-1 font-maru text-xs font-bold text-akashiito">
          <span>🔥</span>
          <span>7日連続</span>
        </div>
      </header>

      {/* 週間目標設定CTA */}
      <SetRangeCTA
        wordbookId={profile?.wordbook_id ?? ''}
        wordbookTotalWords={wordbookTotalWords}
        weekStartDate={weekStartDate}
        hasExistingRange={!!weeklyRange}
        initialCycleType={weeklyRange?.cycle_type as CycleType}
        initialCustomDayTypes={weeklyRange?.custom_day_types as DayType[]}
        initialRangeStart={weeklyRange?.range_start}
        initialPerDayCount={weeklyRange?.per_day_count}
        lastWeek={lastWeekData}
      />

      {/* 今日の学習カード */}
      <TodayRangeCard
        rangeStart={todayAssignment?.range_start ?? null}
        rangeEnd={todayAssignment?.range_end ?? null}
        isReviewDay={todayAssignment?.is_review_day ?? false}
        wordbookName={wordbookName}
      />

      {/* 週間スケジュール */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
          <Link
            href="/weakness"
            className="flex items-center gap-1 font-maru text-xs text-ink/60 transition hover:text-ink underline decoration-line underline-offset-4"
          >
            <span>弱点マップを見る</span>
            <span>→</span>
          </Link>
        </div>
        <WeeklySchedule days={weekDays} todayDate={today} />
      </section>
    </main>
  );
}
`
};

console.log('=== Generating Phase B files ===');
for (const [filePath, content] of Object.entries(files)) {
  writeFile(filePath, content);
}
console.log('=== All Phase B files generated successfully ===');