'use client';

import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import { DaySequenceEditor } from './DaySequenceEditor';

const START_QUICK_ADDS = [10, 50, 100];
const PER_DAY_CHIPS = [10, 15, 20, 25, 30, 50];

export interface LastWeekData {
  rangeStart: number;
  rangeEnd: number;
  perDayCount: number;
  cycleType: CycleType;
  customDayTypes?: DayType[];
}

interface CycleSettingsPanelProps {
  cycleType: CycleType;
  onChangeCycleType: (t: CycleType) => void;
  customDayTypes: DayType[];
  onChangeCustomDayTypes: (t: DayType[]) => void;
  rangeStart: number;
  onChangeRangeStart: (n: number) => void;
  perDayCount: number;
  onChangePerDayCount: (n: number) => void;
  isOverflow: boolean;
  overflowMessage: string;
  lastWeek?: LastWeekData;
  onUseLastWeekSame: () => void;
  onUseLastWeekContinue: () => void;
}

export function CycleSettingsPanel({
  cycleType,
  onChangeCycleType,
  customDayTypes,
  onChangeCustomDayTypes,
  rangeStart,
  onChangeRangeStart,
  perDayCount,
  onChangePerDayCount,
  isOverflow,
  overflowMessage,
  lastWeek,
  onUseLastWeekSame,
  onUseLastWeekContinue,
}: CycleSettingsPanelProps) {
  return (
    <div className="space-y-5">
      {lastWeek && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUseLastWeekContinue}
            className="min-h-[44px] flex-1 rounded-xl border border-line bg-white p-2.5 text-left text-xs font-medium text-ink shadow-sm transition active:scale-98"
          >
            <span className="font-bold text-ink">⚡️ 先週の続きから</span>
            <span className="mt-0.5 block font-maru text-[10px] text-ink/50">No.{lastWeek.rangeEnd + 1}〜 ({lastWeek.perDayCount}語/日)</span>
          </button>
          <button
            type="button"
            onClick={onUseLastWeekSame}
            className="min-h-[44px] flex-1 rounded-xl border border-line bg-white p-2.5 text-left text-xs font-medium text-ink shadow-sm transition active:scale-98"
          >
            <span className="font-bold text-ink">🔄 先週と同じ範囲</span>
            <span className="mt-0.5 block font-maru text-[10px] text-ink/50">No.{lastWeek.rangeStart}〜{lastWeek.rangeEnd}</span>
          </button>
        </div>
      )}

      <div>
        <p className="mb-1.5 font-maru text-xs font-medium text-ink/60">学習サイクル</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'five_two' as const, label: '5進2戻' },
            { value: 'four_three' as const, label: '4進3戻' },
            { value: 'custom' as const, label: 'カスタム' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeCycleType(opt.value)}
              className={`min-h-[44px] rounded-xl border px-2 text-sm transition ${
                cycleType === opt.value
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 active:bg-paper'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {cycleType === 'custom' && (
          <div className="mt-3 rounded-2xl border border-line/60 bg-paper p-3">
            <p className="mb-2 font-maru text-xs text-ink/60">土〜金をタップして 新規 / 復習 / 休み を切り替え</p>
            <DaySequenceEditor value={customDayTypes} onChange={onChangeCustomDayTypes} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 font-maru text-xs font-medium text-ink/60">開始No.</p>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={rangeStart || ''}
          onChange={(e) => onChangeRangeStart(Number(e.target.value))}
          className="min-h-[46px] w-full rounded-xl border border-line bg-white px-3 font-maru text-lg font-bold text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-akashiito"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {START_QUICK_ADDS.map((add) => (
            <button
              key={add}
              type="button"
              onClick={() => onChangeRangeStart(rangeStart + add)}
              className="min-h-[36px] rounded-full border border-line bg-white px-3 text-xs font-medium text-ink/70 shadow-sm transition active:bg-paper"
            >
              +{add}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChangeRangeStart(1)}
            className="min-h-[36px] rounded-full border border-line bg-white px-3 text-xs text-ink/50 shadow-sm transition active:bg-paper"
          >
            1に戻す
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 font-maru text-xs font-medium text-ink/60">1日の単語数</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangePerDayCount(Math.max(1, perDayCount - 5))}
            className="min-h-[46px] min-w-[46px] rounded-xl border border-line bg-white text-lg font-bold text-ink shadow-sm transition active:bg-paper"
            aria-label="5減らす"
          >
            −5
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={perDayCount || ''}
            onChange={(e) => onChangePerDayCount(Math.max(1, Number(e.target.value)))}
            className="min-h-[46px] w-full rounded-xl border border-line bg-white px-3 text-center font-maru text-lg font-bold text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-akashiito"
          />
          <button
            type="button"
            onClick={() => onChangePerDayCount(perDayCount + 5)}
            className="min-h-[46px] min-w-[46px] rounded-xl border border-line bg-white text-lg font-bold text-ink shadow-sm transition active:bg-paper"
            aria-label="5増やす"
          >
            ＋5
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PER_DAY_CHIPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangePerDayCount(n)}
              className={`min-h-[36px] rounded-full border px-3 text-xs transition ${
                perDayCount === n ? 'border-ink bg-ink text-paper font-bold shadow-sm' : 'border-line bg-white text-ink/70 active:bg-paper'
              }`}
            >
              {n}語
            </button>
          ))}
        </div>
      </div>

      {isOverflow && (
        <p className="rounded-xl border border-akashiito bg-akashiito/10 p-3 font-maru text-xs leading-relaxed text-akashiito">
          {overflowMessage}
        </p>
      )}
    </div>
  );
}
