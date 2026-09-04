/**
 * setup_phase_f1.js
 * フェーズF-1: 正答率表示の改善（グラフ分離 + 「ミス率」→「正答率」統一）一括反映スクリプト
 * 
 * 実行方法:
 *   node setup_phase_f1.js
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
console.log('フェーズF-1: 正答率統一 & グラフ分離のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. lib/weakness/computeChunkStats.ts (正答率計算 & 全体/ドリル推移の完全分離)
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
`;

writeFile('lib/weakness/computeChunkStats.ts', computeChunkStatsTs);

// -----------------------------------------------------------------------------
// 2. components/weakness/WeaknessChunkTile.tsx (正答率ベースの表示とポジティブ色分け)
// -----------------------------------------------------------------------------
const weaknessChunkTileTsx = `'use client';

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
  const accuracy = chunk.accuracyRate;

  let styleClass = 'border-line bg-paper text-ink';
  let badgeText = '良好';
  let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';

  if (!hasAttempts) {
    styleClass = 'border-line/60 bg-white text-ink/40';
    badgeText = '未受検';
    badgeStyle = 'bg-line/20 text-ink/40 border-line/40';
  } else if (accuracy < 60) {
    styleClass = 'border-akashiito-border bg-akashiito/10 text-ink shadow-2xs';
    badgeText = '要注意';
    badgeStyle = 'bg-akashiito/20 text-akashiito border-akashiito-border font-bold';
  } else if (accuracy < 80) {
    styleClass = 'border-amber-300/80 bg-amber-50/50 text-ink';
    badgeText = 'やや注意';
    badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
  }

  const totalSessionsCount = chunk.fullHistory.length + chunk.drillHistory.length;

  return (
    <button
      type="button"
      onClick={() => onClick(chunk)}
      className={\`relative flex min-h-[120px] min-w-[130px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] hover:shadow-xs cursor-pointer \${styleClass}\`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="font-maru text-[11px] font-bold text-ink/60">
            {formatDateLabel(chunk.originDate)}
          </span>
          <span className={\`rounded-full border px-1.5 py-0.5 text-[9px] \${badgeStyle}\`}>
            {badgeText}
          </span>
        </div>
        <p className="mt-1.5 font-mincho text-sm font-bold tracking-tight text-ink">
          No.{chunk.rangeStart}〜{chunk.rangeEnd}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-line/40 pt-2">
        <div>
          <span className="block font-maru text-[10px] text-ink/50">正答率</span>
          <span className="font-mincho text-lg font-bold text-ink">
            {hasAttempts ? \`\${accuracy}%\` : '—'}
          </span>
        </div>
        <span className="font-maru text-[10px] text-ink/50">
          {hasAttempts ? \`\${totalSessionsCount}回受検\` : '未受検'}
        </span>
      </div>
    </button>
  );
};
`;

writeFile('components/weakness/WeaknessChunkTile.tsx', weaknessChunkTileTsx);

// -----------------------------------------------------------------------------
// 3. components/weakness/WeaknessBottomSheet.tsx (全体正答率グラフ & 苦手克服グラフの完全分離)
// -----------------------------------------------------------------------------
const weaknessBottomSheetTsx = `'use client';

import React, { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import type { ChunkStat, ChunkHistoryPoint } from '@/lib/weakness/computeChunkStats';

interface WeaknessBottomSheetProps {
  chunk: ChunkStat | null;
  onClose: () => void;
}

const DRAG_CLOSE_THRESHOLD = 80;

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

// 共通SVG折れ線グラフコンポーネント (正答率 0〜100% 描画)
function AccuracyLineChart({
  points,
  emptyMessage,
}: {
  points: ChunkHistoryPoint[];
  emptyMessage: string;
}) {
  const chartWidth = 320;
  const chartHeight = 70;
  const paddingX = 40;
  const paddingY = 16;

  if (points.length === 0) {
    return (
      <p className="py-4 text-center font-maru text-xs text-ink/40 leading-relaxed">
        {emptyMessage}
      </p>
    );
  }

  // 同日付ラベルの重複を「9/1(1)」「9/1(2)」で識別
  const dateCounts = new Map<string, number>();
  points.forEach((h) => {
    dateCounts.set(h.testDate, (dateCounts.get(h.testDate) ?? 0) + 1);
  });

  const dateOccurrences = new Map<string, number>();
  const renderedPoints = points.map((h, i) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : paddingX + (i / (points.length - 1)) * (chartWidth - paddingX * 2);
    
    // 正答率が高いほど上にプロット (0%=下, 100%=上)
    const y = chartHeight - paddingY - (h.accuracyRate / 100) * (chartHeight - paddingY * 2);

    const baseDate = formatDateLabel(h.testDate);
    const totalOnDate = dateCounts.get(h.testDate) ?? 1;
    let label = baseDate;
    if (totalOnDate > 1) {
      const currentOccur = (dateOccurrences.get(h.testDate) ?? 0) + 1;
      dateOccurrences.set(h.testDate, currentOccur);
      label = \`\${baseDate}(\${currentOccur})\`;
    }

    return {
      x,
      y,
      rate: h.accuracyRate,
      date: label,
    };
  });

  const pathD =
    renderedPoints.length > 1
      ? renderedPoints.reduce(
          (acc, p, idx) => \`\${acc} \${idx === 0 ? 'M' : 'L'} \${p.x} \${p.y}\`,
          ''
        )
      : '';

  return (
    <div className="py-1">
      <svg viewBox={\`0 0 \${chartWidth} \${chartHeight}\`} className="h-20 w-full overflow-visible">
        {/* 目安線 (100%, 50%, 0%) */}
        <line
          x1={paddingX}
          y1={paddingY}
          x2={chartWidth - paddingX}
          y2={paddingY}
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
        <line
          x1={paddingX}
          y1={chartHeight - paddingY}
          x2={chartWidth - paddingX}
          y2={chartHeight - paddingY}
          stroke="#EBE8DF"
          strokeWidth="1"
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

        {renderedPoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#232A3B" stroke="#FFFFFF" strokeWidth="2" />
            <text x={p.x} y={p.y - 7} textAnchor="middle" className="fill-ink text-[10px] font-bold font-number">
              {p.rate}%
            </text>
            <text x={p.x} y={chartHeight + 1} textAnchor="middle" className="fill-ink/40 text-[9px] font-maru">
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
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
  const accuracy = chunk.accuracyRate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: \`translateY(\${dragY}px)\` }}
        className="max-h-[88vh] w-full max-w-md md:max-w-xl overflow-y-auto rounded-t-3xl bg-paper shadow-2xl transition-transform duration-200 motion-reduce:transition-none"
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
              <span className="block font-maru text-[11px] text-ink/50">現在の全体正答率</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mincho text-2xl font-bold text-ink">
                  {hasAttempts ? \`\${accuracy}%\` : '—'}
                </span>
                {chunk.needsAttention && (
                  <span className="rounded-full bg-akashiito/15 px-2 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                    要注意
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs">
              <span className="block font-maru text-[11px] text-ink/50">受検回数</span>
              <p className="mt-1 font-mincho text-sm font-bold text-ink leading-snug">
                全体: <span className="text-base font-number">{chunk.fullHistory.length}</span>回<br />
                苦手特訓: <span className="text-base font-number">{chunk.drillHistory.length}</span>回
              </p>
            </div>
          </div>

          {/* グラフ1: 範囲全体テストの正答率推移 */}
          <div className="rounded-2xl border border-line bg-white p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mincho text-xs font-bold text-ink">1. 全体正答率の推移</span>
                <p className="font-maru text-[10px] text-ink/50">※出題範囲全体の習熟度推移 ({chunk.fullHistory.length}回)</p>
              </div>
              <span className="font-maru text-[10px] text-ink/40">古い順 → 最新</span>
            </div>

            <AccuracyLineChart
              points={chunk.fullHistory}
              emptyMessage="まだ範囲全体のテスト履歴がありません"
            />
          </div>

          {/* グラフ2: 苦手克服テストの正答率推移 (間違えた単語のみ対象) */}
          <div className="rounded-2xl border border-line bg-white p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mincho text-xs font-bold text-ink">2. 苦手克服テストの正答率</span>
                <p className="font-maru text-[10px] text-ink/50">※母数: 過去に間違えた単語のみ ({chunk.drillHistory.length}回)</p>
              </div>
              <span className="font-maru text-[10px] text-ink/40">古い順 → 最新</span>
            </div>

            <AccuracyLineChart
              points={chunk.drillHistory}
              emptyMessage="苦手克服テストの履歴はまだありません。下のボタンから特訓できます。"
            />
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
                    <span className="shrink-0 rounded-full border border-akashiito-border bg-akashiito/10 px-2.5 py-0.5 font-maru text-[10px] font-bold text-akashiito">
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
            href={\`/test?mode=normal&originAssignmentId=\${chunk.chunkId}\`}
            className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
          >
            この範囲の苦手克服ミニテストを行う
          </Link>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('components/weakness/WeaknessBottomSheet.tsx', weaknessBottomSheetTsx);

// -----------------------------------------------------------------------------
// 4. components/weakness/ChunkSummaryScreen.tsx (正答率ベースに統一 & 前回正答率表示)
// -----------------------------------------------------------------------------
const chunkSummaryScreenTsx = `'use client';

import React from 'react';
import Link from 'next/link';

export interface ChunkResultItem {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  correctCount: number;
  totalCount: number;
  accuracyRate: number; // 0..100 (%)
  prevAccuracyRate: number | null; // 0..100 (%)
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
    <div className="flex min-h-[100dvh] flex-col justify-between p-6 md:p-8 lg:p-10 bg-paper max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full">
      <div className="space-y-6">
        <div className="text-center pt-4">
          <span className="inline-block rounded-full bg-highlighter/40 px-3 py-1 font-maru text-xs font-bold text-ink mb-2">
            総復習テスト完了 🎉
          </span>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">今週の復習サマリー</h1>
          <p className="mt-1 font-maru text-xs md:text-sm text-ink/60">
            各範囲の定着度を確認して、着実にステップアップしていきましょう
          </p>

          <div className="mt-5 rounded-3xl border border-line bg-white p-5 md:p-6 shadow-sm text-center">
            <span className="font-maru text-xs md:text-sm text-ink/50 block">全体の正答率</span>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-mincho text-4xl md:text-5xl font-bold tracking-tight text-ink">
                {overallAccuracy}%
              </span>
              <span className="font-maru text-xs md:text-sm font-bold text-ink/50">
                ({totalCorrect} / {totalCount}語)
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60 px-1">範囲ごとの定着状況</h2>
          <div className="space-y-2">
            {chunkResults.map((chunk) => {
              let badgeText = '初測定';
              let badgeClass = 'bg-line/20 text-ink/60 border-line/40';

              if (chunk.status === 'improved') {
                badgeText = '定着向上 ↑';
                badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
              } else if (chunk.status === 'same') {
                badgeText = '維持 →';
                badgeClass = 'bg-paper text-ink/70 border-line font-medium';
              } else if (chunk.status === 'worse') {
                badgeText = '要復習 ⚠️';
                badgeClass = 'bg-akashiito/15 text-akashiito border-akashiito-border font-bold';
              }

              return (
                <div
                  key={chunk.chunkId}
                  className={\`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition \${
                    chunk.status === 'worse'
                      ? 'border-akashiito-border/80 bg-akashiito/5'
                      : 'border-line bg-white'
                  }\`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mincho text-sm md:text-base font-bold text-ink">
                        No.{chunk.rangeStart}〜{chunk.rangeEnd}
                      </span>
                      <span className="font-maru text-[10px] md:text-xs text-ink/40">
                        ({formatDateShort(chunk.originDate)})
                      </span>
                    </div>
                    <p className="mt-0.5 font-maru text-xs md:text-sm text-ink/60">
                      正解 {chunk.correctCount}/{chunk.totalCount}語 ({chunk.accuracyRate}%)
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={\`inline-block rounded-full border px-2.5 py-1 text-xs \${badgeClass}\`}>
                      {badgeText}
                    </span>
                    {chunk.prevAccuracyRate !== null && (
                      <span className="block mt-0.5 font-maru text-[10px] text-ink/40">
                        前回正答率 {chunk.prevAccuracyRate}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-6 pb-2">
        <Link
          href="/dashboard"
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}
`;

writeFile('components/weakness/ChunkSummaryScreen.tsx', chunkSummaryScreenTsx);

// -----------------------------------------------------------------------------
// 5. lib/test/getTodayTestWords.ts (prevAccuracyRate に改称・算出)
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
// 6. components/test/TestSessionRunner.tsx (ChunkResultItem の正答率計算)
// -----------------------------------------------------------------------------
const testSessionRunnerTsx = `'use client';

import { useState, useEffect, useRef } from 'react';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';
import { ChunkSummaryScreen, type ChunkResultItem } from '@/components/weakness/ChunkSummaryScreen';
import { TestResultScreen } from '@/components/test/TestResultScreen';
import type { ReviewChunkSummaryInfo } from '@/lib/test/getTodayTestWords';
import { RefreshCw, Play, RotateCcw } from 'lucide-react';

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [resumePrompt, setResumePrompt] = useState<{
    answeredCount: number;
    answeredMap: Map<string, boolean>;
  } | null>(null);

  const [initialIndex, setInitialIndex] = useState(0);
  const [initialAnswers, setInitialAnswers] = useState<Map<string, boolean>>(new Map());
  const pendingAnswersQueue = useRef<Array<{ wordId: string; isKnown: boolean }>>([]);

  const [resultData, setResultData] = useState<{
    correctCount: number;
    totalCount: number;
    wrongCards: WordCardData[];
    chunkResults?: ChunkResultItem[];
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean;
    isSuccess: boolean;
    errorMessage?: string;
    detail?: string;
    savedCount?: number;
  }>({
    isSaving: false,
    isSuccess: false,
  });

  // 1. セッション初期化 (/api/test-sessions/start)
  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);

    fetch('/api/test-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: sessionType,
        dailyAssignmentId,
        totalCount: cards.length,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          const currentId = data.session.id;
          setSessionId(currentId);
          sessionIdRef.current = currentId;

          if (pendingAnswersQueue.current.length > 0) {
            pendingAnswersQueue.current.forEach((item) => {
              const matchedCard = cards.find((c) => c.wordId === item.wordId);
              fetch('/api/test-sessions/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: currentId,
                  wordId: item.wordId,
                  isKnown: item.isKnown,
                  originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
                }),
              }).catch((e) => console.error('Queue flush error:', e));
            });
            pendingAnswersQueue.current = [];
          }

          if (data.mode === 'resume' && data.answeredWords && data.answeredWords.length > 0) {
            const answeredMap = new Map<string, boolean>();
            data.answeredWords.forEach((a: any) => {
              answeredMap.set(a.wordId, a.isKnown);
            });

            if (data.answeredWords.length < cards.length) {
              setResumePrompt({
                answeredCount: data.answeredWords.length,
                answeredMap,
              });
            } else {
              setInitialAnswers(answeredMap);
              setInitialIndex(cards.length);
            }
          }
        } else {
          console.error('Failed to start session:', data.error);
        }
      })
      .catch((err) => {
        console.error('Start session request error:', err);
      })
      .finally(() => {
        if (isMounted) setIsInitializing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionType, dailyAssignmentId, cards.length]);

  // 2. 単語判定のたびに即座に都度保存
  const handleSingleJudge = (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    const matchedCard = cards.find((c) => c.wordId === wordId);

    if (!currentId) {
      pendingAnswersQueue.current.push({ wordId, isKnown });
      return;
    }

    fetch('/api/test-sessions/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        wordId,
        isKnown,
        originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
      }),
    }).catch((err) => {
      console.error('Answer streaming error:', err);
    });
  };

  // 3. 全問終了時のセッション完了確定処理 (正答率ベースでサマリー判定)
  const handleFinished = (resultsMap: Map<string, boolean>) => {
    const currentId = sessionIdRef.current;
    const results = cards.map((c) => ({
      wordId: c.wordId,
      isKnown: resultsMap.get(c.wordId) ?? false,
      originDailyAssignmentId: c.originDailyAssignmentId || dailyAssignmentId,
    }));

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;
    const wrongCards = cards.filter((c) => !(resultsMap.get(c.wordId) ?? false));

    if (isReviewDay && reviewChunks.length > 0) {
      const chunkResults: ChunkResultItem[] = reviewChunks.map((rc) => {
        const chunkCards = cards.filter(
          (c) =>
            c.originDailyAssignmentId === rc.chunkId ||
            (typeof c.number === 'number' &&
              c.number >= rc.rangeStart &&
              c.number <= rc.rangeEnd)
        );
        const cTotal = chunkCards.length;
        const cCorrect = chunkCards.filter((c) => resultsMap.get(c.wordId) ?? false).length;
        const cAccuracy = cTotal > 0 ? Math.round((cCorrect / cTotal) * 100) : 0;

        let status: 'improved' | 'same' | 'worse' | 'first' = 'first';
        if (rc.prevAccuracyRate !== null) {
          const diff = cAccuracy - rc.prevAccuracyRate;
          if (diff >= 10) {
            status = 'improved';
          } else if (diff <= -10) {
            status = 'worse';
          } else {
            status = 'same';
          }
        } else {
          status = 'first';
        }

        return {
          chunkId: rc.chunkId,
          rangeStart: rc.rangeStart,
          rangeEnd: rc.rangeEnd,
          originDate: rc.originDate,
          correctCount: cCorrect,
          totalCount: cTotal,
          accuracyRate: cAccuracy,
          prevAccuracyRate: rc.prevAccuracyRate,
          status,
        };
      });

      setResultData({
        correctCount,
        totalCount,
        wrongCards,
        chunkResults,
      });
    } else {
      setResultData({
        correctCount,
        totalCount,
        wrongCards,
      });
    }

    setSaveStatus({ isSaving: true, isSuccess: false });

    fetch('/api/test-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        results,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setSaveStatus({
            isSaving: false,
            isSuccess: true,
            savedCount: data.savedAnswersCount ?? results.length,
          });
        } else {
          setSaveStatus({
            isSaving: false,
            isSuccess: false,
            errorMessage: data.error || '保存エラー',
            detail: data.detail || \`HTTP \${res.status}\`,
          });
        }
      })
      .catch((err) => {
        console.error('Error completing test session:', err);
        setSaveStatus({
          isSaving: false,
          isSuccess: false,
          errorMessage: '通信エラー',
          detail: err?.message || String(err),
        });
      });
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-ink/60 font-maru">
        <RefreshCw className="h-6 w-6 animate-spin text-ink/40" />
        <p className="text-xs">テストを準備中...</p>
      </div>
    );
  }

  if (resumePrompt) {
    const isDailyCheck = sessionType === 'daily_check';
    return (
      <div className="mx-auto flex min-h-[85vh] max-w-md md:max-w-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-full rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-300">
            <RotateCcw className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-mincho text-xl font-bold text-ink">
              前回の続きから再開しますか？
            </h2>
            <p className="mt-1.5 font-maru text-xs text-ink/60 leading-relaxed">
              前回の中断データが見つかりました。<br />
              <strong className="text-ink font-bold">
                {resumePrompt.answeredCount} / {cards.length} 語
              </strong> まで回答済みです。
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setInitialAnswers(resumePrompt.answeredMap);
                setInitialIndex(resumePrompt.answeredCount);
                setResumePrompt(null);
              }}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer hover:bg-ink/90"
            >
              <Play className="h-4 w-4 fill-paper" />
              <span>続きから再開する（{resumePrompt.answeredCount + 1}問目〜）</span>
            </button>

            {!isDailyCheck ? (
              <button
                type="button"
                onClick={() => {
                  setInitialAnswers(new Map());
                  setInitialIndex(0);
                  setResumePrompt(null);
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line bg-paper font-maru text-xs font-medium text-ink/70 transition hover:bg-paper-hover active:scale-98 cursor-pointer"
              >
                最初からやり直す
              </button>
            ) : (
              <p className="font-maru text-[11px] text-ink/40 pt-1">
                ※ 本番チェックは1日1回限定のため、続きからのみ受験可能です
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resultData) {
    if (isReviewDay && resultData.chunkResults) {
      return (
        <ChunkSummaryScreen
          totalCorrect={resultData.correctCount}
          totalCount={resultData.totalCount}
          chunkResults={resultData.chunkResults}
        />
      );
    }

    return (
      <TestResultScreen
        correctCount={resultData.correctCount}
        totalCount={resultData.totalCount}
        wrongCards={resultData.wrongCards}
        sessionType={sessionType}
        saveStatus={saveStatus}
      />
    );
  }

  return (
    <WordJudgeCardScreen
      cards={cards}
      initialIndex={initialIndex}
      initialAnswers={initialAnswers}
      onJudge={handleSingleJudge}
      onFinished={handleFinished}
      title={sessionType === 'daily_check' ? '本日のテスト結果' : '苦手克服テスト結果'}
    />
  );
}
`;

writeFile('components/test/TestSessionRunner.tsx', testSessionRunnerTsx);

// -----------------------------------------------------------------------------
// 7. lib/weakness/getWeakWords.ts (accuracyRate に統一 & 最低正答率順ソート)
// -----------------------------------------------------------------------------
const getWeakWordsTs = `import type { SupabaseClient } from '@supabase/supabase-js';

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
`;

writeFile('lib/weakness/getWeakWords.ts', getWeakWordsTs);

console.log('\n================================================================');
console.log('✅ フェーズF-1: 正答率統一 & グラフ完全分離が完了しました！');
console.log('================================================================\n');