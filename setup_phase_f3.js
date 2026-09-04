/**
 * setup_phase_f3.js
 * フェーズF-3: 復習の絞り込みモード追加（ミス多順・直近ミス順・出題数選択）一括反映スクリプト
 * 
 * 実行方法:
 *   node setup_phase_f3.js
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
console.log('フェーズF-3: 復習絞り込みモード（ミス多順・直近ミス）のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. lib/weakness/getWeakWords.ts (絞り込みモード対応 & N+1ゼロ・ペイロード極小化)
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
  mistakeCount?: number;
  lastWrongAt?: string;
}

export interface GetWeakWordsOptions {
  chunkId?: string;
  filterMode?: 'all' | 'mistakes' | 'recent';
  limit?: number; // 5, 10, 20 等
  days?: number;  // 直近 3, 7 日 等
}

/**
 * 苦手単語を条件に応じて高速抽出する (N+1ゼロ & 対象単語のみクエリして高速化)
 */
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

  // 1. チャンク指定がある場合は範囲を取得
  let chunkRange: { start: number; end: number } | null = null;
  if (targetChunkId) {
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

  // 2. ユーザーの全回答履歴を一括取得 (N+1ゼロ)
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

  // 3. 苦手単語（ミス回数 >= 1 かつ 不正解または正答率60%以下）をフィルタ
  const now = new Date();
  const daysThreshold = filterDays
    ? new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  let candidateAggs = Array.from(aggMap.values()).filter((agg) => {
    const accuracy =
      agg.totalAttempts > 0 ? Math.round((agg.correctCount / agg.totalAttempts) * 100) : 0;
    const isWeak = !agg.lastAnswerKnown || accuracy <= 60 || agg.mistakeCount > 0;
    if (!isWeak || agg.mistakeCount === 0) return false;

    // 直近期間フィルター
    if (filterMode === 'recent' && daysThreshold && agg.lastWrongAt) {
      if (agg.lastWrongAt < daysThreshold) return false;
    }

    return true;
  });

  if (candidateAggs.length === 0) return [];

  // 4. ソート処理
  if (filterMode === 'mistakes') {
    // 間違えた回数が多い順 (同点は直近ミスが新しい順)
    candidateAggs.sort((a, b) => {
      if (b.mistakeCount !== a.mistakeCount) return b.mistakeCount - a.mistakeCount;
      return (b.lastWrongAt || '').localeCompare(a.lastWrongAt || '');
    });
  } else if (filterMode === 'recent') {
    // 最後に間違えた日時が新しい順
    candidateAggs.sort((a, b) => (b.lastWrongAt || '').localeCompare(a.lastWrongAt || ''));
  } else {
    // すべての苦手単語: 正答率が低い順 (苦手順)
    candidateAggs.sort((a, b) => {
      const accA = a.totalAttempts > 0 ? (a.correctCount / a.totalAttempts) * 100 : 0;
      const accB = b.totalAttempts > 0 ? (b.correctCount / b.totalAttempts) * 100 : 0;
      if (accA !== accB) return accA - accB;
      return b.mistakeCount - a.mistakeCount;
    });
  }

  // 5. 必要な単語のみを words テーブルから抽出 (全件取得を完全回避)
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
`;

writeFile('lib/weakness/getWeakWords.ts', getWeakWordsTs);

// -----------------------------------------------------------------------------
// 2. components/weakness/DrillFilterDialog.tsx (復習モード選択モーダル)
// -----------------------------------------------------------------------------
const drillFilterDialogTsx = `'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Clock, Layers, X, Play } from 'lucide-react';

interface DrillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  originAssignmentId?: string; // チャンク指定の場合
}

export function DrillFilterDialog({
  isOpen,
  onClose,
  title,
  originAssignmentId,
}: DrillFilterDialogProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<'all' | 'mistakes' | 'recent'>('all');
  const [limit, setLimit] = useState<number>(10);
  const [days, setDays] = useState<number>(7);

  if (!isOpen) return null;

  const handleStart = () => {
    let url = '/test?mode=normal';
    if (originAssignmentId) {
      url += \`&originAssignmentId=\${encodeURIComponent(originAssignmentId)}\`;
    } else {
      url += '&weak=true';
    }

    url += \`&filter=\${filterMode}\`;
    if (filterMode !== 'all') {
      url += \`&limit=\${limit}\`;
    }
    if (filterMode === 'recent') {
      url += \`&days=\${days}\`;
    }

    onClose();
    router.push(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-5 text-left animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between border-b border-line/60 pb-3">
          <div>
            <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
              WEAKNESS DRILL
            </span>
            <h3 className="font-mincho text-lg font-bold text-ink">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. モード選択 */}
        <div className="space-y-2">
          <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
            絞り込みモードを選択
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={\`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 \${
                filterMode === 'all'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }\`}
            >
              <Layers className="h-4 w-4" />
              <span className="font-maru text-xs">すべて</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('mistakes')}
              className={\`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 \${
                filterMode === 'mistakes'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }\`}
            >
              <Flame className="h-4 w-4 text-akashiito" />
              <span className="font-maru text-xs">ミス多順</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('recent')}
              className={\`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 \${
                filterMode === 'recent'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }\`}
            >
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-maru text-xs">直近ミス</span>
            </button>
          </div>
        </div>

        {/* 2. 出題数選択 (ミス多順 または 直近ミス選択時) */}
        {filterMode !== 'all' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              出題する単語数
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setLimit(count)}
                  className={\`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 \${
                    limit === count
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }\`}
                >
                  {count} 語
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. 期間選択 (直近ミス選択時のみ) */}
        {filterMode === 'recent' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              間違えた対象期間
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '直近 3 日以内', value: 3 },
                { label: '直近 7 日以内', value: 7 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDays(item.value)}
                  className={\`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 \${
                    days === item.value
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }\`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 開始ボタン */}
        <button
          type="button"
          onClick={handleStart}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-98 hover:bg-ink/90 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-paper" />
          <span>
            {filterMode === 'all'
              ? 'すべての苦手単語でスタート'
              : \`\${filterMode === 'mistakes' ? 'ミスが多い順に' : '直近で間違えた単語を'} \${limit}語 特訓する\`}
          </span>
        </button>
      </div>
    </div>
  );
}
`;

writeFile('components/weakness/DrillFilterDialog.tsx', drillFilterDialogTsx);

// -----------------------------------------------------------------------------
// 3. components/weakness/WeaknessMapClient.tsx (全体の苦手克服テストに絞り込みモーダルを導入)
// -----------------------------------------------------------------------------
const weaknessMapClientTsx = `'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';
import { WeaknessChunkTile } from './WeaknessChunkTile';
import { WeaknessBottomSheet } from './WeaknessBottomSheet';
import { DrillFilterDialog } from './DrillFilterDialog';

interface WeaknessMapClientProps {
  chunks: ChunkStat[];
  wordbookName: string;
}

export function WeaknessMapClient({ chunks, wordbookName }: WeaknessMapClientProps) {
  const [selectedChunk, setSelectedChunk] = useState<ChunkStat | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const totalChunks = chunks.length;
  const attentionCount = chunks.filter((c) => c.needsAttention).length;
  const totalMistakes = chunks.reduce((acc, c) => acc + c.mistakeWords.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">弱点マップ</h1>
            <p className="font-maru text-xs md:text-sm text-ink/50 mt-0.5">
              {wordbookName || '単語帳'} の進度と定着傾向
            </p>
          </div>
        </div>
      </div>

      {/* 3つの統計サマリーカード */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">総学習範囲</span>
          <span className="font-mincho text-xl font-bold text-ink">{totalChunks}</span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">チャンク</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">要注意範囲</span>
          <span className={\`font-mincho text-xl font-bold \${attentionCount > 0 ? 'text-akashiito' : 'text-ink'}\`}>
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

      {/* タイル一覧 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">学習範囲タイル一覧</h2>
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

      {/* 苦手克服テスト開始ボタン */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setIsFilterDialogOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>単語帳全体の苦手克服テストを始める</span>
        </button>
      </div>

      {/* 詳細ボトムシート */}
      <WeaknessBottomSheet
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />

      {/* 全体用絞り込みダイアログ */}
      <DrillFilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        title="単語帳全体の苦手克服テスト"
      />
    </div>
  );
}
`;

writeFile('components/weakness/WeaknessMapClient.tsx', weaknessMapClientTsx);

// -----------------------------------------------------------------------------
// 4. components/weakness/WeaknessBottomSheet.tsx (チャンクミニテストにも絞り込みを導入)
// -----------------------------------------------------------------------------
const weaknessBottomSheetTsx = `'use client';

import React, { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChunkStat, ChunkHistoryPoint } from '@/lib/weakness/computeChunkStats';
import { DrillFilterDialog } from './DrillFilterDialog';
import { SlidersHorizontal } from 'lucide-react';

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
  const [isDrillDialogOpen, setIsDrillDialogOpen] = useState(false);
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
    <>
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

            {/* グラフ1: 範囲全体テスト */}
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

            {/* グラフ2: 苦手克服テスト */}
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
            <button
              type="button"
              onClick={() => setIsDrillDialogOpen(true)}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>この範囲の苦手克服テストを行う</span>
            </button>
          </div>
        </div>
      </div>

      {/* チャンク用絞り込みダイアログ */}
      <DrillFilterDialog
        isOpen={isDrillDialogOpen}
        onClose={() => setIsDrillDialogOpen(false)}
        title={\`No.\${chunk.rangeStart}〜\${chunk.rangeEnd} の苦手克服\`}
        originAssignmentId={chunk.chunkId}
      />
    </>
  );
}
`;

writeFile('components/weakness/WeaknessBottomSheet.tsx', weaknessBottomSheetTsx);

// -----------------------------------------------------------------------------
// 5. app/(main)/test/page.tsx (filter, limit, days パラメータの受け取り)
// -----------------------------------------------------------------------------
const testPageTsx = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { getTodayTestContext } from '@/lib/test/getTodayTestWords';
import { getWeakWords } from '@/lib/weakness/getWeakWords';
import { TestSessionRunner } from '@/components/test/TestSessionRunner';
import { CheckCircle2 } from 'lucide-react';

interface TestPageProps {
  searchParams: Promise<{
    mode?: string;
    originAssignmentId?: string;
    weak?: string;
    filter?: 'all' | 'mistakes' | 'recent';
    limit?: string;
    days?: string;
  }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const params = await searchParams;
  const sessionType = params.mode === 'daily_check' ? 'daily_check' : 'normal';

  const filterMode = params.filter || 'all';
  const filterLimit = params.limit ? Number(params.limit) : undefined;
  const filterDays = params.days ? Number(params.days) : undefined;

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
      filterMode,
      limit: filterLimit,
      days: filterDays,
    });

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">条件に該当する苦手な単語はありません！</p>
          <p className="font-maru text-xs text-ink/60">しっかり定着しています。次の学習に進みましょう。</p>
          <Link
            href="/weakness"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
          >
            弱点マップへ戻る
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
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
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id, {
      filterMode,
      limit: filterLimit,
      days: filterDays,
    });

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">条件に該当する苦手な単語はありません！</p>
          <p className="font-maru text-xs text-ink/60">日々の学習が成果に繋がっています。</p>
          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
          >
            ダッシュボードへ戻る
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={null}
          sessionType="normal"
          isReviewDay={false}
        />
      </main>
    );
  }

  const today = getTodayJST();

  // 3. 本番デイリーチェックの完了済み重複受験ガード
  if (sessionType === 'daily_check') {
    const { data: existingSession } = await supabase
      .from('test_sessions')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'daily_check')
      .maybeSingle();

    if (existingSession && existingSession.completed_at) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-mincho text-xl font-bold text-ink">本日の本番チェックは受験済みです</h1>
            <p className="mt-2 font-maru text-xs text-ink/60 leading-relaxed max-w-xs">
              本番チェックは1日1回のみ記録されます。<br />
              練習テスト（スコア記録なし）は何度でも受けることができます。
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full max-w-xs pt-3">
            <Link
              href="/test?mode=normal"
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98"
            >
              練習テストを受ける
            </Link>
            <Link
              href="/dashboard"
              className="flex min-h-[44px] items-center justify-center rounded-2xl border border-line bg-white font-maru text-xs font-bold text-ink transition active:scale-98"
            >
              ダッシュボードへ戻る
            </Link>
          </div>
        </main>
      );
    }
  }

  // 4. 今日のテスト単語コンテキスト取得
  const context = await getTodayTestContext(supabase, user.id, today);

  if (!context || context.cards.length === 0) {
    return (
      <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-mincho text-lg text-ink">今日のテストはありません</p>
        <p className="font-maru text-xs text-ink/60">範囲が未設定か、今日はお休みです</p>
        <Link
          href="/dashboard"
          className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
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
`;

writeFile('app/(main)/test/page.tsx', testPageTsx);

console.log('\n================================================================');
console.log('✅ フェーズF-3: 復習絞り込みモードの更新が完了しました！');
console.log('================================================================\n');