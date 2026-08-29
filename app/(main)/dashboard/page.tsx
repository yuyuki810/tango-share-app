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
        perDayCount:
          prevWeeklyRange.per_day_count ??
          Math.max(1, Math.round((prevWeeklyRange.range_end - prevWeeklyRange.range_start + 1) / 5)),
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
    <main className="mx-auto max-w-md space-y-6 px-4 pb-24 pt-6">
      {/* 上部ヘッダー */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-mincho text-2xl font-bold text-ink">単語帳</h1>
          <p className="font-maru text-xs text-ink/50">毎日コツコツ、記憶を定着</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-akashiito/30 bg-akashiito/10 px-3 py-1 font-maru text-xs font-bold text-akashiito">
          <span>🔥</span>
          <span>7日連続</span>
        </div>
      </header>

      {/* 週間目標設定CTA */}
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

      {/* 今日の学習カード */}
      <TodayRangeCard
        rangeStart={todayAssignment?.range_start ?? null}
        rangeEnd={todayAssignment?.range_end ?? null}
        isReviewDay={todayAssignment?.is_review_day ?? false}
        wordbookName={wordbookName}
      />

      {/* 週間スケジュール */}
      <section className="space-y-2">
        <h2 className="px-1 font-mincho text-xs font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
        <WeeklySchedule days={weekDays} todayDate={today} />
      </section>
    </main>
  );
}
