/**
 * setup_phase2_v2.js
 * 
 * 最新指示書準拠: WeeklyRangeModal UI/UX刷新 + 共通計算ロジック + ダッシュボード完全連動
 */

const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trimStart(), 'utf8');
  console.log(`  [CREATED/UPDATED] ${filePath}`);
}

console.log('🚀 最新仕様のフェーズ2ファイル生成を開始します...\n');

// 1. lib/assignment/cycleTypes.ts
writeFile(
  'lib/assignment/cycleTypes.ts',
  `export type DayType = 'new' | 'review' | 'off';
export type CycleType = 'five_two' | 'four_three' | 'custom';

// 曜日順は 土,日,月,火,水,木,金 固定
export const CYCLE_DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'] as const;

const FIVE_TWO: DayType[] = ['new', 'new', 'new', 'new', 'new', 'review', 'review'];
const FOUR_THREE: DayType[] = ['new', 'new', 'new', 'new', 'review', 'review', 'review'];

export function resolveDayTypes(cycleType: CycleType, customDayTypes?: DayType[]): DayType[] {
  if (cycleType === 'five_two') return FIVE_TWO;
  if (cycleType === 'four_three') return FOUR_THREE;
  if (cycleType === 'custom') {
    if (!customDayTypes || customDayTypes.length !== 7) {
      throw new Error('カスタムサイクルには7日分の設定が必要です');
    }
    return customDayTypes;
  }
  throw new Error(\`不明な cycleType: \${cycleType}\`);
}
`
);

// 2. lib/assignment/weekDates.ts
writeFile(
  'lib/assignment/weekDates.ts',
  `/**
 * 日本時間(Asia/Tokyo)基準の日付計算ユーティリティ
 * 週のサイクルは「土曜日始まり・金曜日終わり」の7日間
 */

export function getTodayJST(): string {
  const now = new Date();
  return now.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 指定日(YYYY-MM-DD)が属する「土曜始まりの週」の土曜日の日付を返す
 */
export function getSaturdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0=日, 1=月, ..., 6=土
  date.setUTCDate(date.getUTCDate() - ((dayOfWeek + 1) % 7));
  return date.toISOString().slice(0, 10);
}

export function getThisWeekSaturdayJST(): string {
  return getSaturdayOf(getTodayJST());
}

/** 指定土曜日の1週間前(-7日)の土曜日を返す */
export function getPreviousSaturday(saturdayStr: string): string {
  const [y, m, d] = saturdayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** 土曜日から金曜日までの7日分の日付配列(YYYY-MM-DD)を返す */
export function getWeekDates(saturdayStr: string): string[] {
  const [y, m, d] = saturdayStr.split('-').map(Number);
  const saturday = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(saturday);
    dt.setUTCDate(saturday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}
`
);

// 3. lib/assignment/calculateWeeklyPreview.ts
writeFile(
  'lib/assignment/calculateWeeklyPreview.ts',
  `import { resolveDayTypes, CYCLE_DAY_LABELS, type CycleType, type DayType } from './cycleTypes';

export interface PreviewDay {
  date: string; // YYYY-MM-DD
  dayLabel: string; // '土' など
  type: DayType;
  rangeStart: number | null;
  rangeEnd: number | null;
}

export interface WeeklyPreviewResult {
  days: PreviewDay[];
  newDaysCount: number;
  totalNewWords: number;
  calculatedEnd: number;
  isOverflow: boolean;
}

function getCycleWeekDates(weekStartDateSaturday: string): string[] {
  const [y, m, d] = weekStartDateSaturday.split('-').map(Number);
  const saturday = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(saturday);
    dt.setUTCDate(saturday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

export function calculateWeeklyPreview(params: {
  weekStartDate: string; // 今週の土曜日
  rangeStart: number;
  perDayCount: number;
  cycleType: CycleType;
  customDayTypes?: DayType[];
  wordbookTotalWords: number;
}): WeeklyPreviewResult {
  const { weekStartDate, rangeStart, perDayCount, cycleType, customDayTypes, wordbookTotalWords } =
    params;
  const dayTypes = resolveDayTypes(cycleType, customDayTypes);
  const weekDates = getCycleWeekDates(weekStartDate);

  const newDaysCount = dayTypes.filter((t) => t === 'new').length;
  const totalNewWords = newDaysCount * perDayCount;
  const calculatedEnd = rangeStart + totalNewWords - 1;

  const days: PreviewDay[] = [];
  let cursor = rangeStart;

  dayTypes.forEach((type, i) => {
    if (type === 'new') {
      const start = cursor;
      const end = cursor + perDayCount - 1;
      days.push({ date: weekDates[i], dayLabel: CYCLE_DAY_LABELS[i], type, rangeStart: start, rangeEnd: end });
      cursor = end + 1;
    } else if (type === 'review') {
      days.push({
        date: weekDates[i],
        dayLabel: CYCLE_DAY_LABELS[i],
        type,
        rangeStart: newDaysCount > 0 ? rangeStart : null,
        rangeEnd: newDaysCount > 0 ? calculatedEnd : null,
      });
    } else {
      days.push({ date: weekDates[i], dayLabel: CYCLE_DAY_LABELS[i], type, rangeStart: null, rangeEnd: null });
    }
  });

  return {
    days,
    newDaysCount,
    totalNewWords,
    calculatedEnd,
    isOverflow: calculatedEnd > wordbookTotalWords,
  };
}
`
);

// 4. lib/assignment/buildDailyAssignmentRows.ts
writeFile(
  'lib/assignment/buildDailyAssignmentRows.ts',
  `import type { PreviewDay } from './calculateWeeklyPreview';

export interface DailyAssignmentRow {
  user_id: string;
  wordbook_id: string;
  date: string;
  range_start: number;
  range_end: number;
  is_review_day: boolean;
}

/** type='off' の日は行を作らない */
export function buildDailyAssignmentRows(
  days: PreviewDay[],
  userId: string,
  wordbookId: string
): DailyAssignmentRow[] {
  return days
    .filter((d) => d.type !== 'off' && d.rangeStart !== null && d.rangeEnd !== null)
    .map((d) => ({
      user_id: userId,
      wordbook_id: wordbookId,
      date: d.date,
      range_start: d.rangeStart as number,
      range_end: d.rangeEnd as number,
      is_review_day: d.type === 'review',
    }));
}
`
);

// 5. app/api/weekly-ranges/route.ts
writeFile(
  'app/api/weekly-ranges/route.ts',
  `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateWeeklyPreview } from '@/lib/assignment/calculateWeeklyPreview';
import { buildDailyAssignmentRows } from '@/lib/assignment/buildDailyAssignmentRows';
import { getWeekDates } from '@/lib/assignment/weekDates';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await req.json();
  const { wordbookId, weekStartDate, rangeStart, perDayCount, cycleType, customDayTypes } = body as {
    wordbookId: string;
    weekStartDate: string;
    rangeStart: number;
    perDayCount: number;
    cycleType: CycleType;
    customDayTypes?: DayType[];
  };

  if (!wordbookId || !weekStartDate || !rangeStart || !perDayCount || !cycleType) {
    return NextResponse.json({ error: '入力が不足しています' }, { status: 400 });
  }
  if (rangeStart < 1 || perDayCount < 1) {
    return NextResponse.json({ error: '開始No.・1日の単語数は1以上にしてください' }, { status: 400 });
  }
  if (cycleType === 'custom' && (!customDayTypes || customDayTypes.length !== 7)) {
    return NextResponse.json({ error: 'カスタムサイクルには7日分の設定が必要です' }, { status: 400 });
  }

  const { data: wordbook, error: wordbookError } = await supabase
    .from('wordbooks')
    .select('total_words')
    .eq('id', wordbookId)
    .single();
  if (wordbookError || !wordbook) {
    return NextResponse.json({ error: '単語帳が見つかりません' }, { status: 404 });
  }

  const preview = calculateWeeklyPreview({
    weekStartDate,
    rangeStart,
    perDayCount,
    cycleType,
    customDayTypes,
    wordbookTotalWords: wordbook.total_words,
  });

  if (preview.isOverflow) {
    return NextResponse.json(
      {
        error: \`単語帳の最大No.(\${wordbook.total_words})を超えています(No.\${preview.calculatedEnd}まで到達予定)\`,
      },
      { status: 400 }
    );
  }

  const { data: weeklyRange, error: upsertError } = await supabase
    .from('weekly_ranges')
    .upsert(
      {
        user_id: user.id,
        wordbook_id: wordbookId,
        week_start_date: weekStartDate,
        range_start: rangeStart,
        range_end: preview.calculatedEnd,
        per_day_count: perDayCount,
        cycle_type: cycleType,
        custom_day_types: cycleType === 'custom' ? customDayTypes : null,
      },
      { onConflict: 'user_id,week_start_date' }
    )
    .select()
    .single();

  if (upsertError || !weeklyRange) {
    return NextResponse.json({ error: '保存に失敗しました', detail: upsertError?.message }, { status: 500 });
  }

  // 該当週の割当を再生成
  const weekDates = getWeekDates(weekStartDate);
  await supabase
    .from('daily_assignments')
    .delete()
    .eq('user_id', user.id)
    .in('date', weekDates);

  const rows = buildDailyAssignmentRows(preview.days, user.id, wordbookId);
  if (rows.length > 0) {
    const { error: assignmentError } = await supabase
      .from('daily_assignments')
      .insert(rows);

    if (assignmentError) {
      return NextResponse.json(
        { error: '日次割当の保存に失敗しました', detail: assignmentError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ weeklyRange, dailyAssignments: rows });
}
`
);

// 6. components/weekly-range/DaySequenceEditor.tsx
writeFile(
  'components/weekly-range/DaySequenceEditor.tsx',
  `'use client';

import type { DayType } from '@/lib/assignment/cycleTypes';

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];
const TYPE_ORDER: DayType[] = ['new', 'review', 'off'];
const TYPE_LABEL: Record<DayType, string> = { new: '新規', review: '復習', off: '休み' };
const TYPE_STYLE: Record<DayType, string> = {
  new: 'bg-paper border-ink text-ink',
  review: 'bg-highlighter/40 border-highlighter text-ink font-bold',
  off: 'bg-line/30 border-line text-ink/40',
};

interface DaySequenceEditorProps {
  value: DayType[];
  onChange: (next: DayType[]) => void;
}

export function DaySequenceEditor({ value, onChange }: DaySequenceEditorProps) {
  const cycleDay = (index: number) => {
    const current = value[index];
    const nextType = TYPE_ORDER[(TYPE_ORDER.indexOf(current) + 1) % TYPE_ORDER.length];
    const next = [...value];
    next[index] = nextType;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAY_LABELS.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => cycleDay(i)}
          className={\`flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-xs \${TYPE_STYLE[value[i]]}\`}
        >
          <span>{label}</span>
          <span className="mt-0.5 text-[10px]">{TYPE_LABEL[value[i]]}</span>
        </button>
      ))}
    </div>
  );
}
`
);

// 7. components/weekly-range/CycleSettingsPanel.tsx
writeFile(
  'components/weekly-range/CycleSettingsPanel.tsx',
  `'use client';

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
            className="min-h-[44px] flex-1 rounded-lg border border-line bg-white px-2 text-xs font-medium text-ink"
          >
            ⚡️ 先週の続きから
            <span className="block text-[10px] text-ink/50">No.{lastWeek.rangeEnd + 1}〜 ({lastWeek.perDayCount}語/日)</span>
          </button>
          <button
            type="button"
            onClick={onUseLastWeekSame}
            className="min-h-[44px] flex-1 rounded-lg border border-line bg-white px-2 text-xs font-medium text-ink"
          >
            🔄 先週と同じ範囲
            <span className="block text-[10px] text-ink/50">No.{lastWeek.rangeStart}〜{lastWeek.rangeEnd}</span>
          </button>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs text-ink/60">学習サイクル</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: 'five_two' as const, label: '5進2戻' },
            { value: 'four_three' as const, label: '4進3戻' },
            { value: 'custom' as const, label: 'カスタム' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangeCycleType(opt.value)}
              className={\`min-h-[44px] rounded-lg border px-2 text-sm \${
                cycleType === opt.value
                  ? 'border-ink bg-ink text-paper font-bold'
                  : 'border-line bg-white text-ink/70'
              }\`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {cycleType === 'custom' && (
          <div className="mt-2">
            <p className="mb-1.5 text-xs text-ink/60">土〜金をタップして 新規/復習/休み を切り替え</p>
            <DaySequenceEditor value={customDayTypes} onChange={onChangeCustomDayTypes} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs text-ink/60">開始No.</p>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={rangeStart || ''}
          onChange={(e) => onChangeRangeStart(Number(e.target.value))}
          className="min-h-[44px] w-full rounded-lg border border-line bg-white px-3 font-maru text-ink focus:outline-none focus:ring-2 focus:ring-akashiito"
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {START_QUICK_ADDS.map((add) => (
            <button
              key={add}
              type="button"
              onClick={() => onChangeRangeStart(rangeStart + add)}
              className="min-h-[44px] rounded-full border border-line bg-white px-3 text-sm text-ink/70"
            >
              +{add}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChangeRangeStart(1)}
            className="min-h-[44px] rounded-full border border-line bg-white px-3 text-sm text-ink/50"
          >
            1に戻す
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-ink/60">1日の単語数</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangePerDayCount(Math.max(1, perDayCount - 5))}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-line bg-white font-bold text-ink"
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
            className="min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-center font-maru text-ink focus:outline-none focus:ring-2 focus:ring-akashiito"
          />
          <button
            type="button"
            onClick={() => onChangePerDayCount(perDayCount + 5)}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-line bg-white font-bold text-ink"
            aria-label="5増やす"
          >
            ＋5
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PER_DAY_CHIPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangePerDayCount(n)}
              className={\`min-h-[44px] rounded-full border px-3 text-sm \${
                perDayCount === n ? 'border-ink bg-ink text-paper font-bold' : 'border-line bg-white text-ink/70'
              }\`}
            >
              {n}語
            </button>
          ))}
        </div>
      </div>

      {isOverflow && (
        <p className="rounded-lg border border-akashiito bg-akashiito/10 px-3 py-2 text-sm text-akashiito">
          {overflowMessage}
        </p>
      )}
    </div>
  );
}
`
);

// 8. components/weekly-range/WeeklyPreviewPanel.tsx
writeFile(
  'components/weekly-range/WeeklyPreviewPanel.tsx',
  `'use client';

import type { PreviewDay } from '@/lib/assignment/calculateWeeklyPreview';

const TYPE_BADGE: Record<PreviewDay['type'], { label: string; className: string }> = {
  new: { label: '新規進捗', className: 'bg-paper text-ink border-line' },
  review: { label: '総復習', className: 'bg-highlighter/40 text-ink border-highlighter font-bold' },
  off: { label: '休み', className: 'bg-line/30 text-ink/40 border-line' },
};

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

interface WeeklyPreviewPanelProps {
  days: PreviewDay[];
}

export function WeeklyPreviewPanel({ days }: WeeklyPreviewPanelProps) {
  return (
    <div className="space-y-2">
      {days.map((day) => {
        const badge = TYPE_BADGE[day.type];
        return (
          <div
            key={day.date}
            className="flex min-h-[44px] items-center justify-between rounded-lg border border-line bg-white px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-maru text-sm text-ink">
                {formatDateLabel(day.date)} {day.dayLabel}
              </span>
              <span className={\`rounded-full border px-2 py-0.5 text-xs \${badge.className}\`}>
                {badge.label}
              </span>
            </div>
            <span className="font-maru text-sm text-ink">
              {day.rangeStart !== null ? \`No.\${day.rangeStart}〜No.\${day.rangeEnd}\` : '休み'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
`
);

// 9. components/weekly-range/WeeklyRangeModal.tsx
writeFile(
  'components/weekly-range/WeeklyRangeModal.tsx',
  `'use client';

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

  const overflowMessage = \`⚠️ 単語帳の最大No.(\${wordbookTotalWords})を超えています(No.\${preview.calculatedEnd}まで到達予定)。1日の単語数または開始No.を調整してください\`;

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: \`translateY(\${dragY}px)\` }}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper shadow-xl
                   transition-transform duration-200 motion-reduce:transition-none"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="sticky top-0 z-10 flex touch-none flex-col items-center bg-paper px-4 pb-2 pt-3"
        >
          <div className="h-1.5 w-10 rounded-full bg-line" />
          <div className="mt-2 flex w-full items-center justify-between">
            <h2 className="font-mincho text-lg text-ink font-bold">今週の学習範囲</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink/50"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={\`min-h-[44px] rounded-lg border px-2 text-sm font-medium \${
              activeTab === 'settings' ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink/70'
            }\`}
          >
            ⚙️ ペース設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={\`min-h-[44px] rounded-lg border px-2 text-sm font-medium \${
              activeTab === 'preview' ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink/70'
            }\`}
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
          <p className="mx-4 mb-2 rounded-lg border border-akashiito bg-akashiito/10 px-3 py-2 text-sm text-akashiito">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 border-t border-line bg-paper px-4 py-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || preview.isOverflow}
            className="min-h-[44px] w-full rounded-xl bg-ink font-medium text-paper disabled:opacity-40"
          >
            {isSubmitting ? '保存中…' : \`保存する (No.\${rangeStart}〜No.\${preview.calculatedEnd})\`}
          </button>
        </div>
      </div>
    </div>
  );
}
`
);

// 10. components/dashboard/SetRangeCTA.tsx
writeFile(
  'components/dashboard/SetRangeCTA.tsx',
  `'use client';

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
          <span className="text-xs text-ink/50">今週の学習サイクル</span>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="min-h-[44px] text-xs font-medium text-ink/70 underline decoration-line underline-offset-4 hover:text-ink active:opacity-70"
          >
            範囲・ペースを変更する
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full min-h-[52px] rounded-2xl bg-akashiito px-5 py-3.5 text-center font-mincho text-base font-bold text-paper shadow-md transition active:scale-98"
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
`
);

// 11. app/(main)/dashboard/page.tsx
writeFile(
  'app/(main)/dashboard/page.tsx',
  `import { createClient } from '@/lib/supabase/server';
import {
  getTodayJST,
  getThisWeekSaturdayJST,
  getPreviousSaturday,
  getWeekDates,
} from '@/lib/assignment/weekDates';
import { TodayRangeCard } from '@/components/dashboard/TodayRangeCard';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { SetRangeCTA } from '@/components/dashboard/SetRangeCTA';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import type { LastWeekData } from '@/components/weekly-range/CycleSettingsPanel';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name, total_words)')
    .eq('id', user.id)
    .single();

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST(); // 土曜起点
  const prevWeekStartDate = getPreviousSaturday(weekStartDate);
  const weekDates = getWeekDates(weekStartDate);

  // 1. 今週の週間範囲
  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  // 2. 先週の週間範囲
  const { data: prevWeeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', prevWeekStartDate)
    .maybeSingle();

  const lastWeekData: LastWeekData | undefined = prevWeeklyRange
    ? {
        rangeStart: prevWeeklyRange.range_start,
        rangeEnd: prevWeeklyRange.range_end,
        perDayCount: prevWeeklyRange.per_day_count ?? Math.max(1, Math.round((prevWeeklyRange.range_end - prevWeeklyRange.range_start + 1) / 5)),
        cycleType: (prevWeeklyRange.cycle_type as CycleType) ?? 'five_two',
        customDayTypes: (prevWeeklyRange.custom_day_types as DayType[]) ?? undefined,
      }
    : undefined;

  // 3. 今週の日次割当
  const { data: assignments } = await supabase
    .from('daily_assignments')
    .select('date, range_start, range_end, is_review_day')
    .eq('user_id', user.id)
    .in('date', weekDates);

  const assignmentByDate = new Map((assignments ?? []).map((a) => [a.date, a]));

  const weekDays = weekDates.map((date) => {
    const a = assignmentByDate.get(date);
    return {
      date,
      rangeStart: a?.range_start ?? null,
      rangeEnd: a?.range_end ?? null,
      isReviewDay: a?.is_review_day ?? false,
    };
  });

  const todayAssignment = assignmentByDate.get(today);

  const wordbookData = profile?.wordbooks as { name?: string; total_words?: number } | null;
  const wordbookName = wordbookData?.name ?? '';
  const wordbookTotalWords = wordbookData?.total_words ?? 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6">
      <SetRangeCTA
        wordbookId={profile?.wordbook_id ?? ''}
        wordbookTotalWords={wordbookTotalWords}
        weekStartDate={weekStartDate}
        hasExistingRange={!!weeklyRange}
        initialCycleType={weeklyRange?.cycle_type as CycleType}
        initialCustomDayTypes={weeklyRange?.custom_day_types as DayType[]}
        initialRangeStart={weeklyRange?.range_start}
        initialPerDayCount={weeklyRange?.per_day_count}
        lastWeek={lastWeekData}
      />

      <TodayRangeCard
        rangeStart={todayAssignment?.range_start ?? null}
        rangeEnd={todayAssignment?.range_end ?? null}
        isReviewDay={todayAssignment?.is_review_day ?? false}
        wordbookName={wordbookName}
      />

      <section className="space-y-2">
        <h2 className="px-1 font-mincho text-xs font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
        <WeeklySchedule days={weekDays} todayDate={today} />
      </section>
    </main>
  );
}
`
);

console.log('\n✨ 最新仕様に基づく全ファイルの生成・更新が完了しました！');
