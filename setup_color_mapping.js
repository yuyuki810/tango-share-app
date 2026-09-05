/**
 * setup_color_mapping.js
 * 色の役割マッピング（赤=CTA専用、琥珀=未完了、ピンク=ストリーク、ティール=復習、青=本日枠、緑=全体グラフ、紫=苦手グラフ）一括反映スクリプト
 * 
 * 実行方法:
 *   node setup_color_mapping.js
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
  console.log(`[FILE] 反映完了: ${relativeFilePath}`);
}

console.log('================================================================');
console.log('色の役割マッピング（新セマンティックカラー設計）のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. app/globals.css
// -----------------------------------------------------------------------------
const globalsCss = `@import "tailwindcss";

@theme {
  --color-paper: var(--color-paper-val);
  --color-paper-card: var(--color-paper-card-val);
  --color-paper-hover: var(--color-paper-hover-val);

  --color-ink: var(--color-ink-val);
  --color-ink-muted: var(--color-ink-muted-val);
  --color-ink-subtle: var(--color-ink-subtle-val);

  /* 赤シート・重要CTA専用 (ブランド核) */
  --color-akashiito: #E24B4A;
  --color-akashiito-hover: #C9382E;
  --color-akashiito-subtle: var(--color-akashiito-subtle-val);
  --color-akashiito-border: var(--color-akashiito-border-val);

  /* 新セマンティックカラー */
  --color-amber-status: #EF9F27;     /* 未完了ステータス (琥珀) */
  --color-streak-pink: #F4C0D1;      /* ストリーク連続日数 (ピンク) */
  --color-review-teal: #9FE1CB;      /* 復習日・見直し (ミントティール) */
  --color-today-blue: #378ADD;       /* 本日・当日枠 (青) */
  --color-chart-total: #639922;      /* 全体正答率グラフ (緑) */
  --color-chart-drill: #7F77DD;      /* 苦手克服グラフ (紫) */

  --color-highlighter: var(--color-highlighter-val);
  --color-highlighter-subtle: var(--color-highlighter-subtle-val);

  --color-line: var(--color-line-val);
  --color-line-light: var(--color-line-light-val);

  --font-mincho: var(--font-shippori), serif;
  --font-gothic: var(--font-zen-kaku), sans-serif;
  --font-number: var(--font-zen-maru), sans-serif;

  --shadow-paper: 0 2px 8px -2px rgba(35, 42, 59, 0.05), 0 1px 3px -1px rgba(35, 42, 59, 0.05);
  --shadow-sheet: 0 8px 24px -6px rgba(226, 75, 74, 0.12);
}

/* 🍵 既定テーマ: 和紙 (Washi) */
:root, [data-theme='washi'] {
  --color-paper-val: #F5F4EF;
  --color-paper-card-val: #FFFFFF;
  --color-paper-hover-val: #EFECE3;

  --color-ink-val: #232A3B;
  --color-ink-muted-val: #626B7F;
  --color-ink-subtle-val: #8D95A5;

  --color-akashiito-subtle-val: #FDF2F1;
  --color-akashiito-border-val: #F7B8B3;

  --color-highlighter-val: #F5C84C;
  --color-highlighter-subtle-val: #FEF8E8;

  --color-line-val: #D8D3C4;
  --color-line-light-val: #EBE8DF;
}

/* 🌌 新テーマ: 紫夜 (Dark Purple / Obsidian) */
[data-theme='dark-purple'] {
  --color-paper-val: #120E1C;
  --color-paper-card-val: #1E172E;
  --color-paper-hover-val: #2A203F;

  --color-ink-val: #F3EEFA;
  --color-ink-muted-val: #B3A7C7;
  --color-ink-subtle-val: #7E7196;

  --color-akashiito-subtle-val: #2E151A;
  --color-akashiito-border-val: #6E2228;

  --color-highlighter-val: #F7C948;
  --color-highlighter-subtle-val: #2A2211;

  --color-line-val: #34274F;
  --color-line-light-val: #251B38;
}

/* 紫夜テーマ時のカード・背景自動適合 */
[data-theme='dark-purple'] .bg-white {
  background-color: var(--color-paper-card-val) !important;
}

@layer base {
  body {
    background-color: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-gothic);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  ::selection {
    background-color: rgba(244, 192, 209, 0.3);
  }

  :focus-visible {
    outline: 2px solid var(--color-akashiito);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
`;

writeFile('app/globals.css', globalsCss);

// -----------------------------------------------------------------------------
// 2. components/dashboard/StreakBadge.tsx (ストリーク: ピンク #F4C0D1)
// -----------------------------------------------------------------------------
const streakBadgeTsx = `interface StreakBadgeProps {
  currentStreak: number;
}

export function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F4C0D1] bg-[#FDF2F5] px-3.5 py-1 text-xs font-bold text-[#9D2248] shadow-2xs">
      <span className="text-sm">🔥</span>
      <span>{currentStreak}日連続達成中</span>
    </span>
  );
}
`;

writeFile('components/dashboard/StreakBadge.tsx', streakBadgeTsx);

// -----------------------------------------------------------------------------
// 3. app/(main)/dashboard/page.tsx (ヘッダーのストリーク: ピンク #F4C0D1)
// -----------------------------------------------------------------------------
const dashboardPageTsx = `import Link from 'next/link';
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
          {/* ストリークバッジ: ピンク (#F4C0D1 / #9D2248) で分離 */}
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
// 4. components/dashboard/TodayRangeCard.tsx (未完了=琥珀 #EF9F27, 復習=ミントティール #9FE1CB, CTA=赤 #E24B4A)
// -----------------------------------------------------------------------------
const todayRangeCardTsx = `'use client';

import Link from 'next/link';
import { CheckCircle2, RotateCcw } from 'lucide-react';

interface TodayRangeCardProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
  isDailyCheckCompleted?: boolean;
  hasIncompleteSession?: boolean;
}

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
  isDailyCheckCompleted = false,
  hasIncompleteSession = false,
}: TodayRangeCardProps) {
  const hasRange = rangeStart !== null && rangeEnd !== null;
  const wordCount = hasRange ? rangeEnd - rangeStart + 1 : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-maru text-xs font-medium text-ink/50">
            {wordbookName || '単語帳'}
          </span>
          <h2 className="mt-1 font-mincho text-xl font-bold text-ink">今日の学習ノルマ</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          {/* 総復習の日バッジ: ミント寄りのティール (#9FE1CB / #136C56) */}
          {hasRange && (
            <span
              className={\`rounded-full border px-3 py-0.5 font-maru text-xs font-bold shadow-xs \${
                isReviewDay
                  ? 'border-[#9FE1CB] bg-[#E6F7F2] text-[#136C56]'
                  : 'border-line bg-paper text-ink/80'
              }\`}
            >
              {isReviewDay ? '総復習の日' : '新規進捗'}
            </span>
          )}
          {/* 未完了ステータスバッジ: 琥珀 (#EF9F27 / #9A5B00) */}
          {hasRange && (
            <span
              className={\`rounded-full px-2.5 py-0.5 font-maru text-[10px] font-bold border \${
                isDailyCheckCompleted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : hasIncompleteSession
                  ? 'bg-[#FEF3E2] text-[#9A5B00] border-[#EF9F27]'
                  : 'bg-[#FEF3E2] text-[#9A5B00] border-[#EF9F27]'
              }\`}
            >
              {isDailyCheckCompleted
                ? '本番チェック: 済'
                : hasIncompleteSession
                ? '本番チェック: 中断中'
                : '本番チェック: 未'}
            </span>
          )}
        </div>
      </div>

      <div className="my-5 flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-paper py-5 text-center">
        {hasRange ? (
          <>
            <p className="font-mincho text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              No.{rangeStart} <span className="text-xl font-normal text-ink/40">〜</span> No.{rangeEnd}
            </p>
            <p className="mt-1.5 font-maru text-xs font-medium text-ink/60">
              本日 {wordCount} 語 {isReviewDay ? '（今週の範囲を総点検）' : '（新規インプット）'}
            </p>
          </>
        ) : (
          <div className="py-2">
            <p className="font-mincho text-xl font-bold text-ink/70">今日は休養日、または範囲未設定です</p>
            <p className="mt-1 font-maru text-xs text-ink/40">上部のボタンから今週のスケジュールを設定してください</p>
          </div>
        )}
      </div>

      {hasRange && (
        <div className="space-y-2.5">
          {!isDailyCheckCompleted ? (
            <>
              {/* 本番チェックCTAボタン: 赤 #E24B4A を温存 */}
              <Link
                href="/test?mode=daily_check"
                prefetch={true}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E24B4A] font-mincho text-base font-bold text-white shadow-md shadow-[#E24B4A]/25 transition active:scale-98 hover:opacity-95"
              >
                {hasIncompleteSession && <RotateCcw className="h-4 w-4" />}
                <span>{hasIncompleteSession ? '前回の続きから再開する' : '今日の本番チェックを受ける'}</span>
              </Link>
              <div className="text-center pt-1">
                <Link
                  href="/test?mode=normal"
                  prefetch={true}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-dashed border-line bg-paper/60 px-4 py-2.5 font-maru text-xs font-medium text-ink/70 transition hover:bg-paper hover:text-ink active:scale-98"
                >
                  本番前の練習テストを受ける（何度でも可能）
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-300 py-3 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-mincho text-sm font-bold">本日の本番チェックは受験済みです</span>
              </div>
              <Link
                href="/test?mode=normal"
                prefetch={true}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-line bg-paper font-mincho text-sm font-bold text-ink transition hover:bg-paper-hover active:scale-98"
              >
                練習テストを受ける（再復習）
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
`;

writeFile('components/dashboard/TodayRangeCard.tsx', todayRangeCardTsx);

// -----------------------------------------------------------------------------
// 5. components/dashboard/WeeklySchedule.tsx (本日枠=青 #378ADD, 復習=ミントティール #9FE1CB)
// -----------------------------------------------------------------------------
const weeklyScheduleTsx = `'use client';

import { Check } from 'lucide-react';

export interface ScheduleDay {
  date: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  isCompleted?: boolean;
}

interface WeeklyScheduleProps {
  days: ScheduleDay[];
  todayDate: string;
}

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];

function formatDateShort(dateStr: string): string {
  const [, , d] = dateStr.split('-').map(Number);
  return \`\${d}\`;
}

export function WeeklySchedule({ days, todayDate }: WeeklyScheduleProps) {
  return (
    <div className="rounded-3xl border border-line bg-white p-4 shadow-xs">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isToday = day.date === todayDate;
          const isOff = day.rangeStart === null;
          const isCompleted = !!day.isCompleted;

          // 色の役割定義:
          // 1. 完了日 (今日含む): エメラルドグリーン + チェック
          // 2. 本日の未完了枠: 中立な青 (#378ADD / #185FA5)
          // 3. 復習日 (未完了): ミント寄りのティール (#9FE1CB / #136C56)
          // 4. 休み: 薄いグレー
          // 5. 新規進捗日 (未完了): ペーパー
          let dayStyle = 'border-line/80 bg-paper text-ink';
          if (isCompleted) {
            dayStyle = isToday
              ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-300 shadow-2xs'
              : 'border-emerald-300 bg-emerald-50/60 shadow-2xs';
          } else if (isToday) {
            dayStyle = 'border-[#378ADD] bg-[#EBF4FC] ring-2 ring-[#378ADD]/40';
          } else if (day.isReviewDay) {
            dayStyle = 'border-[#9FE1CB] bg-[#E6F7F2]';
          } else if (isOff) {
            dayStyle = 'border-line/40 bg-line/20 text-ink/30';
          }

          const labelColor = isCompleted
            ? 'text-emerald-800'
            : isToday
            ? 'text-[#185FA5]'
            : day.isReviewDay
            ? 'text-[#136C56]'
            : 'text-ink/60';

          const dateColor = isCompleted
            ? 'text-emerald-950 font-bold'
            : isToday
            ? 'text-[#185FA5] font-bold'
            : day.isReviewDay
            ? 'text-[#136C56] font-bold'
            : 'text-ink font-bold';

          return (
            <div
              key={day.date}
              className={\`relative flex min-h-[82px] flex-col items-center justify-between rounded-2xl border p-1.5 text-center transition \${dayStyle}\`}
            >
              {/* 曜日・日付ヘッダー */}
              <div>
                <span className={\`block font-maru text-[11px] font-bold \${labelColor}\`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={\`block font-maru text-xs \${dateColor}\`}>
                  {formatDateShort(day.date)}
                </span>
              </div>

              {/* 中央コンテンツ */}
              <div className="my-1 flex flex-col items-center justify-center">
                {isCompleted ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                ) : day.isReviewDay ? (
                  <span className="rounded-sm bg-[#9FE1CB] border border-[#6ECBAE] px-1 py-0.5 text-[9px] font-bold text-[#136C56]">
                    復習
                  </span>
                ) : isOff ? (
                  <span className="text-[10px] text-ink/30 font-maru">休</span>
                ) : (
                  <span className="font-maru text-[10px] font-bold text-ink/80">
                    {day.rangeEnd !== null && day.rangeStart !== null
                      ? day.rangeEnd - day.rangeStart + 1
                      : 0}語
                  </span>
                )}
              </div>

              {/* 下部インジケータ */}
              <div className="flex h-1.5 items-center justify-center">
                {isToday ? (
                  <div
                    className={\`h-1.5 w-1.5 rounded-full \${
                      isCompleted ? 'bg-emerald-600' : 'bg-[#378ADD]'
                    }\`}
                  />
                ) : (
                  <div className="h-1.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

writeFile('components/dashboard/WeeklySchedule.tsx', weeklyScheduleTsx);

// -----------------------------------------------------------------------------
// 6. components/weekly-range/WeeklyPreviewPanel.tsx & DaySequenceEditor.tsx (復習=ティール)
// -----------------------------------------------------------------------------
const weeklyPreviewPanelTsx = `'use client';

import type { PreviewDay } from '@/lib/assignment/calculateWeeklyPreview';

const TYPE_BADGE: Record<PreviewDay['type'], { label: string; className: string }> = {
  new: { label: '新規進捗', className: 'bg-paper text-ink border-line font-medium' },
  review: { label: '総復習', className: 'bg-[#E6F7F2] text-[#136C56] border-[#9FE1CB] font-bold shadow-2xs' },
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
            className="flex min-h-[48px] items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-14 shrink-0 font-maru text-sm font-bold text-ink">
                {formatDateLabel(day.date)} {day.dayLabel}
              </span>
              <span className={\`rounded-full border px-2.5 py-0.5 text-xs \${badge.className}\`}>
                {badge.label}
              </span>
            </div>
            <span className="font-maru text-sm font-bold text-ink">
              {day.rangeStart !== null ? \`No.\${day.rangeStart} 〜 No.\${day.rangeEnd}\` : '休み'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
`;

writeFile('components/weekly-range/WeeklyPreviewPanel.tsx', weeklyPreviewPanelTsx);

// -----------------------------------------------------------------------------
// 7. components/weakness/WeaknessBottomSheet.tsx (グラフ①=緑 #639922, グラフ②=紫 #7F77DD)
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

// グラフ①: 全体正答率 (緑 #639922) / グラフ②: 苦手克服 (紫 #7F77DD) 描画
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
                <span className="block font-maru text-[11px] text-ink/50">受検回数</span>
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

      {/* チャンク用絞り込みダイアログ */}
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

// -----------------------------------------------------------------------------
// 8. app/(main)/group/page.tsx (未受検=琥珀 #EF9F27, 本番CTA=赤 #E24B4A)
// -----------------------------------------------------------------------------
const groupPageTsx = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { Users, User, Trophy } from 'lucide-react';
import {
  determineArchetype,
  type DailyScoreEntryData,
  type ArchetypeResult,
} from '@/lib/scoring/determineArchetype';
import { ArchetypeBadge } from '@/components/group/ArchetypeBadge';
import { CopyButton } from '@/components/common/CopyButton';
import { LeaveGroupDialog } from '@/components/group/LeaveGroupDialog';
import { CreateGroupForm } from '@/components/group/CreateGroupForm';
import { JoinGroupForm } from '@/components/group/JoinGroupForm';

export default async function GroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('group_id, name')
    .eq('id', user.id)
    .single();

  if (!me?.group_id) {
    return (
      <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="inline-block rounded-full bg-amber-100/70 border border-amber-300/80 px-3 py-1 font-maru text-[10px] font-bold text-amber-900 mb-1">
            仲間と切磋琢磨
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">グループに参加しよう</h1>
          <p className="font-maru text-xs text-ink/60">
            仲間と一緒に毎日の単語テストスコアを共有・競争しましょう
          </p>
        </div>

        <div className="space-y-4">
          <CreateGroupForm />
          <div className="relative flex items-center justify-center py-2">
            <div className="w-full border-t border-line/60" />
            <span className="absolute bg-paper px-3 font-maru text-xs font-semibold text-ink/40">または</span>
          </div>
          <JoinGroupForm />
        </div>
      </main>
    );
  }

  const today = getTodayJST();

  const [groupRes, membersRes] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', me.group_id).single(),
    supabase.from('users').select('id, name, wordbook_id, wordbooks(name)').eq('group_id', me.group_id),
  ]);

  const group = groupRes.data;
  const memberList = membersRes.data ?? [];
  const memberIds = memberList.map((m) => m.id);

  const [todaySessionsRes, scoreRowsRes, streaksRes, recentScoresRes] = await Promise.all([
    supabase
      .from('test_sessions')
      .select('user_id')
      .eq('type', 'daily_check')
      .eq('date', today)
      .not('completed_at', 'is', null)
      .in('user_id', memberIds),
    supabase
      .from('daily_score_entries')
      .select('user_id, date, raw_score, normalized_score, word_count, accuracy_rate, avg_difficulty_weight, avg_diminishing_factor')
      .eq('date', today)
      .in('user_id', memberIds),
    supabase
      .from('streaks')
      .select('user_id, current_streak')
      .in('user_id', memberIds),
    supabase
      .from('daily_score_entries')
      .select('user_id, normalized_score, date')
      .in('user_id', memberIds)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(20),
  ]);

  const doneUserIds = new Set((todaySessionsRes.data ?? []).map((s) => s.user_id));
  const allGroupEntries = (scoreRowsRes.data ?? []) as DailyScoreEntryData[];
  const scoreMap = new Map(allGroupEntries.map((s) => [s.user_id, s]));
  const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.user_id, s.current_streak ?? 0]));

  const recentScoresByUser = new Map<string, number[]>();
  (recentScoresRes.data ?? []).forEach((r) => {
    const list = recentScoresByUser.get(r.user_id) ?? [];
    if (list.length < 5) {
      list.push(r.normalized_score ?? 0);
      recentScoresByUser.set(r.user_id, list);
    }
  });

  const doneMembers = memberList.filter((m) => doneUserIds.has(m.id));
  const notDoneMembers = memberList.filter((m) => !doneUserIds.has(m.id));
  const isMeDone = doneUserIds.has(user.id);
  const totalCount = memberList.length;
  const doneCount = doneMembers.length;

  doneMembers.sort((a, b) => {
    const scoreA = scoreMap.get(a.id)?.normalized_score ?? 0;
    const scoreB = scoreMap.get(b.id)?.normalized_score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;

    const rawA = Number(scoreMap.get(a.id)?.raw_score ?? 0);
    const rawB = Number(scoreMap.get(b.id)?.raw_score ?? 0);
    return rawB - rawA;
  });

  const archetypeMap = new Map<string, ArchetypeResult | null>();
  for (const m of doneMembers) {
    const arch = determineArchetype(
      m.id,
      allGroupEntries,
      recentScoresByUser.get(m.id) ?? []
    );
    archetypeMap.set(m.id, arch);
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-28 pt-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-maru text-[10px] md:text-xs font-bold uppercase tracking-wider text-ink/50">
            GROUP DAILY RANKING
          </span>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">{group?.name || 'グループ'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs md:text-sm font-bold text-ink">
          <Users className="h-3.5 w-3.5 text-ink/60" />
          <span>{totalCount}人参加中</span>
        </div>
      </div>

      {/* 招待コード確認 & コピーエリア */}
      <div className="flex items-center justify-between rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 shadow-2xs">
        <div>
          <span className="block font-maru text-[10px] font-bold text-amber-900/60 uppercase">
            グループ招待コード (仲間を招待)
          </span>
          <span className="font-mono text-base md:text-lg font-bold tracking-widest text-ink">
            {group?.invite_code || '------'}
          </span>
        </div>
        <CopyButton text={group?.invite_code || ''} />
      </div>

      {/* 今日のデイリーチェック進捗サマリー */}
      <div className="rounded-3xl border border-line bg-white p-5 md:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
            <span className="font-mincho text-sm md:text-base font-bold text-ink">本日のデイリーランキング</span>
          </div>
          <span className="font-maru text-xs md:text-sm font-bold text-ink">
            {doneCount} / {totalCount} 人 受験済み
          </span>
        </div>
        <div className="h-2 md:h-2.5 w-full overflow-hidden rounded-full bg-line/40">
          <div
            className="h-full rounded-full bg-ink transition-all duration-300"
            style={{ width: \`\${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%\` }}
          />
        </div>
        <p className="font-maru text-[11px] md:text-xs text-ink/50">
          {doneCount === totalCount
            ? '🎉 本日はグループ全員が本番チェックを完了しました！'
            : isMeDone
            ? 'あなたのスコアが反映されています。他のメンバーの結果を待ちましょう。'
            : '本番チェックを受験すると、あなたのスコアと順位が表示されます。'}
        </p>

        {!isMeDone && (
          <Link
            href="/test?mode=daily_check"
            prefetch={true}
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#E24B4A] font-mincho text-sm md:text-base font-bold text-white shadow-md shadow-[#E24B4A]/25 transition active:scale-98 hover:opacity-95"
          >
            今日の本番チェックを受ける
          </Link>
        )}
      </div>

      {/* ランキング一覧 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">今日のランキング ({doneMembers.length}人)</h2>
          <span className="font-maru text-[10px] md:text-xs text-ink/40">毎日JST 0:00リセット</span>
        </div>

        {doneMembers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-center">
            <p className="font-mincho text-sm font-bold text-ink/60">まだ誰も本番チェックを受けていません</p>
            <p className="mt-1 font-maru text-xs text-ink/40">一番乗りを目指してテストをはじめましょう！</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {doneMembers.map((m, index) => {
              const isMe = m.id === user.id;
              const rank = index + 1;
              const scoreEntry = scoreMap.get(m.id);
              const score = scoreEntry?.normalized_score ?? 0;
              const accuracy = scoreEntry?.accuracy_rate
                ? Math.round(scoreEntry.accuracy_rate * 100)
                : null;
              const wbName = (m.wordbooks as { name?: string } | null)?.name;

              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              const rankBadge = isFirst ? (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-amber-100 text-sm md:text-base font-bold text-amber-900 border border-amber-300 shadow-2xs">
                  🥇
                </span>
              ) : isSecond ? (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-slate-100 text-sm md:text-base font-bold text-slate-700 border border-slate-300">
                  🥈
                </span>
              ) : isThird ? (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-amber-50 text-sm md:text-base font-bold text-amber-800 border border-amber-200">
                  🥉
                </span>
              ) : (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-paper text-xs md:text-sm font-bold text-ink/60 border border-line">
                  {rank}
                </span>
              );

              return (
                <div
                  key={m.id}
                  className={\`flex items-start justify-between rounded-2xl border p-4 md:p-5 shadow-xs transition \${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }\`}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="pt-0.5">{rankBadge}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mincho text-sm md:text-base font-bold text-ink">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-ink text-paper px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold">
                            あなた
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                        {accuracy !== null && (
                          <span className="font-maru text-[10px] md:text-xs text-ink/50">正答率 {accuracy}%</span>
                        )}
                      </div>

                      <ArchetypeBadge
                        archetype={archetypeMap.get(m.id) ?? null}
                        attendanceStreak={streakMap.get(m.id) ?? 0}
                      />
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-maru text-[10px] md:text-xs font-medium text-ink/50 block">獲得スコア</span>
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="font-mincho text-2xl md:text-3xl font-bold tracking-tight text-ink">
                        {score}
                      </span>
                      <span className="font-maru text-xs md:text-sm font-bold text-ink/60">点</span>
                    </div>
                    {scoreEntry?.word_count && (
                      <span className="font-maru text-[10px] md:text-xs text-ink/40 block mt-0.5">
                        {scoreEntry.word_count}語 受験
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 未受験メンバー一覧: 琥珀 (#EF9F27 / #9A5B00) で表現 */}
      {notDoneMembers.length > 0 && (
        <section className="space-y-2.5 pt-2">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/50 px-1">
            未受験メンバー ({notDoneMembers.length}人)
          </h2>
          <div className="space-y-2">
            {notDoneMembers.map((m) => {
              const isMe = m.id === user.id;
              const wbName = (m.wordbooks as { name?: string } | null)?.name;
              return (
                <div
                  key={m.id}
                  className={\`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition \${
                    isMe
                      ? 'border-[#EF9F27] bg-[#FEF3E2]'
                      : 'border-dashed border-line bg-white/60 text-ink/60'
                  }\`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mincho text-sm md:text-base font-bold text-ink/80">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-[#EF9F27] text-white px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold">
                            あなた
                          </span>
                        )}
                      </div>
                      {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#FEF3E2] text-[#9A5B00] border border-[#EF9F27] px-2.5 py-0.5 font-maru text-xs md:text-sm font-bold">
                    未受験
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* グループ管理フッター (脱退) */}
      <div className="pt-4 border-t border-line/40 flex justify-center">
        <LeaveGroupDialog />
      </div>
    </main>
  );
}
`;

writeFile('app/(main)/group/page.tsx', groupPageTsx);

console.log('\n================================================================');
console.log('✅ 色の役割マッピング（新セマンティックカラー）の反映が完了しました！');
console.log('================================================================\n');
