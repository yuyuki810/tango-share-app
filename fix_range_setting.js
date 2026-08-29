const fs = require('fs');
const path = require('path');

const files = {
  "app/(main)/dashboard/page.tsx": `import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getWeekDates, getWeekStartSaturday, getTodayJST } from '@/lib/assignment/weekDates';
import { calculateWeeklyPreview } from '@/lib/assignment/calculateWeeklyPreview';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { TodayRangeCard } from '@/components/dashboard/TodayRangeCard';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { SetRangeCTA } from '@/components/dashboard/SetRangeCTA';
import { TestCTA } from '@/components/dashboard/TestCTA';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = getTodayJST();
  const weekStartStr = getWeekStartSaturday();
  const weekDates = getWeekDates();

  // 1. ユーザープロファイル
  const { data: profile } = await supabase
    .from('users')
    .select('name, group_id, wordbook_id, wordbooks(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/select-wordbook');
  }

  // 2. ストリーク
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle();

  // 3. 今週の週間範囲
  const { data: currentRange } = await supabase
    .from('weekly_ranges')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartStr)
    .maybeSingle();

  // 4. 今週の割当
  let { data: assignments } = await supabase
    .from('daily_assignments')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', weekDates[0])
    .lte('date', weekDates[6])
    .order('date');

  // もし weekly_ranges はあるのに daily_assignments が作られていない場合は自動生成して補完
  if (currentRange && (!assignments || assignments.length === 0)) {
    const preview = calculateWeeklyPreview({
      rangeStart: currentRange.range_start,
      rangeEnd: currentRange.range_end,
      wordsPerDay: 20,
      weekStartDateSaturday: weekStartStr,
    });

    const dailyRows = preview.dailyAssignments.map((item) => ({
      user_id: user.id,
      wordbook_id: profile.wordbook_id,
      date: item.date,
      range_start: item.rangeStart,
      range_end: item.rangeEnd,
      is_review_day: item.isReviewDay,
    }));

    await supabase
      .from('daily_assignments')
      .upsert(dailyRows, { onConflict: 'user_id,date' });

    const { data: refreshed } = await supabase
      .from('daily_assignments')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekDates[0])
      .lte('date', weekDates[6])
      .order('date');
    assignments = refreshed;
  }

  const todayAssignment = (assignments ?? []).find((a) => a.date === today);

  // 5. 今日のテスト完了状況
  const { data: todaySession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .eq('type', 'daily_check')
    .maybeSingle();

  const wordbookName = (profile?.wordbooks as unknown as { name: string } | null)?.name ?? '単語帳';
  const hasRangeSet = !!currentRange && !!todayAssignment;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ink/40 font-maru">おかえりなさい</p>
          <h1 className="font-mincho text-xl font-bold text-ink">{profile?.name ?? 'ゲスト'} さん</h1>
        </div>
        <StreakBadge currentStreak={streak?.current_streak ?? 0} />
      </header>

      {/* 週間範囲が未設定、または今日の割当が空の場合は設定CTAを表示 */}
      {!hasRangeSet ? (
        <SetRangeCTA
          userId={user.id}
          wordbookId={profile.wordbook_id}
          weekStartStr={weekStartStr}
        />
      ) : (
        <section className="space-y-3">
          <TodayRangeCard
            rangeStart={todayAssignment?.range_start ?? null}
            rangeEnd={todayAssignment?.range_end ?? null}
            isReviewDay={todayAssignment?.is_review_day ?? false}
            wordbookName={wordbookName}
            userId={user.id}
            wordbookId={profile.wordbook_id}
            weekStartStr={weekStartStr}
          />

          {!todaySession && todayAssignment && todayAssignment.range_start !== null && todayAssignment.range_end !== null && (
            <TestCTA
              wordCount={todayAssignment.range_end - todayAssignment.range_start + 1}
              isReviewDay={todayAssignment.is_review_day}
            />
          )}

          {todaySession && (
            <div className="rounded-2xl border border-line bg-white/50 p-4 text-center">
              <p className="font-maru text-xs font-bold text-ink/70">今日の確認テストは完了しています 🎉</p>
            </div>
          )}
        </section>
      )}

      {assignments && assignments.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-ink/50 font-maru">今週のスケジュール</h2>
          </div>
          <WeeklySchedule assignments={assignments} todayDate={today} />
        </section>
      )}
    </main>
  );
}
`,
  "components/dashboard/TodayRangeCard.tsx": `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WeeklyRangeModal } from "@/components/weekly-range/WeeklyRangeModal";

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
  userId,
  wordbookId,
  weekStartStr,
}: {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
  userId?: string;
  wordbookId?: string;
  weekStartStr?: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  if (rangeStart === null || rangeEnd === null) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-white/60 p-6 text-center space-y-3">
        <p className="text-sm font-medium text-ink/70 font-maru">
          今日の学習範囲はまだ設定されていません
        </p>
        {userId && wordbookId && weekStartStr && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-block px-4 py-2 bg-ink text-paper rounded-xl text-xs font-bold font-maru hover:opacity-90 transition"
          >
            今週の範囲を設定する
          </button>
        )}

        {userId && wordbookId && weekStartStr && (
          <WeeklyRangeModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            userId={userId}
            wordbookId={wordbookId}
            weekStartStr={weekStartStr}
            onSaved={() => {
              router.refresh();
            }}
          />
        )}
      </div>
    );
  }

  const wordCount = rangeEnd - rangeStart + 1;

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink/50 tracking-wider font-maru">
            {wordbookName || "単語帳"}
          </span>
          <div className="flex items-center gap-2">
            {isReviewDay ? (
              <span className="rounded-full bg-highlighter/60 px-2.5 py-0.5 text-[11px] font-bold text-ink font-maru">
                総復習テスト日
              </span>
            ) : (
              <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-medium text-ink/70 font-maru">
                ノルマ: {wordCount}語
              </span>
            )}
            {userId && wordbookId && weekStartStr && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-[11px] text-ink/40 hover:text-ink underline font-maru"
              >
                変更
              </button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <p className="font-mincho text-3xl font-bold text-ink tracking-tight">
            No.{rangeStart} <span className="text-xl text-ink/40 font-normal">〜</span> No.{rangeEnd}
          </p>
        </div>
        <p className="mt-2 text-xs text-ink/60 font-maru">
          {isReviewDay
            ? "土曜日から積み上げた範囲を完璧にする復習デーです"
            : "まずは1周、テンポよく意味を確認していきましょう"}
        </p>
      </div>

      {userId && wordbookId && weekStartStr && (
        <WeeklyRangeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userId={userId}
          wordbookId={wordbookId}
          weekStartStr={weekStartStr}
          onSaved={() => {
            router.refresh();
          }}
        />
      )}
    </>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[Fixed] ${filePath}`);
}
console.log('=== Range Setting Logic Fully Fixed ===');
