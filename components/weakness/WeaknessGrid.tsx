'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';
import { buildWeaknessGrid, type WeekColumnData } from '@/lib/weakness/buildWeaknessGrid';
import { DrillFilterDialog } from './DrillFilterDialog';
import { Navigation, Flame, CheckCircle2 } from 'lucide-react';

interface WeaknessGridProps {
  chunks: ChunkStat[];
  todayJst: string;
  onSelectChunk: (chunk: ChunkStat) => void;
}

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split(-).map(Number);
  return `${m}/${d}`;
}

export function WeaknessGrid({ chunks, todayJst, onSelectChunk }: WeaknessGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentWeekColRef = useRef<HTMLDivElement>(null);

  const gridData = React.useMemo(
    () => buildWeaknessGrid(chunks, todayJst),
    [chunks, todayJst]
  );

  const [selectedWeekDrill, setSelectedWeekDrill] = useState<{
    title: string;
    rangeStart: number;
    rangeEnd: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentWeekColRef.current && scrollContainerRef.current) {
      currentWeekColRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, []);

  const scrollToCurrentWeek = () => {
    if (currentWeekColRef.current) {
      currentWeekColRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  };

  const handleWeekHeaderClick = (col: WeekColumnData) => {
    if (col.totalChunks === 0) return;

    if (col.totalMistakes === 0) {
      setToastMessage(`この週（No.${col.minRangeStart}〜${col.maxRangeEnd}）に苦手な単語はありません 🎉`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (col.minRangeStart !== null && col.maxRangeEnd !== null) {
      setSelectedWeekDrill({
        title: `No.${col.minRangeStart}〜${col.maxRangeEnd} (${formatDateShort(col.weekStartDate)}週) の苦手克服`,
        rangeStart: col.minRangeStart,
        rangeEnd: col.maxRangeEnd,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-mincho text-xs md:text-sm font-bold text-ink/70">
            週間進度・定着グリッド
          </span>
          <span className="font-maru text-[10px] text-ink/40">
            ← 横スクロールで閲覧 →
          </span>
        </div>
        <button
          type="button"
          onClick={scrollToCurrentWeek}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 font-maru text-xs font-bold text-ink/70 shadow-2xs transition active:scale-95 hover:text-ink cursor-pointer"
        >
          <Navigation className="h-3 w-3 text-akashiito" />
          <span>今週へ</span>
        </button>
      </div>

      <div className="relative rounded-3xl border border-line bg-paper/60 p-3 shadow-xs overflow-hidden">
        <div className="flex items-start">
          <div className="sticky left-0 z-20 flex flex-col shrink-0 bg-paper/95 backdrop-blur-xs pr-2 pt-[74px] space-y-2 border-r border-line/60">
            {DAY_LABELS.map((dayLabel) => (
              <div
                key={dayLabel}
                className="flex h-[72px] w-7 items-center justify-center rounded-xl bg-white/70 border border-line/50 font-maru text-xs font-bold text-ink/60"
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto scroll-smooth pl-3 pr-4 pb-2"
          >
            <div className="flex gap-3 min-w-max">
              {gridData.map((col) => {
                const isCurrent = col.isCurrentWeek;

                return (
                  <div
                    key={col.weekStartDate}
                    ref={isCurrent ? currentWeekColRef : null}
                    className={`flex flex-col w-[140px] shrink-0 rounded-2xl p-2 transition ${
                      isCurrent
                        ? 'bg-amber-50/60 border-2 border-amber-300 ring-2 ring-amber-300/30'
                        : 'bg-white/50 border border-line/60'
                    }`}
                  >
                    <div
                      onClick={() => handleWeekHeaderClick(col)}
                      className={`h-[58px] rounded-xl p-2 flex flex-col justify-between transition cursor-pointer active:scale-98 ${
                        col.totalChunks > 0
                          ? 'bg-white border border-line/80 hover:bg-paper hover:border-ink/40 shadow-2xs'
                          : 'bg-transparent border border-dashed border-line/40 cursor-default'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-maru text-[10px] font-bold text-ink/70">
                          {formatDateShort(col.weekStartDate)}〜
                        </span>
                        {col.monthLabel && (
                          <span className="rounded-sm bg-ink text-paper px-1 py-0.2 font-maru text-[9px] font-bold">
                            {col.monthLabel}
                          </span>
                        )}
                      </div>

                      {col.totalChunks > 0 ? (
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="font-maru text-[10px] font-bold text-ink/50">
                            平均 {col.avgAccuracyRate ?? '—'}%
                          </span>
                          {col.totalMistakes > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-akashiito font-maru text-[10px] font-bold">
                              <Flame className="h-2.5 w-2.5 fill-akashiito" />
                              <span>{col.totalMistakes}語</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-maru text-[9px] font-bold">
                              良好 ✓
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-maru text-[10px] text-ink/30 text-center">
                          未設定
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 pt-2">
                      {col.days.map((cell) => {
                        const chunk = cell.chunk;

                        if (!chunk) {
                          return (
                            <div
                              key={cell.date}
                              className="flex h-[72px] w-full items-center justify-center rounded-xl border border-dashed border-line/40 bg-line/10 text-ink/20 font-mono text-xs"
                            >
                              —
                            </div>
                          );
                        }

                        const accuracy = chunk.accuracyRate;
                        const isAttention = chunk.needsAttention;

                        let tileStyle = 'border-line bg-white hover:bg-paper';
                        let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        let badgeText = `${accuracy}%`;

                        if (chunk.totalAttempts === 0) {
                          tileStyle = 'border-line/60 bg-paper/60 text-ink/40';
                          badgeStyle = 'bg-line/30 text-ink/40 border-line/40';
                          badgeText = '未';
                        } else if (accuracy < 60) {
                          tileStyle = 'border-akashiito-border bg-akashiito/10 shadow-2xs';
                          badgeStyle = 'bg-akashiito text-white font-bold';
                        } else if (accuracy < 80) {
                          tileStyle = 'border-amber-300 bg-amber-50/50';
                          badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                        }

                        return (
                          <div
                            key={chunk.chunkId}
                            onClick={() => onSelectChunk(chunk)}
                            className={`flex h-[72px] w-full flex-col justify-between rounded-xl border p-2 text-left transition cursor-pointer active:scale-95 shadow-2xs ${tileStyle}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-ink/50 font-bold">
                                {formatDateShort(cell.date)}
                              </span>
                              <span className={`rounded-full border px-1.5 py-0.2 font-number text-[9px] ${badgeStyle}`}>
                                {badgeText}
                              </span>
                            </div>

                            <div>
                              <p className="font-mincho text-[11px] font-bold text-ink truncate">
                                No.{chunk.rangeStart}〜{chunk.rangeEnd}
                              </p>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="font-maru text-[9px] text-ink/40">
                                  {chunk.mistakeWords.length > 0
                                    ? `苦手 ${chunk.mistakeWords.length}語`
                                    : 'ミスなし'}
                                </span>
                                {isAttention && (
                                  <span className="rounded-full bg-akashiito/15 text-akashiito text-[8px] font-bold px-1">
                                    注意
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl bg-ink text-paper p-3 text-center shadow-lg font-maru text-xs font-bold animate-in fade-in duration-150 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {selectedWeekDrill && (
        <DrillFilterDialog
          isOpen={!!selectedWeekDrill}
          onClose={() => setSelectedWeekDrill(null)}
          title={selectedWeekDrill.title}
          rangeStart={selectedWeekDrill.rangeStart}
          rangeEnd={selectedWeekDrill.rangeEnd}
        />
      )}
    </div>
  );
}
