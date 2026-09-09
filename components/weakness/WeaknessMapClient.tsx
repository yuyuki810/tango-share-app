'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';
import { WeaknessGrid } from './WeaknessGrid';
import { WeaknessBottomSheet } from './WeaknessBottomSheet';
import { DrillFilterDialog } from './DrillFilterDialog';

interface WeaknessMapClientProps {
  chunks: ChunkStat[];
  wordbookName: string;
  todayJst: string;
}

export function WeaknessMapClient({ chunks, wordbookName, todayJst }: WeaknessMapClientProps) {
  const [selectedChunk, setSelectedChunk] = useState<ChunkStat | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const totalChunks = chunks.length;
  const attentionCount = chunks.filter((c) => c.needsAttention).length;
  const totalMistakes = chunks.reduce((acc, c) => acc + c.mistakeWords.length, 0);

  return (
    <div className="space-y-6 pb-6">
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
              {wordbookName || '単語帳'} の週ごとの進度と定着傾向
            </p>
          </div>
        </div>
      </div>

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

      <section className="space-y-2">
        <WeaknessGrid
          chunks={chunks}
          todayJst={todayJst}
          onSelectChunk={setSelectedChunk}
        />
      </section>

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

      <WeaknessBottomSheet
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />

      <DrillFilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        title="単語帳全体の苦手克服テスト"
      />
    </div>
  );
}
