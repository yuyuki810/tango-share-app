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
