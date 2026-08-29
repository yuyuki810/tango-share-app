'use client';

import { useState } from 'react';
import { WeeklyRangeModal } from '@/components/weekly-range/WeeklyRangeModal';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import type { LastWeekData } from '@/components/weekly-range/CycleSettingsPanel';

interface SetRangeCTAProps {
  wordbookId: string;
  wordbookTotalWords: number;
  weekStartDate: string;
  hasExistingRange: boolean;
  initialCycleType?: CycleType;
  initialCustomDayTypes?: DayType[];
  initialRangeStart?: number;
  initialPerDayCount?: number;
  lastWeek?: LastWeekData;
}

export function SetRangeCTA({
  wordbookId,
  wordbookTotalWords,
  weekStartDate,
  hasExistingRange,
  initialCycleType,
  initialCustomDayTypes,
  initialRangeStart,
  initialPerDayCount,
  lastWeek,
}: SetRangeCTAProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {hasExistingRange ? (
        <div className="flex items-center justify-between px-1">
          <span className="font-maru text-xs font-medium text-ink/60">今週の学習サイクル (土〜金)</span>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="min-h-[44px] text-xs font-bold text-ink/80 underline decoration-line underline-offset-4 transition hover:text-ink active:opacity-70"
          >
            範囲・ペースを変更する
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full min-h-[56px] rounded-3xl bg-akashiito px-5 py-4 text-center font-mincho text-base font-bold text-paper shadow-lg shadow-akashiito/20 transition active:scale-98"
        >
          今週の学習範囲を設定しよう（土〜金）
        </button>
      )}

      <WeeklyRangeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        wordbookId={wordbookId}
        wordbookTotalWords={wordbookTotalWords}
        weekStartDate={weekStartDate}
        initialCycleType={initialCycleType}
        initialCustomDayTypes={initialCustomDayTypes}
        initialRangeStart={initialRangeStart}
        initialPerDayCount={initialPerDayCount}
        lastWeek={lastWeek}
      />
    </>
  );
}
