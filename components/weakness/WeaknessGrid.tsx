'use client';

import React, { useRef, useEffect, useState } from "react";
import type { ChunkStat } from "@/lib/weakness/computeChunkStats";
import { buildWeaknessGrid, type WeekColumnData } from "@/lib/weakness/buildWeaknessGrid";
import { DrillFilterDialog } from "./DrillFilterDialog";
import { Navigation, Flame, CheckCircle2 } from "lucide-react";

interface WeaknessGridProps {
  chunks: ChunkStat[];
  todayJst: string;
  onSelectChunk: (chunk: ChunkStat) => void;
}

const DAY_LABELS = ["土", "日", "月", "火", "水", "木", "金"];

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
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
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, []);

  const scrollToCurrentWeek = () => {
    if (currentWeekColRef.current) {
      currentWeekColRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
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

  const currentWeekCol = gridData.find((c) => c.isCurrentWeek) || gridData[gridData.length - 1];
  const activeBoundaryIdx = currentWeekCol?.days.findIndex(
    (cell, i) => i > 0 && !currentWeekCol.days[i - 1]?.chunk?.isReviewDay && !!cell.chunk?.isReviewDay
  ) ?? -1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-mincho text-xs md:text-sm font-bold text-ink/70">
            週間進度・定着グリッド
          </span>
          <span className="font-maru text-[10px] text-ink/40">
            ← 横スクロール →
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

      <div className="relative -mx-2 sm:mx-0 rounded-3xl border border-line bg-paper/60 p-2 sm:p-3 shadow-xs overflow-hidden">
        <div className="flex items-start">
          {/* 左側固定の曜日ラベル列 */}
          <div className="sticky left-0 z-20 flex flex-col shrink-0 bg-paper/95 backdrop-blur-xs pr-1 pt-[68px] border-r border-line/60">
            {DAY_LABELS.map((dayLabel, idx) => {
              const isBoundary = activeBoundaryIdx !== -1 && idx === activeBoundaryIdx;
              const isReviewDayOfWeek = activeBoundaryIdx !== -1 && idx >= activeBoundaryIdx;

              return (
                <React.Fragment key={dayLabel}>
                  {isBoundary && (
                    <div className="h-3.5 my-1 flex items-center justify-center">
                      <div className="w-full border-t border-dashed border-orange-300/80" />
                    </div>
                  )}
                  <div className={`flex h-[70px] w-5.5 items-center justify-center rounded-lg border font-maru text-[10px] font-bold mb-1.5 ${
                    isReviewDayOfWeek
                      ? "bg-orange-50/70 border-orange-300/80 text-orange-950/80"
                      : "bg-white/70 border-line/50 text-ink/60"
                  }`}>
                    {dayLabel}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* 横スクロール週カラム領域 */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto scroll-smooth pl-2 pr-3 pb-1"
          >
            <div className="flex gap-2.5 min-w-max">
              {gridData.map((col) => {
                const isCurrent = col.isCurrentWeek;

                const weekBoundaryIdx = col.days.findIndex(
                  (cell, i) => i > 0 && !col.days[i - 1]?.chunk?.isReviewDay && !!cell.chunk?.isReviewDay
                );

                return (
                  <div
                    key={col.weekStartDate}
                    ref={isCurrent ? currentWeekColRef : null}
                    className={`flex flex-col w-[130px] shrink-0 rounded-2xl p-1.5 transition ${
                      isCurrent
                        ? "bg-amber-50/60 border-2 border-amber-300 ring-2 ring-amber-300/30"
                        : "bg-white/50 border border-line/60"
                    }`}
                  >
                    {/* 週ヘッダー */}
                    <div
                      onClick={() => handleWeekHeaderClick(col)}
                      className={`h-[56px] rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer active:scale-98 ${
                        col.totalChunks > 0
                          ? "bg-white border border-line/80 hover:bg-paper hover:border-ink/40 shadow-2xs"
                          : "bg-transparent border border-dashed border-line/40 cursor-default"
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
                            平均 {col.avgAccuracyRate ?? "—"}%
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

                    {/* 7日分のセル (復習日は上品な細枠・薄いオレンジ border border-orange-300) */}
                    <div className="pt-1.5">
                      {col.days.map((cell, idx) => {
                        const chunk = cell.chunk;
                        const isReviewDay = !!chunk?.isReviewDay;

                        const isBoundary =
                          (weekBoundaryIdx !== -1 && idx === weekBoundaryIdx) ||
                          (weekBoundaryIdx === -1 && activeBoundaryIdx !== -1 && idx === activeBoundaryIdx);

                        // 空セル
                        if (!chunk || (chunk.isReviewDay && chunk.totalAttempts === 0)) {
                          return (
                            <React.Fragment key={cell.date}>
                              {isBoundary && (
                                <div className="h-3.5 my-1 flex items-center justify-center">
                                  <div className="w-full border-t border-dashed border-orange-300/80" />
                                </div>
                              )}
                              <div
                                className={`flex h-[70px] w-full items-center justify-center rounded-xl mb-1.5 font-mono text-xs ${
                                  isReviewDay
                                    ? "border border-dashed border-orange-200/90 bg-orange-50/15 text-orange-900/35"
                                    : "border border-dashed border-line/40 bg-line/10 text-ink/20"
                                }`}
                              >
                                <span className="font-maru text-[9px] opacity-70">
                                  {isReviewDay ? "復習日" : "—"}
                                </span>
                              </div>
                            </React.Fragment>
                          );
                        }

                        const accuracy = chunk.accuracyRate;
                        const isAttention = chunk.needsAttention;

                        // 復習日は細い1pxの上品な薄いオレンジ枠線 (border border-orange-300)
                        let tileStyle = "border border-line bg-white hover:bg-paper";
                        let badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
                        let badgeText = `${accuracy}%`;

                        if (isReviewDay) {
                          tileStyle = "border border-orange-300 bg-orange-50/20 hover:bg-orange-50/40 shadow-2xs";
                        }

                        if (chunk.totalAttempts === 0) {
                          tileStyle = isReviewDay
                            ? "border border-dashed border-orange-300/80 bg-orange-50/15 text-orange-950/40"
                            : "border border-line/60 bg-paper/60 text-ink/40";
                          badgeStyle = "bg-line/30 text-ink/40 border-line/40";
                          badgeText = "未";
                        } else if (accuracy < 60) {
                          tileStyle = isReviewDay
                            ? "border border-orange-400 bg-akashiito/10 shadow-2xs ring-1 ring-akashiito/20"
                            : "border border-akashiito-border bg-akashiito/10 shadow-2xs";
                          badgeStyle = "bg-akashiito text-white font-bold";
                        } else if (accuracy < 80) {
                          tileStyle = isReviewDay
                            ? "border border-orange-300 bg-amber-50/40 shadow-2xs"
                            : "border border-amber-300 bg-amber-50/50";
                          badgeStyle = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
                        }

                        return (
                          <React.Fragment key={chunk.chunkId}>
                            {isBoundary && (
                              <div className="h-3.5 my-1 flex items-center justify-center">
                                <div className="w-full border-t border-dashed border-orange-300/80" />
                              </div>
                            )}
                            <div
                              onClick={() => onSelectChunk(chunk)}
                              className={`flex h-[70px] w-full flex-col justify-between rounded-xl p-1.5 text-left transition cursor-pointer active:scale-95 shadow-2xs mb-1.5 ${tileStyle}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[9px] text-ink/50 font-bold">
                                  {formatDateShort(cell.date)}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isReviewDay && (
                                    <span className="rounded-xs bg-orange-50 border border-orange-300 text-orange-900/90 px-1 py-0.1 font-maru text-[8px] font-bold">
                                      復習
                                    </span>
                                  )}
                                  <span className={`rounded-full border px-1.5 py-0.2 font-number text-[9px] ${badgeStyle}`}>
                                    {badgeText}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <p className="font-mincho text-[10px] font-bold text-ink truncate">
                                  {isReviewDay ? `総復習 (No.${chunk.rangeStart}〜${chunk.rangeEnd})` : `No.${chunk.rangeStart}〜${chunk.rangeEnd}`}
                                </p>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="font-maru text-[9px] text-ink/40">
                                    {chunk.mistakeWords.length > 0
                                      ? `苦手 ${chunk.mistakeWords.length}語`
                                      : "ミスなし"}
                                  </span>
                                  {isAttention && (
                                    <span className="rounded-full bg-akashiito/15 text-akashiito text-[8px] font-bold px-1">
                                      注意
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
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
