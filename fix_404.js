const fs = require('fs');
const path = require('path');

const files = {
  "components/dashboard/SetRangeCTA.tsx": `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WeeklyRangeModal } from "@/components/weekly-range/WeeklyRangeModal";

interface SetRangeCTAProps {
  userId?: string;
  wordbookId?: string;
  weekStartStr?: string;
}

export function SetRangeCTA({
  userId,
  wordbookId,
  weekStartStr,
}: SetRangeCTAProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="rounded-3xl border border-line bg-white p-6 shadow-xs">
        <h2 className="font-mincho text-lg text-ink">今週の学習範囲が未設定です</h2>
        <p className="mt-1 font-maru text-xs text-ink/60 leading-relaxed">
          土曜開始の1週間サイクルで、進める単語の範囲を決めましょう。
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 block w-full rounded-2xl bg-ink py-3 text-center font-mincho text-sm text-paper transition hover:opacity-90 active:scale-[0.99]"
        >
          今週の範囲を設定する
        </button>
      </div>

      {userId && wordbookId && weekStartStr && (
        <WeeklyRangeModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
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
`,
  "app/(main)/dashboard/page.tsx": `import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getWeekDates, getWeekStartSaturday, getTodayJST } from '@/lib/assignment/weekDates';
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

  const { data: profile } = await supabase
    .from('users')
    .select('name, group_id, wordbook_id, wordbooks(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/select-wordbook');
  }

  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: currentRange } = await supabase
    .from('weekly_ranges')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartStr)
    .maybeSingle();

  const { data: assignments } = await supabase
    .from('daily_assignments')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', weekDates[0])
    .lte('date', weekDates[6])
    .order('date');

  const todayAssignment = (assignments ?? []).find((a) => a.date === today);

  const { data: todaySession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .eq('type', 'daily_check')
    .maybeSingle();

  const wordbookName = (profile?.wordbooks as unknown as { name: string } | null)?.name ?? '単語帳';

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ink/40">おかえりなさい</p>
          <h1 className="font-mincho text-xl text-ink">{profile?.name ?? 'ゲスト'} さん</h1>
        </div>
        <StreakBadge currentStreak={streak?.current_streak ?? 0} />
      </header>

      {!currentRange && (
        <SetRangeCTA
          userId={user.id}
          wordbookId={profile.wordbook_id}
          weekStartStr={weekStartStr}
        />
      )}

      {currentRange && (
        <section className="space-y-3">
          <TodayRangeCard
            rangeStart={todayAssignment?.range_start ?? null}
            rangeEnd={todayAssignment?.range_end ?? null}
            isReviewDay={todayAssignment?.is_review_day ?? false}
            wordbookName={wordbookName}
          />

          {!todaySession && todayAssignment && todayAssignment.range_start !== null && todayAssignment.range_end !== null && (
            <TestCTA
              wordCount={todayAssignment.range_end - todayAssignment.range_start + 1}
              isReviewDay={todayAssignment.is_review_day}
            />
          )}

          {todaySession && (
            <div className="rounded-2xl border border-line bg-white/50 p-4 text-center">
              <p className="font-maru text-xs text-ink/60">今日の確認テストは完了しています 🎉</p>
            </div>
          )}
        </section>
      )}

      {currentRange && assignments && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-ink/40">今週のスケジュール</h2>
          <WeeklySchedule assignments={assignments} todayDate={today} />
        </section>
      )}
    </main>
  );
}
`,
  "app/page.tsx": `import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
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
console.log('=== 404 Resolution Complete ===');
