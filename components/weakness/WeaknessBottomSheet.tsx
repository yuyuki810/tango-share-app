'use client';

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
  return `${m}/${d}`;
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
      label = `${baseDate}(${currentOccur})`;
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
          (acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
          ''
        )
      : '';

  return (
    <div className="py-1">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-20 w-full overflow-visible">
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
        style={{ transform: `translateY(${dragY}px)` }}
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
                  {hasAttempts ? `${accuracy}%` : '—'}
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
            href={`/test?mode=normal&originAssignmentId=${chunk.chunkId}`}
            className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
          >
            この範囲の苦手克服ミニテストを行う
          </Link>
        </div>
      </div>
    </div>
  );
}
