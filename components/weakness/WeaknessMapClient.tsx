"use client";

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

      <div className="pt-2">
        <Link
          href="/test?mode=normal&weak=true"
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
        >
          単語帳全体の苦手克服テストを始める
        </Link>
      </div>

      <WeaknessBottomSheet
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />
    </div>
  );
}
