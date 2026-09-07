/**
 * setup_phase_f6.js
 * フェーズF-6: 学習範囲再設定のキャッシュ無効化バグ修正 + 日本語表記の完全統一
 * 
 * 実行方法:
 *   node setup_phase_f6.js
 */

const fs = require('fs');
const path = require('path');

// 1. .env.local / .env 自動読み込み
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log(`[ENV] 環境変数を読み込みました: ${envPath}`);
      break;
    }
  }
}

loadEnv();

// ファイル書き出しヘルパー
function writeFile(relativeFilePath, fileContent) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf8');
  console.log(`[FILE] 修正完了: ${relativeFilePath}`);
}

console.log('================================================================');
console.log('フェーズF-6: 学習範囲キャッシュ無効化 & 日本語表記統一のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. app/api/weekly-ranges/route.ts (revalidatePath によるダッシュボードキャッシュ即時破棄)
// -----------------------------------------------------------------------------
const weeklyRangesRouteTs = `import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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

  // 該当週の日次割当を再生成
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

  // Next.js サーバー/ルーターキャッシュを明示的に無効化 (古い値への先祖返りを完全防止)
  revalidatePath('/dashboard');
  revalidatePath('/(main)', 'layout');

  return NextResponse.json({ weeklyRange, dailyAssignments: rows });
}
`;

writeFile('app/api/weekly-ranges/route.ts', weeklyRangesRouteTs);

// -----------------------------------------------------------------------------
// 2. components/weekly-range/WeeklyRangeModal.tsx (モーダル表示時のステート確実同期)
// -----------------------------------------------------------------------------
const weeklyRangeModalTsx = `'use client';

import { useMemo, useState, useRef, useTransition, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
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
  weekStartDate: string;
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

  // モーダル開閉時や初期値変更時に内部ステートを最新プロップスへ確実に同期
  useEffect(() => {
    if (isOpen) {
      setRangeStart(initialRangeStart ?? 1);
      setPerDayCount(initialPerDayCount ?? 20);
      setCycleType(initialCycleType ?? 'five_two');
      if (initialCustomDayTypes) {
        setCustomDayTypes(initialCustomDayTypes);
      }
    }
  }, [isOpen, initialRangeStart, initialPerDayCount, initialCycleType, initialCustomDayTypes]);

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-xs transition-opacity" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: \`translateY(\${dragY}px)\` }}
        className="max-h-[92vh] w-full max-w-md md:max-w-xl overflow-y-auto rounded-t-3xl bg-paper shadow-2xl transition-transform duration-200 motion-reduce:transition-none"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="sticky top-0 z-10 flex touch-none flex-col items-center bg-paper/95 px-4 pb-2 pt-3 backdrop-blur-xs border-b border-line/40"
        >
          <div className="h-1.5 w-12 rounded-full bg-line" />
          <div className="mt-2 flex w-full items-center justify-between">
            <h2 className="font-mincho text-lg font-bold text-ink">今週の学習範囲・ペース</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center font-bold text-ink/40 hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={\`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition cursor-pointer \${
              activeTab === 'settings' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
            }\`}
          >
            ⚙️ ペース設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={\`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition cursor-pointer \${
              activeTab === 'preview' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
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
          <p className="mx-4 mb-3 rounded-xl border border-akashiito bg-akashiito/10 p-3 font-maru text-xs text-akashiito">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 border-t border-line/80 bg-paper/95 px-4 py-3.5 backdrop-blur-xs">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || preview.isOverflow}
            className="min-h-[50px] w-full rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-98 disabled:opacity-40 cursor-pointer hover:bg-ink/90"
          >
            {isSubmitting ? '保存中…' : \`保存してスケジュールを確定 (No.\${rangeStart}〜No.\${preview.calculatedEnd})\`}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('components/weekly-range/WeeklyRangeModal.tsx', weeklyRangeModalTsx);

// -----------------------------------------------------------------------------
// 3. app/(main)/dashboard/page.tsx (force-dynamic & revalidate=0 の明示)
// -----------------------------------------------------------------------------
const dashboardPageTsx = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST();
  const prevWeekStartDate = getPreviousSaturday(weekStartDate);
  const weekDates = getWeekDates(weekStartDate);

  // [全クエリを並列実行]
  const [
    profileRes,
    weekSessionsRes,
    streakRes,
    weeklyRangeRes,
    prevWeeklyRangeRes,
    assignmentsRes,
    incompleteSessionRes,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('wordbook_id, wordbooks(name, total_words)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('test_sessions')
      .select('date')
      .eq('user_id', user.id)
      .eq('type', 'daily_check')
      .not('completed_at', 'is', null)
      .in('date', weekDates),
    supabase
      .from('streaks')
      .select('current_streak')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('weekly_ranges')
      .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle(),
    supabase
      .from('weekly_ranges')
      .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
      .eq('user_id', user.id)
      .eq('week_start_date', prevWeekStartDate)
      .maybeSingle(),
    supabase
      .from('daily_assignments')
      .select('date, range_start, range_end, is_review_day')
      .eq('user_id', user.id)
      .in('date', weekDates),
    supabase
      .from('test_sessions')
      .select('id, type, date')
      .eq('user_id', user.id)
      .eq('type', 'daily_check')
      .eq('date', today)
      .is('completed_at', null)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const completedDates = new Set((weekSessionsRes.data ?? []).map((s) => s.date));
  const isDailyCheckCompleted = completedDates.has(today);
  const hasIncompleteSession = !!incompleteSessionRes.data;
  const currentStreak = streakRes.data?.current_streak ?? 0;
  const weeklyRange = weeklyRangeRes.data;
  const prevWeeklyRange = prevWeeklyRangeRes.data;

  const lastWeekData: LastWeekData | undefined = prevWeeklyRange
    ? {
        rangeStart: prevWeeklyRange.range_start,
        rangeEnd: prevWeeklyRange.range_end,
        perDayCount:
          prevWeeklyRange.per_day_count ??
          Math.max(1, Math.round((prevWeeklyRange.range_end - prevWeeklyRange.range_start + 1) / 5)),
        cycleType: (prevWeeklyRange.cycle_type as CycleType) ?? 'five_two',
        customDayTypes: (prevWeeklyRange.custom_day_types as DayType[]) ?? undefined,
      }
    : undefined;

  const assignments = assignmentsRes.data ?? [];
  const assignmentByDate = new Map(assignments.map((a) => [a.date, a]));

  const weekDays = weekDates.map((date) => {
    const a = assignmentByDate.get(date);
    return {
      date,
      rangeStart: a?.range_start ?? null,
      rangeEnd: a?.range_end ?? null,
      isReviewDay: a?.is_review_day ?? false,
      isCompleted: completedDates.has(date),
    };
  });

  const todayAssignment = assignmentByDate.get(today);
  const wordbookData = profile?.wordbooks as { name?: string; total_words?: number } | null;
  const wordbookName = wordbookData?.name ?? '';
  const wordbookTotalWords = wordbookData?.total_words ?? 0;

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">単語帳</h1>
          <p className="font-maru text-xs md:text-sm text-ink/50">毎日コツコツ、記憶を定着</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/debug"
            prefetch={true}
            className="rounded-full border border-line bg-white px-2.5 py-1 font-maru text-[10px] md:text-xs text-ink/60 hover:text-ink transition"
          >
            🔍 自己診断
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-[#F4C0D1] bg-[#FDF2F5] px-3 py-1 font-maru text-xs md:text-sm font-bold text-[#9D2248] shadow-2xs">
            <span>🔥</span>
            <span>{currentStreak}日連続</span>
          </div>
        </div>
      </header>

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
        isDailyCheckCompleted={isDailyCheckCompleted}
        hasIncompleteSession={hasIncompleteSession}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
          <Link
            href="/weakness"
            prefetch={true}
            className="inline-flex min-h-[44px] items-center gap-1 px-2 font-maru text-xs md:text-sm font-bold text-ink/70 transition hover:text-ink underline decoration-line underline-offset-4"
          >
            <span>弱点マップを見る</span>
            <span>→</span>
          </Link>
        </div>
        <WeeklySchedule days={weekDays} todayDate={today} />
      </section>
    </main>
  );
}
`;

writeFile('app/(main)/dashboard/page.tsx', dashboardPageTsx);

// -----------------------------------------------------------------------------
// 4. components/weakness/WeaknessChunkTile.tsx (「受検」->「受験」の表記統一)
// -----------------------------------------------------------------------------
const weaknessChunkTileTsx = `'use client';

import React from 'react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessChunkTileProps {
  chunk: ChunkStat;
  onClick: (chunk: ChunkStat) => void;
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

export const WeaknessChunkTile: React.FC<WeaknessChunkTileProps> = ({ chunk, onClick }) => {
  const hasAttempts = chunk.totalAttempts > 0;
  const accuracy = chunk.accuracyRate;

  let styleClass = 'border-line bg-paper text-ink';
  let badgeText = '良好';
  let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';

  if (!hasAttempts) {
    styleClass = 'border-line/60 bg-white text-ink/40';
    badgeText = '未受験';
    badgeStyle = 'bg-line/20 text-ink/40 border-line/40';
  } else if (accuracy < 60) {
    styleClass = 'border-akashiito-border bg-akashiito/10 text-ink shadow-2xs';
    badgeText = '要注意';
    badgeStyle = 'bg-akashiito/20 text-akashiito border-akashiito-border font-bold';
  } else if (accuracy < 80) {
    styleClass = 'border-amber-300/80 bg-amber-50/50 text-ink';
    badgeText = 'やや注意';
    badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
  }

  const totalSessionsCount = chunk.fullHistory.length + chunk.drillHistory.length;

  return (
    <button
      type="button"
      onClick={() => onClick(chunk)}
      className={\`relative flex min-h-[120px] min-w-[130px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] hover:shadow-xs cursor-pointer \${styleClass}\`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="font-maru text-[11px] font-bold text-ink/60">
            {formatDateLabel(chunk.originDate)}
          </span>
          <span className={\`rounded-full border px-1.5 py-0.5 text-[9px] \${badgeStyle}\`}>
            {badgeText}
          </span>
        </div>
        <p className="mt-1.5 font-mincho text-sm font-bold tracking-tight text-ink">
          No.{chunk.rangeStart}〜{chunk.rangeEnd}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-line/40 pt-2">
        <div>
          <span className="block font-maru text-[10px] text-ink/50">正答率</span>
          <span className="font-mincho text-lg font-bold text-ink">
            {hasAttempts ? \`\${accuracy}%\` : '—'}
          </span>
        </div>
        <span className="font-maru text-[10px] text-ink/50">
          {hasAttempts ? \`\${totalSessionsCount}回受験\` : '未受験'}
        </span>
      </div>
    </button>
  );
};
`;

writeFile('components/weakness/WeaknessChunkTile.tsx', weaknessChunkTileTsx);

// -----------------------------------------------------------------------------
// 5. components/weakness/WeaknessBottomSheet.tsx (「受検」->「受験」の表記統一)
// -----------------------------------------------------------------------------
const weaknessBottomSheetTsx = `'use client';

import React, { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChunkStat, ChunkHistoryPoint } from '@/lib/weakness/computeChunkStats';
import { DrillFilterDialog } from './DrillFilterDialog';
import { SlidersHorizontal } from 'lucide-react';

interface WeaknessBottomSheetProps {
  chunk: ChunkStat | null;
  onClose: () => void;
}

const DRAG_CLOSE_THRESHOLD = 80;

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

function AccuracyLineChart({
  points,
  emptyMessage,
  color = '#639922',
}: {
  points: ChunkHistoryPoint[];
  emptyMessage: string;
  color?: string;
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
    
    const y = chartHeight - paddingY - (h.accuracyRate / 100) * (chartHeight - paddingY * 2);

    const baseDate = formatDateLabel(h.testDate);
    const totalOnDate = dateCounts.get(h.testDate) ?? 1;
    let label = baseDate;
    if (totalOnDate > 1) {
      const currentOccur = (dateOccurrences.get(h.testDate) ?? 0) + 1;
      dateOccurrences.set(h.testDate, currentOccur);
      label = \`\${baseDate}(\${currentOccur})\`;
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
          (acc, p, idx) => \`\${acc} \${idx === 0 ? 'M' : 'L'} \${p.x} \${p.y}\`,
          ''
        )
      : '';

  return (
    <div className="py-1">
      <svg viewBox={\`0 0 \${chartWidth} \${chartHeight}\`} className="h-20 w-full overflow-visible">
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
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {renderedPoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#FFFFFF" strokeWidth="2" />
            <text x={p.x} y={p.y - 7} textAnchor="middle" style={{ fill: color }} className="text-[10px] font-bold font-number">
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
  const [isDrillDialogOpen, setIsDrillDialogOpen] = useState(false);
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
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ transform: \`translateY(\${dragY}px)\` }}
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
                    {hasAttempts ? \`\${accuracy}%\` : '—'}
                  </span>
                  {chunk.needsAttention && (
                    <span className="rounded-full bg-akashiito/15 px-2 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                      要注意
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs">
                <span className="block font-maru text-[11px] text-ink/50">受験回数</span>
                <p className="mt-1 font-mincho text-sm font-bold text-ink leading-snug">
                  全体: <span className="text-base font-number">{chunk.fullHistory.length}</span>回<br />
                  苦手特訓: <span className="text-base font-number">{chunk.drillHistory.length}</span>回
                </p>
              </div>
            </div>

            {/* グラフ1: 範囲全体テスト (緑 #639922) */}
            <div className="rounded-2xl border border-line bg-white p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#639922]" />
                    <span className="font-mincho text-xs font-bold text-ink">1. 全体正答率の推移</span>
                  </div>
                  <p className="font-maru text-[10px] text-ink/50 mt-0.5">※出題範囲全体の習熟度推移 ({chunk.fullHistory.length}回)</p>
                </div>
                <span className="font-maru text-[10px] text-ink/40">古い順 → 最新</span>
              </div>

              <AccuracyLineChart
                points={chunk.fullHistory}
                color="#639922"
                emptyMessage="まだ範囲全体のテスト履歴がありません"
              />
            </div>

            {/* グラフ2: 苦手克服テスト (紫 #7F77DD) */}
            <div className="rounded-2xl border border-line bg-white p-4 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#7F77DD]" />
                    <span className="font-mincho text-xs font-bold text-ink">2. 苦手克服テストの正答率</span>
                  </div>
                  <p className="font-maru text-[10px] text-ink/50 mt-0.5">※母数: 過去に間違えた単語のみ ({chunk.drillHistory.length}回)</p>
                </div>
                <span className="font-maru text-[10px] text-ink/40">古い順 → 最新</span>
              </div>

              <AccuracyLineChart
                points={chunk.drillHistory}
                color="#7F77DD"
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
            <button
              type="button"
              onClick={() => setIsDrillDialogOpen(true)}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>この範囲の苦手克服テストを行う</span>
            </button>
          </div>
        </div>
      </div>

      <DrillFilterDialog
        isOpen={isDrillDialogOpen}
        onClose={() => setIsDrillDialogOpen(false)}
        title={\`No.\${chunk.rangeStart}〜\${chunk.rangeEnd} の苦手克服\`}
        originAssignmentId={chunk.chunkId}
      />
    </>
  );
}
`;

writeFile('components/weakness/WeaknessBottomSheet.tsx', weaknessBottomSheetTsx);

console.log('\n================================================================');
console.log('✅ フェーズF-6: キャッシュ無効化 & 表記統一の修正が完了しました！');
console.log('================================================================\n');