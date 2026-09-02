'use client';

import React, { useState } from 'react';
import { Info, X, Flame } from 'lucide-react';
import type { ArchetypeResult } from '@/lib/scoring/determineArchetype';

interface ArchetypeBadgeProps {
  archetype: ArchetypeResult | null;
  attendanceStreak: number | null;
}

export function ArchetypeBadge({ archetype, attendanceStreak }: ArchetypeBadgeProps) {
  const [activeModal, setActiveModal] = useState<{
    title: string;
    description: string;
    subtitle?: string;
  } | null>(null);

  const showAttendance =
    attendanceStreak !== null && attendanceStreak > 0 && attendanceStreak % 7 === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {/* 1. スコア系アーキタイプバッジ */}
        {archetype ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: archetype.title,
                subtitle: archetype.badgeLabel,
                description: archetype.message,
              });
            }}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-maru text-[10px] font-bold transition active:scale-95 cursor-pointer shadow-2xs hover:opacity-90 ${archetype.colorClass}`}
          >
            <span>{archetype.badgeLabel}</span>
            <span className="text-[9px] opacity-70">?</span>
          </button>
        ) : (
          /* 2. フォールバック表示 (アーキタイプ非該当時は ⓘ アイコン) */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: '獲得スコアについて',
                description:
                  'スコアは正答率とは少し違う指標です。まだ自信のない単語に正解するほど配点が高く、よく知っている単語は配点が低くなります。解いた数が多いほど積み上がりますが、1日20問を超えると増分はゆるやかになります。',
              });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/80 px-2 py-0.5 font-maru text-[10px] font-medium text-ink/60 transition active:scale-95 cursor-pointer hover:bg-paper hover:text-ink"
            aria-label="スコアの仕組みを見る"
          >
            <Info className="h-3 w-3 text-ink/40" />
            <span>スコアの仕組み</span>
          </button>
        )}

        {/* 3. 皆勤賞バッジ (スコア系とは独立) */}
        {showAttendance && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: `${attendanceStreak}日連続 皆勤賞`,
                subtitle: 'DAILY ATTENDANCE',
                description: `${attendanceStreak}日連続で本番チェックを継続中！日々の積み重ねが確実に力になっています。`,
              });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-maru text-[10px] font-bold text-amber-900 shadow-2xs transition active:scale-95 cursor-pointer hover:opacity-90"
          >
            <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span>{attendanceStreak}日皆勤</span>
          </button>
        )}
      </div>

      {/* ポップアップモーダル */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-line bg-white p-5 shadow-xl animate-in zoom-in-95 duration-150 space-y-3 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                {activeModal.subtitle && (
                  <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
                    {activeModal.subtitle}
                  </span>
                )}
                <h3 className="font-mincho text-base font-bold text-ink">
                  {activeModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/80 leading-relaxed bg-paper/60 p-3.5 rounded-2xl border border-line/60">
              {activeModal.description}
            </p>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="flex min-h-[42px] w-full items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
