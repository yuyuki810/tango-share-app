"use client";

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
  return `${m}/${d}`;
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
                  className={`flex items-center justify-between rounded-2xl border p-3.5 transition ${
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
