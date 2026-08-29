'use client';

import { useMemo, useState, useRef, useTransition, type PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import { calculateWeeklyPreview } from '@/lib/assignment/calculateWeeklyPreview';
import { CycleSettingsPanel, type LastWeekData } from './CycleSettingsPanel';
import { WeeklyPreviewPanel } from './WeeklyPreviewPanel';

const DEFAULT_CUSTOM_DAY_TYPES: DayType[] = ['new', 'new', 'new', 'new', 'new', 'review', 'review'];
const DRAG_CLOSE_THRESHOLD = 80;

interface WeeklyRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordbookId: string;
  wordbookTotalWords: number;
  weekStartDate: string; // 今週の土曜日 YYYY-MM-DD
  initialCycleType?: CycleType;
  initialCustomDayTypes?: DayType[];
  initialRangeStart?: number;
  initialPerDayCount?: number;
  lastWeek?: LastWeekData;
}

export function WeeklyRangeModal({
  isOpen,
  onClose,
  wordbookId,
  wordbookTotalWords,
  weekStartDate,
  initialCycleType,
  initialCustomDayTypes,
  initialRangeStart,
  initialPerDayCount,
  lastWeek,
}: WeeklyRangeModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  const [cycleType, setCycleType] = useState<CycleType>(initialCycleType ?? 'five_two');
  const [customDayTypes, setCustomDayTypes] = useState<DayType[]>(
    initialCustomDayTypes ?? DEFAULT_CUSTOM_DAY_TYPES
  );
  const [rangeStart, setRangeStart] = useState<number>(initialRangeStart ?? 1);
  const [perDayCount, setPerDayCount] = useState<number>(initialPerDayCount ?? 20);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const preview = useMemo(
    () =>
      calculateWeeklyPreview({
        weekStartDate,
        rangeStart,
        perDayCount,
        cycleType,
        customDayTypes,
        wordbookTotalWords,
      }),
    [weekStartDate, rangeStart, perDayCount, cycleType, customDayTypes, wordbookTotalWords]
  );

  if (!isOpen) return null;

  const overflowMessage = `⚠️ 単語帳の最大No.(${wordbookTotalWords})を超えています(No.${preview.calculatedEnd}まで到達予定)。1日の単語数または開始No.を調整してください`;

  const handleUseLastWeekSame = () => {
    if (!lastWeek) return;
    setCycleType(lastWeek.cycleType);
    if (lastWeek.customDayTypes) setCustomDayTypes(lastWeek.customDayTypes);
    setRangeStart(lastWeek.rangeStart);
    setPerDayCount(lastWeek.perDayCount);
  };

  const handleUseLastWeekContinue = () => {
    if (!lastWeek) return;
    setCycleType(lastWeek.cycleType);
    if (lastWeek.customDayTypes) setCustomDayTypes(lastWeek.customDayTypes);
    setRangeStart(lastWeek.rangeEnd + 1);
    setPerDayCount(lastWeek.perDayCount);
  };

  const handleSubmit = async () => {
    setError(null);
    if (rangeStart < 1 || perDayCount < 1) {
      setError('開始No.・1日の単語数は1以上で入力してください');
      return;
    }
    if (preview.isOverflow) {
      setError(overflowMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/weekly-ranges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbookId,
          weekStartDate,
          rangeStart,
          perDayCount,
          cycleType,
          customDayTypes: cycleType === 'custom' ? customDayTypes : undefined,
        }),
      });
      if (!res.ok) {
        const resBody = await res.json();
        setError(resBody.error ?? '保存に失敗しました');
        return;
      }
      onClose();
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-xs transition-opacity" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `translateY(${dragY}px)` }}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper shadow-2xl transition-transform duration-200 motion-reduce:transition-none"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="sticky top-0 z-10 flex touch-none flex-col items-center bg-paper/95 px-4 pb-2 pt-3 backdrop-blur-xs"
        >
          <div className="h-1.5 w-12 rounded-full bg-line" />
          <div className="mt-2 flex w-full items-center justify-between">
            <h2 className="font-mincho text-lg font-bold text-ink">今週の学習範囲・ペース</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center font-bold text-ink/40 hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition ${
              activeTab === 'settings' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
            }`}
          >
            ⚙️ ペース設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition ${
              activeTab === 'preview' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
            }`}
          >
            📅 毎日の割当プレビュー
          </button>
        </div>

        <div className="px-4 py-4">
          {activeTab === 'settings' ? (
            <CycleSettingsPanel
              cycleType={cycleType}
              onChangeCycleType={setCycleType}
              customDayTypes={customDayTypes}
              onChangeCustomDayTypes={setCustomDayTypes}
              rangeStart={rangeStart}
              onChangeRangeStart={setRangeStart}
              perDayCount={perDayCount}
              onChangePerDayCount={setPerDayCount}
              isOverflow={preview.isOverflow}
              overflowMessage={overflowMessage}
              lastWeek={lastWeek}
              onUseLastWeekSame={handleUseLastWeekSame}
              onUseLastWeekContinue={handleUseLastWeekContinue}
            />
          ) : (
            <WeeklyPreviewPanel days={preview.days} />
          )}
        </div>

        {error && (
          <p className="mx-4 mb-3 rounded-xl border border-akashiito bg-akashiito/10 p-3 font-maru text-xs text-akashiito">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 border-t border-line/80 bg-paper/95 px-4 py-3.5 backdrop-blur-xs">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || preview.isOverflow}
            className="min-h-[50px] w-full rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-98 disabled:opacity-40"
          >
            {isSubmitting ? '保存中…' : `保存してスケジュールを確定 (No.${rangeStart}〜No.${preview.calculatedEnd})`}
          </button>
        </div>
      </div>
    </div>
  );
}
