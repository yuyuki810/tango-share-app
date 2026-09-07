# tango-share-app コードスナップショット

生成日時: 2026-09-07T04:24:35.210Z

新しい会話でこのプロジェクトの開発を引き継ぐ際に添付してください。

---

## app/(auth)/login/page.tsx

```tsx
import React from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">毎日を積み重ねる</h1>
        <p className="mt-2 text-xs text-ink-muted">グループ英単語共有テストにログイン</p>
      </div>
      <LoginForm />
    </main>
  );
}

```

---

## app/(auth)/signup/page.tsx

```tsx
import React from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">新しい仲間と始める</h1>
        <p className="mt-2 text-xs text-ink-muted">グループで合格までの暗記を習慣化</p>
      </div>
      <SignupForm />
    </main>
  );
}

```

---

## app/(main)/dashboard/page.tsx

```tsx
export const dynamic = 'force-dynamic';
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

```

---

## app/(main)/debug/page.tsx

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DiagnosticResult {
  step: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  data?: any;
}

export default function DebugPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      const res = await fetch('/api/debug/diagnose');
      const data = await res.json();
      setResults(data.diagnostics || []);
    } catch (err: any) {
      setResults([
        { 
          step: '診断API実行',
          status: 'error',
          message: '診断APIとの通信に失敗しました',
          data: err?.message || String(err),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="mx-auto max-w-md w-full px-4 pb-24 pt-6 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="font-mincho text-2xl font-bold text-ink">システム自己診断</h1>
            <p className="font-maru text-xs text-ink/50 mt-0.5">
              データベース疎通・RLS権限・回答保存状況の自己チェック
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 shadow-xs text-center">
        <button
          type="button"
          onClick={runDiagnostic}
          disabled={isRunning}
          className="w-full min-h-[50px] rounded-xl bg-ink font-mincho text-sm font-bold text-paper transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? '診断実行中...' : 'ワンタップで全項目を自己診断'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mincho text-xs font-bold text-ink/60 px-1">診断結果一覧</h2>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3.5 space-y-1.5 transition ${
                  r.status === 'ok'
                    ? 'border-line bg-white'
                    : r.status === 'warning'
                    ? 'border-highlighter bg-highlighter/15'
                    : 'border-akashiito-border bg-akashiito/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mincho text-sm font-bold text-ink flex items-center gap-1.5">
                    {r.status === 'ok' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : r.status === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-akashiito" />
                    )}
                    {r.step}
                  </span>
                  <span
                    className={`font-maru text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'ok'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-akashiito/20 text-akashiito'
                    }`}
                  >
                    {r.status === 'ok' ? '正常' : r.status === 'warning' ? '要確認' : 'エラー'}
                  </span>
                </div>
                <p className="font-maru text-xs text-ink/70 leading-relaxed">{r.message}</p>
                {r.data && (
                  <pre className="text-[10px] bg-black/5 p-2 rounded overflow-x-auto font-mono text-ink/80">
                    {typeof r.data === 'object' ? JSON.stringify(r.data, null, 2) : String(r.data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

```

---

## app/(main)/group/loading.tsx

```tsx
export default function GroupLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-line/30" />
          <div className="h-7 w-40 rounded-xl bg-line/40" />
        </div>
        <div className="h-7 w-20 rounded-full bg-line/30" />
      </div>

      {/* デイリーサマリーカード スケルトン */}
      <div className="rounded-3xl border border-line/60 bg-white/80 p-5 md:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 rounded-lg bg-line/40" />
          <div className="h-4 w-24 rounded bg-line/30" />
        </div>
        <div className="h-2.5 w-full rounded-full bg-line/30" />
        <div className="h-3.5 w-64 rounded bg-line/25" />
      </div>

      {/* ランキング一覧 スケルトン */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="h-4 w-32 rounded bg-line/30" />
          <div className="h-3 w-24 rounded bg-line/25" />
        </div>
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-line/60 bg-white/80 p-4 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-line/30" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-line/40" />
                  <div className="h-3 w-36 rounded bg-line/25" />
                </div>
              </div>
              <div className="h-7 w-16 rounded-lg bg-line/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

```

---

## app/(main)/group/page.tsx

```tsx
export const dynamic = 'force-dynamic';
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
            style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
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
                  className={`flex items-start justify-between rounded-2xl border p-4 md:p-5 shadow-xs transition ${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }`}
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
                  className={`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition ${
                    isMe
                      ? 'border-[#EF9F27] bg-[#FEF3E2]'
                      : 'border-dashed border-line bg-white/60 text-ink/60'
                  }`}
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

```

---

## app/(main)/layout.tsx

```tsx
import { BottomNav } from '@/components/layout/BottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

```

---

## app/(main)/loading.tsx

```tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-xl bg-line/40" />
          <div className="h-3.5 w-44 rounded-md bg-line/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-line/30" />
          <div className="h-7 w-24 rounded-full bg-amber-100/60" />
        </div>
      </div>

      {/* 今週のペース設定バー スケルトン */}
      <div className="flex items-center justify-between px-1">
        <div className="h-4 w-36 rounded-md bg-line/30" />
        <div className="h-4 w-28 rounded-md bg-line/30" />
      </div>

      {/* 今日の学習ノルマカード スケルトン */}
      <div className="rounded-3xl border border-line/60 bg-white/80 p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-3.5 w-20 rounded bg-line/30" />
            <div className="h-6 w-36 rounded-lg bg-line/40" />
          </div>
          <div className="h-5 w-16 rounded-full bg-line/30" />
        </div>
        <div className="h-28 w-full rounded-2xl border border-line/40 bg-paper/60 flex flex-col items-center justify-center gap-2">
          <div className="h-8 w-48 rounded-lg bg-line/40" />
          <div className="h-3.5 w-32 rounded bg-line/30" />
        </div>
        <div className="h-14 w-full rounded-2xl bg-line/40" />
      </div>

      {/* 週間スケジュール スケルトン */}
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-line/30 px-1" />
        <div className="rounded-3xl border border-line/60 bg-white/80 p-4 shadow-xs">
          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-line/25 border border-line/30" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

```

---

## app/(main)/review-preview/page.tsx

```tsx
"use client";

import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';

const MOCK_CARDS: WordCardData[] = [
  {
    wordId: '1',
    headword: 'cat',
    pronunciation: 'kæt',
    meaning: '猫',
    exampleSentence: 'I have a cat.',
    studyCount: 0,
  },
  {
    wordId: '2',
    headword: 'benefit',
    pronunciation: 'ˈbenɪfɪt',
    meaning: '利益、恩恵',
    exampleSentence: 'It will benefit everyone.',
    studyCount: 2,
  },
  {
    wordId: '3',
    headword: 'consequence',
    pronunciation: 'ˈkɑːnsəkwens',
    meaning: '結果、影響',
    exampleSentence: 'Consider the consequences.',
    studyCount: 5,
  },
  {
    wordId: '4',
    headword: 'characteristically',
    pronunciation: 'ˌkærəktəˈrɪstɪkli',
    meaning: '特徴的に、相変わらず',
    studyCount: 1,
  },
  {
    wordId: '5',
    headword: 'abandon',
    pronunciation: 'əˈbændən',
    meaning: '〜を捨てる、放棄する',
    exampleSentence: 'He abandoned the plan.',
    studyCount: 3,
  },
  {
    wordId: '6',
    headword: 'diminish',
    pronunciation: 'dɪˈmɪnɪʃ',
    meaning: '減少する、弱める',
    studyCount: 0,
  },
  {
    wordId: '7',
    headword: 'genuine',
    pronunciation: 'ˈdʒenjuɪn',
    meaning: '本物の、心からの',
    studyCount: 4,
  },
  {
    wordId: '8',
    headword: 'fluctuate',
    pronunciation: 'ˈflʌktʃueɪt',
    meaning: '変動する',
    studyCount: 1,
  },
  {
    wordId: '9',
    headword: 'illustrate',
    pronunciation: 'ˈɪləstreɪt',
    meaning: '説明する、示す',
    studyCount: 2,
  },
  {
    wordId: '10',
    headword: 'justify',
    pronunciation: 'ˈdʒʌstɪfaɪ',
    meaning: '正当化する',
    studyCount: 0,
  },
];

export default function ReviewPreviewPage() {
  return (
    <main className="mx-auto h-[100dvh] max-w-md bg-paper">
      <WordJudgeCardScreen
        cards={MOCK_CARDS}
        onJudge={(wordId, isKnown) => {
          console.log('judged', wordId, isKnown);
        }}
        onAllDone={() => {
          console.log('all done');
        }}
      />
    </main>
  );
}

```

---

## app/(main)/settings/theme/page.tsx

```tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ChevronLeft, Palette } from 'lucide-react';
import { ThemeSelector } from '@/components/theme/ThemeSelector';

export default async function SettingsThemePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>

      {/* 設定ナビゲーションタブ */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/settings/wordbook"
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-paper-card font-maru text-xs font-medium text-ink-muted transition hover:bg-paper-hover"
        >
          単語帳の変更
        </Link>
        <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-ink bg-ink text-paper font-mincho text-xs font-bold shadow-xs">
          テーマカラー
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-akashiito" />
          <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">テーマカラーの設定</h1>
        </div>
        <p className="font-maru text-xs text-ink-muted">
          お好みの配色にリアルタイムで切り替えます（次回起動時も保持されます）
        </p>
      </div>

      <ThemeSelector />
    </main>
  );
}

```

---

## app/(main)/settings/wordbook/loading.tsx

```tsx
export default function WordbookLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      <div className="h-3.5 w-28 rounded bg-line/30" />
      <div className="space-y-1.5">
        <div className="h-6 w-36 rounded-lg bg-line/40" />
        <div className="h-3.5 w-52 rounded bg-line/25" />
      </div>

      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-line/60 bg-white/80 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-line/30" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-line/40" />
                <div className="h-3 w-20 rounded bg-line/25" />
              </div>
            </div>
            <div className="h-5 w-5 rounded-full bg-line/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

```

---

## app/(main)/settings/wordbook/page.tsx

```tsx
import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import { ChevronLeft, BookOpen } from "lucide-react";
import type { Wordbook } from "@/types";

export default async function SettingsWordbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, wordbook_id")
    .eq("id", user.id)
    .single();

  const { data: wordbooks } = await supabase
    .from("wordbooks")
    .select("id, name, total_words, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>

      {/* 設定ナビゲーションタブ */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-ink bg-ink text-paper font-mincho text-xs font-bold shadow-xs">
          単語帳の変更
        </div>
        <Link
          href="/settings/theme"
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-paper-card font-maru text-xs font-medium text-ink-muted transition hover:bg-paper-hover"
        >
          テーマカラー
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-akashiito" />
          <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">単語帳の変更</h1>
        </div>
        <p className="font-maru text-xs text-ink-muted">テスト対象となる単語帳を変更します</p>
      </div>

      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile?.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}

```

---

## app/(main)/test/page.tsx

```tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { getTodayTestContext } from '@/lib/test/getTodayTestWords';
import { getWeakWords } from '@/lib/weakness/getWeakWords';
import { TestSessionRunner } from '@/components/test/TestSessionRunner';
import { CheckCircle2 } from 'lucide-react';

interface TestPageProps {
  searchParams: Promise<{
    mode?: string;
    originAssignmentId?: string;
    weak?: string;
    filter?: 'all' | 'mistakes' | 'recent';
    limit?: string;
    days?: string;
  }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const params = await searchParams;
  const sessionType = params.mode === 'daily_check' ? 'daily_check' : 'normal';

  const filterMode = params.filter || 'all';
  const filterLimit = params.limit ? Number(params.limit) : undefined;
  const filterDays = params.days ? Number(params.days) : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/dashboard');
  }

  // 1. チャンク指定の苦手克服テスト
  if (params.originAssignmentId) {
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id, {
      chunkId: params.originAssignmentId,
      filterMode,
      limit: filterLimit,
      days: filterDays,
    });

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">条件に該当する苦手な単語はありません！</p>
          <p className="font-maru text-xs text-ink/60">しっかり定着しています。次の学習に進みましょう。</p>
          <Link
            href="/weakness"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
          >
            弱点マップへ戻る
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={params.originAssignmentId}
          sessionType="normal"
          isReviewDay={false}
        />
      </main>
    );
  }

  // 2. 単語帳全体の苦手克服テスト
  if (params.weak === 'true') {
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id, {
      filterMode,
      limit: filterLimit,
      days: filterDays,
    });

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">条件に該当する苦手な単語はありません！</p>
          <p className="font-maru text-xs text-ink/60">日々の学習が成果に繋がっています。</p>
          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
          >
            ダッシュボードへ戻る
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={null}
          sessionType="normal"
          isReviewDay={false}
        />
      </main>
    );
  }

  const today = getTodayJST();

  // 3. 本番デイリーチェックの完了済み重複受験ガード
  if (sessionType === 'daily_check') {
    const { data: existingSession } = await supabase
      .from('test_sessions')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'daily_check')
      .maybeSingle();

    if (existingSession && existingSession.completed_at) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="font-mincho text-xl font-bold text-ink">本日の本番チェックは受験済みです</h1>
            <p className="mt-2 font-maru text-xs text-ink/60 leading-relaxed max-w-xs">
              本番チェックは1日1回のみ記録されます。<br />
              練習テスト（スコア記録なし）は何度でも受けることができます。
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full max-w-xs pt-3">
            <Link
              href="/test?mode=normal"
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98"
            >
              練習テストを受ける
            </Link>
            <Link
              href="/dashboard"
              className="flex min-h-[44px] items-center justify-center rounded-2xl border border-line bg-white font-maru text-xs font-bold text-ink transition active:scale-98"
            >
              ダッシュボードへ戻る
            </Link>
          </div>
        </main>
      );
    }
  }

  // 4. 今日のテスト単語コンテキスト取得
  const context = await getTodayTestContext(supabase, user.id, today);

  if (!context || context.cards.length === 0) {
    return (
      <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-mincho text-lg text-ink">今日のテストはありません</p>
        <p className="font-maru text-xs text-ink/60">範囲が未設定か、今日はお休みです</p>
        <Link
          href="/dashboard"
          className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
      <TestSessionRunner
        cards={context.cards}
        dailyAssignmentId={context.dailyAssignmentId}
        sessionType={sessionType}
        isReviewDay={context.isReviewDay}
        reviewChunks={context.reviewChunks}
      />
    </main>
  );
}

```

---

## app/(main)/weakness/loading.tsx

```tsx
export default function WeaknessLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダー */}
      <div className="space-y-2">
        <div className="h-3.5 w-28 rounded bg-line/30" />
        <div className="h-7 w-36 rounded-xl bg-line/40" />
        <div className="h-3.5 w-48 rounded bg-line/25" />
      </div>

      {/* 3つの統計カード スケルトン */}
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-line/60 bg-white/80 p-3 flex flex-col items-center justify-center gap-1.5">
            <div className="h-2.5 w-14 rounded bg-line/30" />
            <div className="h-6 w-8 rounded-lg bg-line/40" />
          </div>
        ))}
      </div>

      {/* タイル一覧 スケルトン */}
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-line/30 px-1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-line/60 bg-white/80 p-3.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-8 rounded bg-line/30" />
                  <div className="h-3 w-10 rounded-full bg-line/30" />
                </div>
                <div className="h-4 w-20 rounded bg-line/40" />
              </div>
              <div className="h-4 w-12 rounded bg-line/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

```

---

## app/(main)/weakness/page.tsx

```tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeChunkStats } from '@/lib/weakness/computeChunkStats';
import { WeaknessMapClient } from '@/components/weakness/WeaknessMapClient';

export default async function WeaknessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/dashboard');
  }

  const wordbookName = (profile.wordbooks as { name?: string } | null)?.name ?? '';
  const chunks = await computeChunkStats(supabase, user.id, profile.wordbook_id);

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full px-4 sm:px-0 pb-24 pt-6">
      <WeaknessMapClient chunks={chunks} wordbookName={wordbookName} />
    </main>
  );
}

```

---

## app/(onboarding)/join-group/page.tsx

```tsx
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { CreateGroupForm } from "@/components/group/CreateGroupForm";
import { JoinGroupForm } from "@/components/group/JoinGroupForm";

export default async function JoinGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("group_id, wordbook_id, name")
    .eq("id", user.id)
    .single();

  if (profile?.group_id) {
    if (!profile.wordbook_id) {
      redirect("/select-wordbook");
    }
    redirect("/dashboard");
  }

  return (
    <main className="w-full">
      <Header userName={profile?.name} showNav={false} />
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">グループに参加しよう</h1>
        <p className="mt-2 text-xs text-ink-muted">仲間と一緒に単語テストを始める準備をします</p>
      </div>
      <div className="space-y-6">
        <CreateGroupForm />
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-line" />
          <span className="absolute bg-paper px-3 text-xs font-semibold text-ink-subtle">または</span>
        </div>
        <JoinGroupForm />
      </div>
    </main>
  );
}

```

---

## app/(onboarding)/select-wordbook/page.tsx

```tsx
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import type { Wordbook } from "@/types";

export default async function SelectWordbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, group_id, wordbook_id")
    .eq("id", user.id)
    .single();

  if (!profile?.group_id) {
    redirect("/join-group");
  }

  const { data: wordbooks } = await supabase
    .from("wordbooks")
    .select("id, name, total_words, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="w-full">
      <Header userName={profile.name} showNav={false} />
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">使用する単語帳を選択</h1>
        <p className="mt-2 text-xs text-ink-muted">各自が使う単語帳を選んでください</p>
      </div>
      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}

```

---

## app/api/debug/diagnose/route.ts

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const diagnostics: Array<{
    step: string;
    status: "ok" | "error" | "warning";
    message: string;
    data?: any;
  }> = [];

  try {
    const supabase = await createClient();

    // 1. 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      diagnostics.push({
        step: "1. ログイン認証",
        status: "error",
        message: "ユーザーがログインしていません",
        data: authError?.message,
      });
      return NextResponse.json({ diagnostics });
    }

    diagnostics.push({
      step: "1. ログイン認証",
      status: "ok",
      message: `ログイン中: ${user.email} (ID: ${user.id})`,
    });

    // 2. 単語帳設定チェック
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name, wordbook_id, wordbooks(name, total_words)")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wordbook_id) {
      diagnostics.push({
        step: "2. 単語帳設定",
        status: "error",
        message: "単語帳が設定されていません",
        data: profileError?.message,
      });
    } else {
      const wb = profile.wordbooks as any;
      diagnostics.push({
        step: "2. 単語帳設定",
        status: "ok",
        message: `選択中: ${wb?.name || "ID: " + profile.wordbook_id} (総語数: ${wb?.total_words ?? 0}語)`,
      });
    }

    // 3. 日次割当チェック
    const { data: assignments, error: assignError } = await supabase
      .from("daily_assignments")
      .select("id, date, range_start, range_end, is_review_day")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (assignError) {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "error",
        message: "割当データの取得に失敗しました (RLS等の可能性)",
        data: assignError.message,
      });
    } else if (!assignments || assignments.length === 0) {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "warning",
        message: "割当が0件です。ダッシュボードで範囲を設定してください。",
      });
    } else {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "ok",
        message: `現在 ${assignments.length} 日分の割当が設定されています`,
        data: assignments.map((a) => `${a.date}: No.${a.range_start}〜${a.range_end} (${a.is_review_day ? "復習" : "進める"})`),
      });
    }

    // 4. テストセッションチェック
    const { data: sessions, error: sessionsError } = await supabase
      .from("test_sessions")
      .select("id, date, type, correct_count, total_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (sessionsError) {
      diagnostics.push({
        step: "4. テストセッション (test_sessions)",
        status: "error",
        message: "test_sessions の取得に失敗しました",
        data: sessionsError.message,
      });
    } else {
      diagnostics.push({
        step: "4. テストセッション (test_sessions)",
        status: "ok",
        message: `通算 ${sessions.length} 件のテスト履歴が見つかりました (最新5件取得)`,
        data: sessions.map((s) => `${s.date} [${s.type}]: ${s.correct_count}/${s.total_count}語 (${s.created_at})`),
      });
    }

    // 5. テスト回答チェック
    const { data: answers, error: answersError } = await supabase
      .from("test_answers")
      .select("id, is_known, origin_daily_assignment_id, word_id, session_id, created_at, test_sessions!inner(user_id)")
      .eq("test_sessions.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (answersError) {
      diagnostics.push({
        step: "5. テスト回答 (test_answers)",
        status: "error",
        message: "test_answers の取得に失敗しました",
        data: answersError.message,
      });
    } else {
      diagnostics.push({
        step: "5. テスト回答 (test_answers)",
        status: "ok",
        message: `test_answers の取得成功 (最新10件)`,
        data: {
          totalFetched: answers.length,
          sample: answers.slice(0, 3),
        },
      });
    }

    // 6. 単語ごとの連続正解カウント (word_correct_streaks) チェック
    const { data: wordStreaks, error: wordStreaksError } = await supabase
      .from("word_correct_streaks")
      .select("word_id, streak_count, last_updated_date, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (wordStreaksError) {
      diagnostics.push({
        step: "6. 連続正解カウント (word_correct_streaks)",
        status: "error",
        message: "word_correct_streaks の取得に失敗しました",
        data: wordStreaksError.message,
      });
    } else {
      diagnostics.push({
        step: "6. 連続正解カウント (word_correct_streaks)",
        status: "ok",
        message: `記録済み単語数: ${wordStreaks.length} 件 (最新10件取得)`,
        data: wordStreaks.map((s) => `WordID: ${s.word_id} => 連続正解 ${s.streak_count}回 (最終更新: ${s.last_updated_date})`),
      });
    }

    // 7. デイリースコアエントリー (daily_score_entries) チェック (フェーズC-3新設)
    const { data: scoreEntries, error: scoreError } = await supabase
      .from("daily_score_entries")
      .select("date, normalized_score, raw_score, word_count, accuracy_rate, computed_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5);

    if (scoreError) {
      diagnostics.push({
        step: "7. デイリースコア (daily_score_entries)",
        status: "error",
        message: "daily_score_entries の取得に失敗しました (マイグレーション未適用の可能性)",
        data: scoreError.message,
      });
    } else {
      diagnostics.push({
        step: "7. デイリースコア (daily_score_entries)",
        status: "ok",
        message: `スコア記録数: ${scoreEntries.length} 件 (最新5件取得)`,
        data: scoreEntries.map((e) => `${e.date}: ${e.normalized_score}点 (raw: ${e.raw_score}, 正答率: ${Math.round((e.accuracy_rate || 0) * 100)}%, ${e.word_count}語)`),
      });
    }

    return NextResponse.json({ diagnostics });
  } catch (err: any) {
    return NextResponse.json(
      { 
        diagnostics: [
          { 
            step: "致命的エラー", 
            status: "error", 
            message: err?.message || String(err) 
          } 
        ] 
      },
      { status: 500 }
    );
  }
}

```

---

## app/api/groups/route.ts

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, name, inviteCode } = body;

    // 1. グループ作成
    if (action === "create") {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "グループ名を入力してください" }, { status: 400 });
      }

      let code = generateInviteCode();
      let insertedGroup = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("groups")
          .insert({ name: name.trim(), invite_code: code })
          .select()
          .single();

        if (!error && data) {
          insertedGroup = data;
          break;
        }
        code = generateInviteCode();
      }

      if (!insertedGroup) {
        return NextResponse.json({ error: "グループ作成に失敗しました" }, { status: 500 });
      }

      await supabase.from("users").update({ group_id: insertedGroup.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group: insertedGroup });
    }

    // 2. 招待コードで参加
    if (action === "join") {
      if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json({ error: "招待コードを入力してください" }, { status: 400 });
      }

      const cleanCode = inviteCode.trim().toUpperCase();
      const { data: group, error: findError } = await supabase
        .from("groups")
        .select("id, name, invite_code")
        .eq("invite_code", cleanCode)
        .single();

      if (findError || !group) {
        return NextResponse.json({ error: "該当する招待コードのグループが見つかりません" }, { status: 404 });
      }

      await supabase.from("users").update({ group_id: group.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group });
    }

    // 3. グループ脱退 (ユーザーの全個人データ・学習履歴は保持)
    if (action === "leave") {
      const { data: me } = await supabase
        .from("users")
        .select("group_id")
        .eq("id", user.id)
        .single();

      if (!me?.group_id) {
        return NextResponse.json({ error: "グループに参加していません" }, { status: 400 });
      }

      const oldGroupId = me.group_id;

      // ユーザーの group_id を null に更新
      const { error: updateError } = await supabase
        .from("users")
        .update({ group_id: null })
        .eq("id", user.id);

      if (updateError) {
        return NextResponse.json({ error: "グループの脱退に失敗しました" }, { status: 500 });
      }

      // 残りメンバー数が0人になった場合は孤立グループを安全に削除
      const { count: remainingMembers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("group_id", oldGroupId);

      if (remainingMembers === 0) {
        await supabase.from("groups").delete().eq("id", oldGroupId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Group API fatal error:", err);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}

```

---

## app/api/test-sessions/answer/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, wordId, isKnown, originDailyAssignmentId = null } = body;

    if (!sessionId || !wordId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // セッションの所有権と未完了ステータス確認
    const { data: session } = await supabase
      .from("test_sessions")
      .select("id, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 既に回答済みの場合は更新、なければ新規挿入
    const { data: existingAnswer } = await supabase
      .from("test_answers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("word_id", wordId)
      .maybeSingle();

    if (existingAnswer) {
      await supabase
        .from("test_answers")
        .update({
          is_known: isKnown,
          origin_daily_assignment_id: originDailyAssignmentId,
        })
        .eq("id", existingAnswer.id);
    } else {
      await supabase.from("test_answers").insert({
        session_id: sessionId,
        word_id: wordId,
        is_known: isKnown,
        origin_daily_assignment_id: originDailyAssignmentId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Answer saving error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

```

---

## app/api/test-sessions/complete/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
import { updateWordCorrectStreaks } from "@/lib/streak/updateWordCorrectStreaks";
import { computeAndSaveDailyScore } from "@/lib/scoring/computeDailyScore";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", detail: authError?.message || "ログインユーザーが見つかりません" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sessionId, results } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const today = getTodayJST();

    // 1. 対象セッションを取得
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("id, user_id, date, type, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 2. 既に完了済みの場合は重複実行を防止 (冪等性の保証)
    if (session.completed_at) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        sessionId: session.id,
      });
    }

    // 3. バックアップ用: results が渡されていてDBに未保存の回答があれば補完挿入
    if (results && Array.isArray(results) && results.length > 0) {
      const { data: existingAnswers } = await supabase
        .from("test_answers")
        .select("word_id")
        .eq("session_id", sessionId);

      const existingWordIdSet = new Set((existingAnswers ?? []).map((a) => a.word_id));
      const missingAnswers = results
        .filter((r) => !existingWordIdSet.has(r.wordId))
        .map((r) => ({
          session_id: sessionId,
          word_id: r.wordId,
          is_known: r.isKnown,
          origin_daily_assignment_id: r.originDailyAssignmentId ?? null,
        }));

      if (missingAnswers.length > 0) {
        await supabase.from("test_answers").insert(missingAnswers);
      }
    }

    // 4. セッションに紐付く全回答を取得
    const { data: allAnswers } = await supabase
      .from("test_answers")
      .select("word_id, is_known, origin_daily_assignment_id")
      .eq("session_id", sessionId);

    const answerList = allAnswers ?? [];
    const correctCount = answerList.filter((a) => a.is_known).length;
    const totalCount = answerList.length;

    // 5. test_sessions を完了状態 (completed_at 設定) に更新
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("test_sessions")
      .update({
        completed_at: nowIso,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Failed to update test_sessions:", updateError);
      return NextResponse.json(
        { error: "Failed to finalize session", detail: updateError.message },
        { status: 500 }
      );
    }

    // 6. 全体連続ログイン/学習ストリーク更新
    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", (streakErr as any)?.message || String(streakErr));
    }

    // 7. 単語ごとの連続正解カウント更新 (normal / daily_check 共通)
    try {
      await updateWordCorrectStreaks(
        supabase,
        user.id,
        answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        today
      );
    } catch (wordStreakErr: any) {
      console.error("Failed to update word correct streaks:", (wordStreakErr as any)?.message || String(wordStreakErr));
    }

    // 8. デイリースコア計算 & 永続化 (daily_check のみ対象)
    let computedScore: any = null;
    if (session.type === "daily_check") {
      try {
        computedScore = await computeAndSaveDailyScore({
          supabase,
          userId: user.id,
          date: today,
          answers: answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        });
      } catch (scoreErr: any) {
        console.error("Failed to compute daily score:", (scoreErr as any)?.message || String(scoreErr));
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      savedAnswersCount: totalCount,
      correctCount,
      totalCount,
      type: session.type,
      dailyScore: computedScore,
    });
  } catch (err: any) {
    console.error("Complete API fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}

```

---

## app/api/test-sessions/start/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type = "normal", dailyAssignmentId = null, totalCount = 0 } = body;
    const today = getTodayJST();

    // 1. daily_check の場合: 完了済みセッションの重複チェック (409 Conflict)
    if (type === "daily_check") {
      const { data: completedSession } = await supabase
        .from("test_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("type", "daily_check")
        .not("completed_at", "is", null)
        .maybeSingle();

      if (completedSession) {
        return NextResponse.json(
          {
            error: "Conflict",
            detail: "本日の本番デイリーチェックは既に受験完了しています。",
          },
          { status: 409 }
        );
      }
    }

    // 2. 進行中(未完了)のセッションが存在するか確認
    let incompleteQuery = supabase
      .from("test_sessions")
      .select("id, type, date, total_count, correct_count, created_at")
      .eq("user_id", user.id)
      .eq("type", type)
      .is("completed_at", null);

    if (type === "daily_check") {
      incompleteQuery = incompleteQuery.eq("date", today);
    }

    const { data: incompleteSession } = await incompleteQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (incompleteSession) {
      // 既に回答済みの単語一覧を取得
      const { data: answers } = await supabase
        .from("test_answers")
        .select("word_id, is_known, origin_daily_assignment_id, created_at")
        .eq("session_id", incompleteSession.id)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        success: true,
        mode: "resume",
        session: incompleteSession,
        answeredWords: (answers ?? []).map((a) => ({
          wordId: a.word_id,
          isKnown: a.is_known,
          originDailyAssignmentId: a.origin_daily_assignment_id,
        })),
      });
    }

    // 3. 未完了セッションがない場合は新規セッションを作成 (completed_at = null)
    const { data: newSession, error: createError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: type,
        correct_count: 0,
        total_count: totalCount,
        completed_at: null,
      })
      .select("id, type, date, total_count, correct_count, created_at")
      .single();

    if (createError || !newSession) {
      if (createError?.code === "23505") {
        return NextResponse.json(
          { error: "Conflict", detail: "本日のセッションは既に作成されています。" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to start session", detail: createError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "new",
      session: newSession,
      answeredWords: [],
    });
  } catch (err: any) {
    console.error("Start session error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}

```

---

## app/api/users/wordbook/route.ts

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { wordbookId } = await request.json();
    if (!wordbookId) {
      return NextResponse.json({ error: "単語帳を選択してください" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ wordbook_id: wordbookId })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "単語帳の設定に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}

```

---

## app/api/weekly-ranges/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
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
        error: `単語帳の最大No.(${wordbook.total_words})を超えています(No.${preview.calculatedEnd}まで到達予定)`,
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

```

---

## app/globals.css

```css
@import "tailwindcss";

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

```

---

## app/layout.tsx

```tsx
import type { Metadata, Viewport } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const shipporiMincho = Shippori_Mincho({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-shippori",
  display: "swap",
});

const zenKakuGothic = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  display: "swap",
});

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#232A3B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "英単語グループ学習",
  description: "グループで日々の単語テストを継続する受験生向けアプリ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "単語道場",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${shipporiMincho.variable} ${zenKakuGothic.variable} ${zenMaruGothic.variable}`}
    >
      <head>
        {/* 初回描画前のチラつき (FOUC) を防止するインラインテーマ初期化スクリプト */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('tango_theme');
                if (theme === 'dark-purple') {
                  document.documentElement.setAttribute('data-theme', 'dark-purple');
                } else {
                  document.documentElement.setAttribute('data-theme', 'washi');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col items-center justify-start bg-paper antialiased">
        <ThemeProvider>
          <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl min-h-screen flex flex-col px-4 py-6 sm:px-6 md:px-8">
            {children}
          </div>
          <IOSInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}

```

---

## app/manifest.ts

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '英単語グループ学習',
    short_name: '単語道場',
    description: '少人数グループで日々の単語テストを継続する受験生向けアプリ',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F4EF', // Tailwind paper トークン実値
    theme_color: '#232A3B',      // Tailwind ink トークン実値
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

```

---

## app/not-found.tsx

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-mincho text-2xl font-bold text-ink">ページが見つかりません</h1>
      <p className="font-maru text-xs text-ink/60">
        指定されたURLは現在存在しません。
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-ink px-5 py-3 text-xs font-bold text-paper transition hover:opacity-90 font-maru shadow-sm"
      >
        ダッシュボードへ戻る
      </Link>
    </main>
  );
}

```

---

## app/page.tsx

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}

```

---

## app/sw.ts

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. API ルートおよび Next.js App Router の RSC ペイロードはキャッシュ待機せずダイレクト通信
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") || url.searchParams.has("_rsc"),
      handler: new NetworkOnly(),
    },
    // 2. ページ全体の初期読み込み: 短いタイムアウト (1.2s) で即座にフォールバック
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 1.2,
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

```

---

## components/auth/LoginForm.tsx

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
            {error}
          </div>
        )}
        <Input label="メールアドレス" type="email" required autoComplete="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="パスワード" type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          ログインして学習を再開
        </Button>
      </form>
      <div className="mt-5 text-center text-xs text-ink-muted">
        アカウントをお持ちでないですか？{" "}
        <Link href="/signup" className="font-semibold text-akashiito underline underline-offset-2 hover:opacity-80">
          新規登録する
        </Link>
      </div>
    </Card>
  );
};

```

---

## components/auth/SignupForm.tsx

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const SignupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "サインアップに失敗しました");
        return;
      }

      router.push("/join-group");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
            {error}
          </div>
        )}
        <Input label="表示名 (ニックネーム)" type="text" required placeholder="例: たろう" value={name} onChange={(e) => setName(e.target.value)} helperText="グループメンバーに表示されます" />
        <Input label="メールアドレス" type="email" required autoComplete="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="パスワード" type="password" required autoComplete="new-password" placeholder="6文字以上" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          アカウントを作成
        </Button>
      </form>
      <div className="mt-5 text-center text-xs text-ink-muted">
        すでにアカウントをお持ちですか？{" "}
        <Link href="/login" className="font-semibold text-akashiito underline underline-offset-2 hover:opacity-80">
          ログインする
        </Link>
      </div>
    </Card>
  );
};

```

---

## components/common/Button.tsx

```tsx
import React, { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3.5 text-base w-full",
  };

  const variantStyles = {
    primary: "bg-ink text-paper hover:bg-ink/90 shadow-sm",
    secondary: "bg-line/40 text-ink hover:bg-line/60",
    outline: "border border-line bg-paper-card text-ink hover:bg-paper-hover",
    danger: "bg-akashiito text-white hover:bg-akashiito-hover shadow-sm",
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>処理中...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

```

---

## components/common/Card.tsx

```tsx
import React, { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  accent = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`rounded-xl border bg-paper-card p-5 shadow-paper transition-shadow ${
        accent ? "border-akashiito/40 ring-1 ring-akashiito/20" : "border-line"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

```

---

## components/common/CopyButton.tsx

```tsx
'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  label?: string;
}

export function CopyButton({ text, className = '', label = 'コピー' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-maru text-xs font-semibold transition active:scale-95 cursor-pointer ${
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-line bg-white text-ink/80 hover:bg-paper hover:text-ink'
      } ${className}`}
      aria-label="招待コードをコピー"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="h-3.5 w-3.5 text-ink/50" />}
      <span>{copied ? 'コピー完了' : label}</span>
    </button>
  );
}

```

---

## components/common/Header.tsx

```tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, LogOut, Settings } from "lucide-react";

interface HeaderProps {
  userName?: string;
  showNav?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ userName, showNav = true }) => {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="mb-6 flex items-center justify-between border-b border-line pb-4 pt-1">
      <Link href="/dashboard" className="flex items-center gap-2 group">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-akashiito text-white shadow-sm transition-transform group-hover:scale-105">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <span className="font-mincho text-lg font-bold tracking-tight text-ink">単語道場</span>
          <span className="ml-2 inline-block rounded-full bg-highlighter/30 px-2 py-0.5 font-number text-[10px] font-bold text-ink">
            Phase 1
          </span>
        </div>
      </Link>

      {showNav && (
        <div className="flex items-center gap-3">
          {userName && <span className="text-xs text-ink-muted font-medium">{userName}</span>}
          <Link href="/settings/wordbook" aria-label="単語帳設定" className="rounded-lg p-2 text-ink-muted hover:bg-paper-hover hover:text-ink transition-colors">
            <Settings className="h-4 w-4" />
          </Link>
          <button onClick={handleLogout} aria-label="ログアウト" className="rounded-lg p-2 text-ink-muted hover:bg-paper-hover hover:text-akashiito transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
};

```

---

## components/common/Input.tsx

```tsx
import React, { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold tracking-wider text-ink-muted uppercase">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full rounded-lg border bg-paper-card px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle/60 transition-all focus:border-ink ${
            error ? "border-akashiito focus:ring-akashiito" : "border-line focus:ring-ink"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-akashiito">{error}</p>}
        {helperText && !error && <p className="text-xs text-ink-muted">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

```

---

## components/daily-check/DailyCheckCard.tsx

```tsx
"use client";

import React, { useState, useEffect } from 'react';

interface DailyCheckCardProps {
  word: string;
  meaning: string;
  pronunciation?: string | null;
  currentIndex: number;
  totalCount: number;
  onJudged: (isKnown: boolean) => void;
}

export function DailyCheckCard({
  word,
  meaning,
  pronunciation,
  currentIndex,
  totalCount,
  onJudged,
}: DailyCheckCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [word]);

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-line p-6 shadow-xs flex flex-col justify-between min-h-[380px]">
      <div className="flex justify-between items-center text-xs font-mono text-stone-400">
        <span>Daily Check</span>
        <span>
          {currentIndex + 1} / {totalCount}
        </span>
      </div>

      <div className="text-center my-6">
        <h2 className="font-serif text-3xl sm:text-4xl text-ink font-bold tracking-tight">
          {word}
        </h2>
        {pronunciation && (
          <p className="text-sm font-sans text-stone-400 mt-1">{pronunciation}</p>
        )}

        <div className="mt-8 min-h-[72px] flex items-center justify-center">
          {!isRevealed ? (
            <button
              type="button"
              onClick={() => setIsRevealed(true)}
              className="text-xs text-stone-400 hover:text-stone-600 min-h-[44px] px-4 py-2 rounded-lg border border-dashed border-stone-200"
            >
              タップして意味を表示
            </button>
          ) : (
            <p className="font-serif text-xl text-ink font-semibold">{meaning}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4">
        <button
          type="button"
          onClick={() => onJudged(false)}
          className="min-h-[56px] rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium text-sm hover:bg-stone-100 active:scale-[0.98] transition-all"
        >
          わからなかった
        </button>
        <button
          type="button"
          onClick={() => onJudged(true)}
          className="min-h-[56px] rounded-xl bg-ink text-paper font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          わかった
        </button>
      </div>
    </div>
  );
}

```

---

## components/dashboard/SetRangeCTA.tsx

```tsx
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
          {/* タップ領域を min-h-[44px] で確保 */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex min-h-[44px] items-center px-2 text-xs font-bold text-ink/80 underline decoration-line underline-offset-4 transition hover:text-ink active:opacity-70 cursor-pointer"
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

```

---

## components/dashboard/StreakBadge.tsx

```tsx
interface StreakBadgeProps {
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

```

---

## components/dashboard/TestCTA.tsx

```tsx
import Link from 'next/link';

interface TestCTAProps {
  wordCount: number;
  isReviewDay: boolean;
}

export function TestCTA({ wordCount, isReviewDay }: TestCTAProps) {
  return (
    <Link
      href="/test"
      className="group relative block min-h-[56px] w-full overflow-hidden rounded-2xl bg-akashiito px-4 py-3.5 text-center font-mincho text-base font-bold text-paper shadow-md transition hover:opacity-95 active:scale-[0.99]"
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        <span>{isReviewDay ? '復習テストを始める' : '今日の確認テストを始める'}</span>
        <span className="rounded-full bg-paper/20 px-2 py-0.5 font-maru text-xs font-normal">
          {wordCount}語
        </span>
      </span>
    </Link>
  );
}

```

---

## components/dashboard/TodayRangeCard.tsx

```tsx
'use client';

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
              className={`rounded-full border px-3 py-0.5 font-maru text-xs font-bold shadow-xs ${
                isReviewDay
                  ? 'border-[#9FE1CB] bg-[#E6F7F2] text-[#136C56]'
                  : 'border-line bg-paper text-ink/80'
              }`}
            >
              {isReviewDay ? '総復習の日' : '新規進捗'}
            </span>
          )}
          {/* 未完了ステータスバッジ: 琥珀 (#EF9F27 / #9A5B00) */}
          {hasRange && (
            <span
              className={`rounded-full px-2.5 py-0.5 font-maru text-[10px] font-bold border ${
                isDailyCheckCompleted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : hasIncompleteSession
                  ? 'bg-[#FEF3E2] text-[#9A5B00] border-[#EF9F27]'
                  : 'bg-[#FEF3E2] text-[#9A5B00] border-[#EF9F27]'
              }`}
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

```

---

## components/dashboard/WeeklySchedule.tsx

```tsx
'use client';

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
  return `${d}`;
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
              className={`relative flex min-h-[82px] flex-col items-center justify-between rounded-2xl border p-1.5 text-center transition ${dayStyle}`}
            >
              {/* 曜日・日付ヘッダー */}
              <div>
                <span className={`block font-maru text-[11px] font-bold ${labelColor}`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={`block font-maru text-xs ${dateColor}`}>
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
                    className={`h-1.5 w-1.5 rounded-full ${
                      isCompleted ? 'bg-emerald-600' : 'bg-[#378ADD]'
                    }`}
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

```

---

## components/group/ArchetypeBadge.tsx

```tsx
'use client';

import React, { useState } from 'react';
import { Info, X, Flame } from 'lucide-react';
import type { ArchetypeResult } from '@/lib/scoring/determineArchetype';

interface ArchetypeBadgeProps {
  archetype: ArchetypeResult | null;
  attendanceStreak: number | null;
}

export function ArchetypeBadge({ archetype, attendanceStreak }: ArchetypeBadgeProps) {
  const [activeModal, setActiveModal] = useState<{
    title: string;
    description: string;
    subtitle?: string;
  } | null>(null);

  const showAttendance =
    attendanceStreak !== null && attendanceStreak > 0 && attendanceStreak % 7 === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {/* 1. スコア系アーキタイプバッジ */}
        {archetype ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: archetype.title,
                subtitle: archetype.badgeLabel,
                description: archetype.message,
              });
            }}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-maru text-[10px] font-bold transition active:scale-95 cursor-pointer shadow-2xs hover:opacity-90 ${archetype.colorClass}`}
          >
            <span>{archetype.badgeLabel}</span>
            <span className="text-[9px] opacity-70">?</span>
          </button>
        ) : (
          /* 2. フォールバック表示 (アーキタイプ非該当時は ⓘ アイコン) */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: '獲得スコアについて',
                description:
                  'スコアは正答率とは少し違う指標です。まだ自信のない単語に正解するほど配点が高く、よく知っている単語は配点が低くなります。解いた数が多いほど積み上がりますが、1日20問を超えると増分はゆるやかになります。',
              });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/80 px-2 py-0.5 font-maru text-[10px] font-medium text-ink/60 transition active:scale-95 cursor-pointer hover:bg-paper hover:text-ink"
            aria-label="スコアの仕組みを見る"
          >
            <Info className="h-3 w-3 text-ink/40" />
            <span>スコアの仕組み</span>
          </button>
        )}

        {/* 3. 皆勤賞バッジ (スコア系とは独立) */}
        {showAttendance && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: `${attendanceStreak}日連続 皆勤賞`,
                subtitle: 'DAILY ATTENDANCE',
                description: `${attendanceStreak}日連続で本番チェックを継続中！日々の積み重ねが確実に力になっています。`,
              });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-maru text-[10px] font-bold text-amber-900 shadow-2xs transition active:scale-95 cursor-pointer hover:opacity-90"
          >
            <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span>{attendanceStreak}日皆勤</span>
          </button>
        )}
      </div>

      {/* ポップアップモーダル */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-line bg-white p-5 shadow-xl animate-in zoom-in-95 duration-150 space-y-3 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                {activeModal.subtitle && (
                  <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
                    {activeModal.subtitle}
                  </span>
                )}
                <h3 className="font-mincho text-base font-bold text-ink">
                  {activeModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/80 leading-relaxed bg-paper/60 p-3.5 rounded-2xl border border-line/60">
              {activeModal.description}
            </p>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="flex min-h-[42px] w-full items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}

```

---

## components/group/CreateGroupForm.tsx

```tsx
'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const CreateGroupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループ作成に失敗しました");
        return;
      }

      router.push("/select-wordbook");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-mincho text-base font-bold text-ink mb-3">新しいグループを作る</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input placeholder="例: 東大志望グループ" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          グループを作成して招待コードを発行
        </Button>
      </form>
    </Card>
  );
};

```

---

## components/group/GroupMembersList.tsx

```tsx
'use client';

import React from 'react';
import { Card } from '@/components/common/Card';
import { Users, User, Copy } from 'lucide-react';
import type { GroupMember } from '@/types';

interface GroupMembersListProps {
  groupName: string;
  inviteCode: string;
  members: GroupMember[];
  currentUserId: string;
}

export const GroupMembersList: React.FC<GroupMembersListProps> = ({
  groupName,
  inviteCode,
  members,
  currentUserId,
}) => {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            参加中グループ
          </span>
          <h2 className="font-mincho text-lg font-bold text-ink">
            {groupName}
          </h2>
        </div>
        {/* 固定上限「/ 4人」を廃し実人数表記に統一 */}
        <div className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 border border-line">
          <Users className="h-3.5 w-3.5 text-ink-muted" />
          <span className="font-number text-xs font-bold text-ink">
            {members.length}人参加中
          </span>
        </div>
      </div>

      {/* 招待コード表示エリア */}
      <div className="flex items-center justify-between rounded-lg bg-highlighter/15 p-3 border border-highlighter/40">
        <div>
          <span className="block text-[10px] font-bold text-ink-muted uppercase">
            招待コード (仲間を招待)
          </span>
          <span className="font-number text-lg font-bold tracking-widest text-ink">
            {inviteCode}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteCode);
            alert('招待コードをコピーしました！');
          }}
          className="inline-flex items-center gap-1 rounded-md bg-paper-card px-2.5 py-1.5 text-xs font-semibold text-ink border border-line shadow-sm hover:bg-paper-hover active:scale-95 transition-all cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5 text-ink-muted" />
          コピー
        </button>
      </div>

      {/* メンバー一覧 */}
      <div>
        <span className="text-xs font-semibold text-ink-muted mb-2 block">
          メンバー一覧
        </span>
        <ul className="space-y-2">
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            return (
              <li
                key={member.id}
                className={`flex items-center justify-between rounded-lg p-2.5 border transition-all ${
                  isMe
                    ? 'bg-akashiito-subtle/50 border-akashiito-border'
                    : 'bg-paper/50 border-line/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isMe
                        ? 'bg-akashiito text-white'
                        : 'bg-line text-ink-muted'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-ink">
                      {member.name}
                    </span>
                    {isMe && (
                      <span className="ml-1.5 text-[10px] font-bold text-akashiito">
                        (あなた)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded px-2 py-0.5 text-[11px] bg-paper-card border border-line text-ink-muted font-medium">
                    {member.wordbooks?.name || '単語帳未設定'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
};

```

---

## components/group/JoinGroupForm.tsx

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const JoinGroupForm = () => {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループへの参加に失敗しました");
        return;
      }

      router.push("/select-wordbook");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-mincho text-base font-bold text-ink mb-3">招待コードで参加する</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input
          placeholder="6桁のコード (例: 7K9X2P)"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-number tracking-widest uppercase text-center font-bold text-base"
          required
        />
        <Button type="submit" variant="secondary" size="lg" isLoading={loading}>
          グループに参加
        </Button>
      </form>
    </Card>
  );
};

```

---

## components/group/LeaveGroupDialog.tsx

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, X, AlertTriangle } from 'lucide-react';

export function LeaveGroupDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '脱退処理に失敗しました');
        setIsLoading(false);
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError('通信エラーが発生しました');
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 px-3 font-maru text-xs text-ink/40 hover:text-akashiito transition active:opacity-70 cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>グループを脱退する</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isLoading && setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-akashiito">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-mincho text-base font-bold text-ink">
                  グループから脱退しますか？
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isLoading && setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/70 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-line/60">
              これまでの単語の学習履歴・連続記録・スコアは個人データとして<strong>そのまま保持</strong>されますが、このグループのランキングからは外れます。
            </p>

            {error && <p className="font-maru text-xs text-akashiito">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsOpen(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line bg-white font-maru text-xs font-medium text-ink/70 transition active:scale-98 cursor-pointer hover:bg-white"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleLeave}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-akashiito font-mincho text-xs font-bold text-white shadow-sm transition active:scale-98 cursor-pointer hover:bg-akashiito/90 disabled:opacity-50"
              >
                {isLoading ? '処理中...' : '脱退する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

```

---

## components/home/HomeStateCTA.tsx

```tsx
import React from 'react';
import Link from 'next/link';
import { HomeStateMachine } from '@/lib/srs/types';

interface HomeStateCTAProps {
  state: HomeStateMachine;
  onSetRangeClick?: () => void;
}

export function HomeStateCTA({ state, onSetRangeClick }: HomeStateCTAProps) {
  if (state.state === 'no_range') {
    return (
      <div className="p-6 rounded-2xl bg-white border border-line shadow-xs">
        <h3 className="font-serif text-lg text-ink font-semibold mb-2">今週の学習範囲が未設定です</h3>
        <p className="text-sm text-stone-500 mb-5 leading-relaxed">
          土曜日を起点とする週間サイクルで、今週進める単語帳の範囲を設定しましょう。
        </p>
        <Link
          href="/assignments/setup"
          onClick={onSetRangeClick}
          className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-ink text-paper font-medium text-base hover:opacity-90 active:scale-[0.99] transition-all"
        >
          今週の範囲を設定する
        </Link>
      </div>
    );
  }

  if (state.state === 'review_due') {
    return (
      <div className="p-6 rounded-2xl bg-white border border-line shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-sans tracking-wide text-stone-500 uppercase">Today&apos;s Review</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200">
            {state.sessionCount} 件
          </span>
        </div>
        <h3 className="font-serif text-xl text-ink font-bold mb-1">
          今日の復習をはじめましょう
        </h3>
        <p className="text-xs text-stone-500 mb-5">
          新出語と復習語が自動で配分されます（約5分）
        </p>
        <Link
          href="/review"
          className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-amber-300 text-ink font-semibold text-lg hover:bg-amber-400 active:scale-[0.99] transition-all shadow-xs"
        >
          今日の復習 {state.sessionCount}件
        </Link>
      </div>
    );
  }

  if (state.state === 'daily_check_due') {
    return (
      <div className="p-6 rounded-2xl bg-white border border-amber-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-sans tracking-wide text-amber-700 uppercase">Retention Check</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            {state.count} 語
          </span>
        </div>
        <h3 className="font-serif text-xl text-ink font-bold mb-1">
          デイリーチェック
        </h3>
        <p className="text-xs text-stone-500 mb-5">
          今日新しく導入した単語の定着確認（約2分）
        </p>
        <Link
          href="/daily-check"
          className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-ink text-paper font-semibold text-base hover:opacity-90 active:scale-[0.99] transition-all"
        >
          デイリーチェック({state.count}語・約2分)
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-white border border-line shadow-xs text-center">
      <div className="w-12 h-12 rounded-full bg-stone-100 border border-line flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-stone-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="font-serif text-lg text-ink font-bold mb-1">今日の分は完了しました！</h3>
      <p className="text-xs text-stone-500 mb-5">
        本日の学習と確認はすべて終了しています。
      </p>

      {state.hasAheadContent && (
        <div className="pt-3 border-t border-line/60">
          <Link
            href="/review?mode=ahead"
            className="text-xs text-stone-500 hover:text-ink underline underline-offset-4 font-sans inline-block py-2 min-h-[44px]"
          >
            先取りして学習する（任意）
          </Link>
        </div>
      )}
    </div>
  );
}

```

---

## components/home/StreakBadge.tsx

```tsx
import React from 'react';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak <= 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-line text-xs font-sans text-stone-600">
      <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
      <span>
        <strong className="font-semibold text-ink">{streak}</strong> 日連続
      </span>
    </div>
  );
}

```

---

## components/layout/BottomNav.tsx

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  // テスト中・単語カードめくり中は下部ナビを隠して全画面で集中させる
  if (pathname.startsWith('/test') || pathname.startsWith('/review-preview')) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'ホーム', icon: '📖' },
    { href: '/group', label: 'グループ', icon: '👥' },
    { href: '/settings/wordbook', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto grid grid-cols-3 max-w-md md:max-w-xl lg:max-w-2xl items-center px-4 py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl py-1 transition active:scale-95 ${
                isActive ? 'text-akashiito font-bold' : 'text-ink/50 hover:text-ink'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="mt-0.5 font-maru text-[11px] md:text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

```

---

## components/pwa/IOSInstallPrompt.tsx

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Share, X, PlusSquare } from 'lucide-react';

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. iOS環境判定
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // 2. スタンドアロン表示（インストール済み）判定
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    // 3. 過去に閉じたかどうかの確認
    const isDismissed = localStorage.getItem('pwa_ios_prompt_dismissed') === '1';

    if (isIOS && !isStandalone && !isDismissed) {
      // 画面ロード直後のチラつきを防ぐため少し遅延して表示
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_ios_prompt_dismissed', '1');
  };

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="ホーム画面に追加の案内"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-line bg-white/95 p-4 shadow-sheet backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-akashiito text-white shadow-2xs">
            <PlusSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mincho text-sm font-bold text-ink">
              ホーム画面に追加してアプリとして使う
            </h2>
            <p className="mt-0.5 font-maru text-[11px] text-ink/60 leading-tight">
              Safari下部の共有ボタン <Share className="inline h-3 w-3 mx-0.5 text-ink/70 -mt-0.5" /> をタップし、
              <strong>「ホーム画面に追加」</strong>を選択してください。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer transition"
          aria-label="案内を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

```

---

## components/review/WordJudgeCard.tsx

```tsx
'use client';

import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from 'react';

export interface WordCardData {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  exampleSentence?: string;
  studyCount: number;
  originDailyAssignmentId?: string;
  number?: number;
}

interface WordJudgeCardProps {
  card: WordCardData;
  isTop: boolean;
  stackOffset: number;
  onJudge: (isKnown: boolean) => void;
}

const SWIPE_THRESHOLD_RATIO = 0.25;

function getHeadwordFontSize(word: string): string {
  const len = word.length;
  if (len <= 8) return 'text-5xl sm:text-6xl lg:text-7xl';
  if (len <= 12) return 'text-4xl sm:text-5xl lg:text-6xl';
  if (len <= 16) return 'text-3xl sm:text-4xl lg:text-5xl';
  return 'text-2xl sm:text-3xl lg:text-4xl';
}

export function WordJudgeCard({ card, isTop, stackOffset, onJudge }: WordJudgeCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const isPointerDown = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleReveal = useCallback(() => {
    if (!isRevealed) {
      setIsRevealed(true);
    }
  }, [isRevealed]);

  const commitJudge = useCallback(
    (isKnown: boolean) => {
      if (exitDirection !== null) return;
      setExitDirection(isKnown ? 'right' : 'left');
      setTimeout(() => onJudge(isKnown), 200);
    },
    [exitDirection, onJudge]
  );

  // キーボードショートカット処理 (Space / W : めくる, A / ← : 不正解, D / S / → : 正解)
  useEffect(() => {
    if (!isTop || exitDirection !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト入力欄にフォーカスがある場合はショートカットを無視
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const code = e.code;
      const key = e.key;

      // 1. めくる (Space, ArrowUp, KeyW, Enter)
      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'KeyW' ||
        key === ' ' ||
        key === 'ArrowUp' ||
        key === 'w' ||
        key === 'W' ||
        key === 'Enter'
      ) {
        e.preventDefault();
        handleReveal();
        return;
      }

      // 2. わからなかった (ArrowLeft, KeyA, a, A)
      if (
        code === 'ArrowLeft' ||
        code === 'KeyA' ||
        key === 'ArrowLeft' ||
        key === 'a' ||
        key === 'A'
      ) {
        e.preventDefault();
        commitJudge(false);
        return;
      }

      // 3. わかった (ArrowRight, KeyD, KeyS, d, D, s, S)
      if (
        code === 'ArrowRight' ||
        code === 'KeyD' ||
        code === 'KeyS' ||
        key === 'ArrowRight' ||
        key === 'd' ||
        key === 'D' ||
        key === 's' ||
        key === 'S'
      ) {
        e.preventDefault();
        commitJudge(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTop, exitDirection, handleReveal, commitJudge]);

  // ポインター / スワイプ操作
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTop || exitDirection !== null) return;
    if ((e.target as HTMLElement).closest('button[data-action="judge"]')) return;

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    isPointerDown.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current || dragStartX.current === null) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - (dragStartY.current ?? e.clientY);

    if (!isRevealed) return;

    if (!isDragging && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setIsDragging(true);
    }

    if (isDragging) {
      setDragX(deltaX);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;

    const deltaX = dragStartX.current !== null ? e.clientX - dragStartX.current : 0;
    const deltaY = dragStartY.current !== null ? e.clientY - dragStartY.current : 0;
    const isTap = Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10;

    if (!isRevealed && isTap) {
      handleReveal();
    } else if (isRevealed && isDragging) {
      const width = cardRef.current?.offsetWidth ?? 320;
      if (Math.abs(dragX) > width * SWIPE_THRESHOLD_RATIO) {
        commitJudge(dragX > 0);
      } else {
        setDragX(0);
      }
    } else {
      setDragX(0);
    }

    dragStartX.current = null;
    dragStartY.current = null;
    isPointerDown.current = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartX.current = null;
    dragStartY.current = null;
    isPointerDown.current = false;
    setIsDragging(false);
    setDragX(0);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const studyCountLabel = card.studyCount === 0 ? 'はじめての単語' : `${card.studyCount}回目`;
  const headwordFontSize = getHeadwordFontSize(card.headword);

  const transform = isTop
    ? exitDirection
      ? `translateX(${exitDirection === 'right' ? 550 : -550}px) rotate(${exitDirection === 'right' ? 10 : -10}deg)`
      : `translateX(${dragX}px) rotate(${dragX * 0.02}deg)`
    : 'none';

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform,
        zIndex: 10 - stackOffset,
        opacity: exitDirection ? 0 : 1,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      className={`absolute inset-0 flex select-none flex-col justify-between rounded-3xl border border-line bg-white p-6 md:p-8 lg:p-10 shadow-lg touch-none ${
        !isRevealed && isTop ? 'cursor-pointer' : ''
      } ${
        isTop && !isDragging
          ? 'transition-[transform,opacity] duration-200 motion-reduce:transition-none'
          : 'transition-none'
      }`}
    >
      {/* 1. 学習回数バッジ */}
      <div className="flex justify-between items-center">
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs md:text-sm text-ink/60 font-maru">
          {studyCountLabel}
        </span>
        {card.number && (
          <span className="font-mono text-xs text-ink/40">
            No.{card.number}
          </span>
        )}
      </div>

      {/* ドラッグ中のスタンプ表示 */}
      {isTop && isRevealed && dragX !== 0 && (
        <div
          style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}
          className={`pointer-events-none absolute top-16 z-20 rounded-xl border-2 px-4 py-1.5 text-sm md:text-base font-bold shadow-sm ${
            dragX > 0
              ? 'right-6 md:right-10 -rotate-12 border-ink text-ink bg-white/90'
              : 'left-6 md:left-10 rotate-12 border-ink/60 text-ink/60 bg-white/90'
          }`}
        >
          {dragX > 0 ? 'わかった' : 'わからなかった'}
        </div>
      )}

      {/* 2. 単語本体 */}
      <div className="my-auto flex w-full flex-col items-center justify-center gap-2 py-4 text-center">
        <p
          className={`w-full font-mincho font-bold text-ink tracking-tight whitespace-nowrap leading-normal py-2 ${headwordFontSize}`}
        >
          {card.headword}
        </p>
        {card.pronunciation ? (
          <p className="font-maru text-lg sm:text-xl md:text-2xl text-ink/75 tracking-wider">
            /{card.pronunciation}/
          </p>
        ) : (
          <div className="h-7" />
        )}
      </div>

      {/* 3. 下部エリア */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="relative h-24 md:h-28 overflow-hidden rounded-2xl">
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-paper p-3 md:p-4 text-center">
            <p className="font-maru text-base md:text-lg font-bold text-ink leading-snug">
              {card.meaning}
            </p>
            {card.exampleSentence && (
              <p className="mt-1 font-maru text-xs md:text-sm text-ink/50 line-clamp-1">
                {card.exampleSentence}
              </p>
            )}
          </div>

          <div
            style={{
              transform: isRevealed ? 'translateX(105%) rotate(6deg)' : 'translateX(0)',
            }}
            className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-akashiito text-sm md:text-base font-bold text-paper shadow-inner transition-transform duration-300 ease-out motion-reduce:transition-none ${
              isRevealed ? 'pointer-events-none' : ''
            }`}
          >
            タップして確認
          </div>
        </div>

        {/* 4. 判定ボタン (キーバッジなしのクリーンなボタン) */}
        <div
          className={`flex gap-3 md:gap-4 transition-opacity duration-200 ${
            isRevealed && isTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            data-action="judge"
            tabIndex={isRevealed && isTop ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              commitJudge(false);
            }}
            className="min-h-[56px] md:min-h-[60px] flex-1 rounded-2xl border border-line bg-white font-medium text-ink/70 transition active:bg-paper hover:bg-paper/50 flex items-center justify-center cursor-pointer shadow-xs"
          >
            わからなかった
          </button>
          <button
            type="button"
            data-action="judge"
            tabIndex={isRevealed && isTop ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              commitJudge(true);
            }}
            className="min-h-[56px] md:min-h-[60px] flex-1 rounded-2xl bg-ink font-medium text-paper transition active:opacity-90 hover:bg-ink/90 flex items-center justify-center cursor-pointer shadow-sm"
          >
            わかった
          </button>
        </div>
      </div>
    </div>
  );
}

```

---

## components/review/WordJudgeCardScreen.tsx

```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { WordJudgeCard, type WordCardData } from './WordJudgeCard';

interface WordJudgeCardScreenProps {
  cards: WordCardData[];
  initialIndex?: number;
  initialAnswers?: Map<string, boolean>;
  onJudge?: (wordId: string, isKnown: boolean) => void;
  onAllDone?: (results: Array<{ wordId: string; isKnown: boolean }>) => void;
  onFinished?: (resultsMap: Map<string, boolean>) => void;
  title?: string;
}

const MAX_STACK_VISIBLE = 3;

export function WordJudgeCardScreen({
  cards,
  initialIndex = 0,
  initialAnswers,
  onJudge,
  onAllDone,
  onFinished,
  title,
}: WordJudgeCardScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isCompleted, setIsCompleted] = useState(false);
  const [answersMap, setAnswersMap] = useState<Map<string, boolean>>(
    () => new Map(initialAnswers || [])
  );
  const resultsRef = useRef<Map<string, boolean>>(
    new Map(initialAnswers || [])
  );

  useEffect(() => {
    if (initialAnswers) {
      resultsRef.current = new Map(initialAnswers);
      setAnswersMap(new Map(initialAnswers));
    }
    if (typeof initialIndex === 'number') {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, initialAnswers]);

  const total = cards.length;
  const remaining = cards.slice(currentIndex, currentIndex + MAX_STACK_VISIBLE);

  const handleJudge = (wordId: string, isKnown: boolean) => {
    resultsRef.current.set(wordId, isKnown);
    const updatedMap = new Map(resultsRef.current);
    setAnswersMap(updatedMap);
    onJudge?.(wordId, isKnown);

    const next = currentIndex + 1;
    if (next >= total) {
      const resultsArray = cards.map((c) => ({
        wordId: c.wordId,
        isKnown: updatedMap.get(c.wordId) ?? false,
      }));

      setIsCompleted(true);
      onAllDone?.(resultsArray);
      onFinished?.(updatedMap);
    }
    setCurrentIndex(next);
  };

  // 全問終了時は即座に結果画面を表示
  if (isCompleted || currentIndex >= total) {
    const correctCount = cards.filter((c) => answersMap.get(c.wordId) ?? false).length;
    const wrongCards = cards.filter((c) => !(answersMap.get(c.wordId) ?? false));
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const isPerfect = wrongCards.length === 0;

    return (
      <div className="flex min-h-[100dvh] flex-col justify-between p-6 md:p-8 lg:p-10 bg-paper animate-in fade-in duration-200 max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full">
        <div className="space-y-6">
          <div className="text-center pt-4">
            <span className="inline-block rounded-full bg-highlighter/40 px-3 py-1 font-maru text-xs md:text-sm font-bold text-ink mb-2">
              テスト完了 🎉
            </span>
            <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">
              {title || 'テスト結果'}
            </h1>
            <p className="mt-1 font-maru text-xs md:text-sm text-ink/60">
              {isPerfect ? '全問正解！素晴らしい成果です' : '間違えた単語を振り返って定着させましょう'}
            </p>

            <div className="mt-5 rounded-3xl border border-line bg-white p-5 md:p-6 shadow-sm text-center">
              <span className="font-maru text-xs md:text-sm text-ink/50 block">正答率</span>
              <div className="mt-1 flex items-baseline justify-center gap-1.5">
                <span className="font-mincho text-4xl md:text-5xl font-bold tracking-tight text-ink">
                  {accuracy}%
                </span>
                <span className="font-maru text-xs md:text-sm font-bold text-ink/50">
                  ({correctCount} / {total}語 正解)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">
                要復習の単語 ({wrongCards.length}語)
              </h2>
            </div>

            {isPerfect ? (
              <div className="rounded-2xl border border-line/60 bg-white p-5 md:p-6 text-center shadow-xs">
                <p className="font-mincho text-sm md:text-base font-bold text-ink/80">ミスした単語はありません 🎯</p>
                <p className="mt-1 font-maru text-xs md:text-sm text-ink/40">この調子で毎日の学習を積み重ねましょう！</p>
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-0.5">
                {wrongCards.map((card) => (
                  <div
                    key={card.wordId}
                    className="flex items-center justify-between rounded-xl border border-line bg-white p-3.5 md:p-4 shadow-xs"
                  >
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mincho text-base md:text-lg font-bold text-ink">{card.headword}</span>
                        {card.pronunciation && (
                          <span className="font-maru text-xs md:text-sm text-ink/40">{card.pronunciation}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-maru text-xs md:text-sm text-ink/70">{card.meaning}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-akashiito-border bg-akashiito/10 px-2.5 py-0.5 font-maru text-[10px] md:text-xs font-bold text-akashiito">
                      要復習
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 pb-2">
          <Link
            href="/dashboard"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
          >
            ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col justify-between overflow-hidden max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full">
      {/* 上部プログレスバー & カウンター & スタイリッシュキー操作HUD */}
      <div className="px-4 pb-2 pt-4 shrink-0">
        <div className="h-1.5 md:h-2 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="hidden sm:inline-flex items-center gap-2.5 text-[11px] font-mono text-ink/70 whitespace-nowrap bg-white/90 px-3 py-1 rounded-full border border-line shadow-2xs">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper text-[10px] font-bold text-ink shadow-2xs">Space</kbd>
              <span className="font-maru text-[10px] text-ink/50">めくる</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper text-[10px] font-bold text-ink shadow-2xs">A</kbd>
              <span className="text-ink/30 text-[9px]">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper text-[10px] font-bold text-ink shadow-2xs">←</kbd>
              <span className="font-bold text-akashiito text-[11px] ml-0.5">✕</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper text-[10px] font-bold text-ink shadow-2xs">D</kbd>
              <span className="text-ink/30 text-[9px]">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-line bg-paper text-[10px] font-bold text-ink shadow-2xs">→</kbd>
              <span className="font-bold text-emerald-600 text-[11px] ml-0.5">◯</span>
            </div>
          </div>

          <span className="ml-auto font-mono text-xs text-ink/60 font-bold">
            {currentIndex}/{total}
          </span>
        </div>
      </div>

      {/* カードスタック領域 */}
      <div className="relative flex-1 px-4 pb-6 pt-2">
        {remaining.map((card, i) => (
          <WordJudgeCard
            key={card.wordId}
            card={card}
            isTop={i === 0}
            stackOffset={i}
            onJudge={(isKnown) => handleJudge(card.wordId, isKnown)}
          />
        ))}
      </div>
    </div>
  );
}

```

---

## components/test/TestResultScreen.tsx

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import type { WordCardData } from '@/components/review/WordJudgeCard';

interface TestResultScreenProps {
  correctCount: number;
  totalCount: number;
  wrongCards: WordCardData[];
  sessionType: 'daily_check' | 'normal';
  saveStatus?: {
    isSaving: boolean;
    isSuccess: boolean;
    errorMessage?: string;
    detail?: string;
    savedCount?: number;
  };
}

export function TestResultScreen({
  correctCount,
  totalCount,
  wrongCards,
  sessionType,
  saveStatus,
}: TestResultScreenProps) {
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const isPerfect = wrongCards.length === 0;
  const isDailyCheck = sessionType === 'daily_check';

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between p-6 bg-paper animate-in fade-in duration-200">
      <div className="space-y-6">
        {/* ヘッダー・スコア表示 */}
        <div className="text-center pt-4">
          <span className="inline-block rounded-full bg-highlighter/40 px-3 py-1 font-maru text-xs font-bold text-ink mb-2">
            {isDailyCheck ? '本日の本番チェック完了 🎉' : '練習テスト完了 🎉'}
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">
            {isDailyCheck ? '本番チェック結果' : 'テスト結果'}
          </h1>
          <p className="mt-1 font-maru text-xs text-ink/60">
            {isPerfect ? '全問正解！素晴らしい集中力です' : '間違えた単語を振り返って定着させましょう'}
          </p>

          <div className="mt-5 rounded-3xl border border-line bg-white p-5 shadow-sm text-center">
            <span className="font-maru text-xs text-ink/50 block">正答率</span>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-mincho text-4xl font-bold tracking-tight text-ink">
                {accuracy}%
              </span>
              <span className="font-maru text-xs font-bold text-ink/50">
                ({correctCount} / {totalCount}語 正解)
              </span>
            </div>
          </div>
        </div>

        {/* 🔍 DB保存リアルタイム診断バナー */}
        <div className="rounded-2xl border p-3.5 text-xs transition-all shadow-xs bg-white">
          {saveStatus?.isSaving ? (
            <div className="flex items-center gap-2 text-ink/60 font-maru">
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
              <span>データベースに回答結果を同期中...</span>
            </div>
          ) : saveStatus?.isSuccess ? (
            <div className="flex items-center justify-between text-ink font-maru">
              <span className="flex items-center gap-1.5 font-bold">
                <span>🟢</span>
                <span>
                  {isDailyCheck ? '本番チェック（daily_check）記録完了' : '練習結果を記録完了'}
                </span>
              </span>
              <span className="text-[11px] text-ink/50">
                {saveStatus.savedCount ?? totalCount}件の回答を保存
              </span>
            </div>
          ) : (
            <div className="space-y-1.5 text-akashiito font-maru">
              <div className="flex items-center gap-1.5 font-bold">
                <span>🔴</span>
                <span>{saveStatus?.errorMessage || '保存エラーが発生しました'}</span>
              </div>
              <p className="text-[11px] bg-akashiito/10 p-2 rounded-lg border border-akashiito/30 font-mono break-all">
                {saveStatus?.detail || 'データベースに保存できませんでした'}
              </p>
            </div>
          )}
        </div>

        {/* 間違えた単語一覧 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-mincho text-xs font-bold text-ink/60">
              要復習の単語 ({wrongCards.length}語)
            </h2>
          </div>

          {isPerfect ? (
            <div className="rounded-2xl border border-line/60 bg-white p-5 text-center shadow-xs">
              <p className="font-mincho text-sm font-bold text-ink/80">ミスした単語はありません 🎯</p>
              <p className="mt-1 font-maru text-xs text-ink/40">この調子で毎日の学習を積み重ねましょう！</p>
            </div>
          ) : (
            <div className="max-h-[250px] space-y-2 overflow-y-auto pr-0.5">
              {wrongCards.map((card) => (
                <div
                  key={card.wordId}
                  className="flex items-center justify-between rounded-xl border border-line bg-white p-3.5 shadow-xs"
                >
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mincho text-base font-bold text-ink">{card.headword}</span>
                      {card.pronunciation && (
                        <span className="font-maru text-xs text-ink/40">{card.pronunciation}</span>
                      )}
                    </div>
                    <p className="mt-0.5 font-maru text-xs text-ink/70">{card.meaning}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-akashiito-border bg-akashiito/10 px-2.5 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                    要復習
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* フッターアクション */}
      <div className="pt-6 pb-2 space-y-2">
        <Link
          href="/dashboard"
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
        >
          ダッシュボードへ戻る
        </Link>
        {isDailyCheck && (
          <Link
            href="/group"
            className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-line bg-white font-maru text-xs font-bold text-ink transition hover:bg-paper-hover active:scale-[0.98]"
          >
            グループの受験状況を確認する
          </Link>
        )}
      </div>
    </div>
  );
}

```

---

## components/test/TestSessionRunner.tsx

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';
import { ChunkSummaryScreen, type ChunkResultItem } from '@/components/weakness/ChunkSummaryScreen';
import { TestResultScreen } from '@/components/test/TestResultScreen';
import type { ReviewChunkSummaryInfo } from '@/lib/test/getTodayTestWords';
import { RefreshCw, Play, RotateCcw } from 'lucide-react';

interface TestSessionRunnerProps {
  cards: WordCardData[];
  dailyAssignmentId: string | null;
  sessionType: 'daily_check' | 'normal';
  isReviewDay?: boolean;
  reviewChunks?: ReviewChunkSummaryInfo[];
}

export function TestSessionRunner({
  cards,
  dailyAssignmentId,
  sessionType,
  isReviewDay = false,
  reviewChunks = [],
}: TestSessionRunnerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [resumePrompt, setResumePrompt] = useState<{
    answeredCount: number;
    answeredMap: Map<string, boolean>;
  } | null>(null);

  const [initialIndex, setInitialIndex] = useState(0);
  const [initialAnswers, setInitialAnswers] = useState<Map<string, boolean>>(new Map());
  const pendingAnswersQueue = useRef<Array<{ wordId: string; isKnown: boolean }>>([]);

  const [resultData, setResultData] = useState<{
    correctCount: number;
    totalCount: number;
    wrongCards: WordCardData[];
    chunkResults?: ChunkResultItem[];
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean;
    isSuccess: boolean;
    errorMessage?: string;
    detail?: string;
    savedCount?: number;
  }>({
    isSaving: false,
    isSuccess: false,
  });

  // 1. セッション初期化 (/api/test-sessions/start)
  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);

    fetch('/api/test-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: sessionType,
        dailyAssignmentId,
        totalCount: cards.length,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          const currentId = data.session.id;
          setSessionId(currentId);
          sessionIdRef.current = currentId;

          if (pendingAnswersQueue.current.length > 0) {
            pendingAnswersQueue.current.forEach((item) => {
              const matchedCard = cards.find((c) => c.wordId === item.wordId);
              fetch('/api/test-sessions/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: currentId,
                  wordId: item.wordId,
                  isKnown: item.isKnown,
                  originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
                }),
              }).catch((e) => console.error('Queue flush error:', e));
            });
            pendingAnswersQueue.current = [];
          }

          if (data.mode === 'resume' && data.answeredWords && data.answeredWords.length > 0) {
            const answeredMap = new Map<string, boolean>();
            data.answeredWords.forEach((a: any) => {
              answeredMap.set(a.wordId, a.isKnown);
            });

            if (data.answeredWords.length < cards.length) {
              setResumePrompt({
                answeredCount: data.answeredWords.length,
                answeredMap,
              });
            } else {
              setInitialAnswers(answeredMap);
              setInitialIndex(cards.length);
            }
          }
        } else {
          console.error('Failed to start session:', data.error);
        }
      })
      .catch((err) => {
        console.error('Start session request error:', err);
      })
      .finally(() => {
        if (isMounted) setIsInitializing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionType, dailyAssignmentId, cards.length]);

  // 2. 単語判定のたびに即座に都度保存
  const handleSingleJudge = (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    const matchedCard = cards.find((c) => c.wordId === wordId);

    if (!currentId) {
      pendingAnswersQueue.current.push({ wordId, isKnown });
      return;
    }

    fetch('/api/test-sessions/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        wordId,
        isKnown,
        originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
      }),
    }).catch((err) => {
      console.error('Answer streaming error:', err);
    });
  };

  // 3. 全問終了時のセッション完了確定処理 (正答率ベースでサマリー判定)
  const handleFinished = (resultsMap: Map<string, boolean>) => {
    const currentId = sessionIdRef.current;
    const results = cards.map((c) => ({
      wordId: c.wordId,
      isKnown: resultsMap.get(c.wordId) ?? false,
      originDailyAssignmentId: c.originDailyAssignmentId || dailyAssignmentId,
    }));

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;
    const wrongCards = cards.filter((c) => !(resultsMap.get(c.wordId) ?? false));

    if (isReviewDay && reviewChunks.length > 0) {
      const chunkResults: ChunkResultItem[] = reviewChunks.map((rc) => {
        const chunkCards = cards.filter(
          (c) =>
            c.originDailyAssignmentId === rc.chunkId ||
            (typeof c.number === 'number' &&
              c.number >= rc.rangeStart &&
              c.number <= rc.rangeEnd)
        );
        const cTotal = chunkCards.length;
        const cCorrect = chunkCards.filter((c) => resultsMap.get(c.wordId) ?? false).length;
        const cAccuracy = cTotal > 0 ? Math.round((cCorrect / cTotal) * 100) : 0;

        let status: 'improved' | 'same' | 'worse' | 'first' = 'first';
        if (rc.prevAccuracyRate !== null) {
          const diff = cAccuracy - rc.prevAccuracyRate;
          if (diff >= 10) {
            status = 'improved';
          } else if (diff <= -10) {
            status = 'worse';
          } else {
            status = 'same';
          }
        } else {
          status = 'first';
        }

        return {
          chunkId: rc.chunkId,
          rangeStart: rc.rangeStart,
          rangeEnd: rc.rangeEnd,
          originDate: rc.originDate,
          correctCount: cCorrect,
          totalCount: cTotal,
          accuracyRate: cAccuracy,
          prevAccuracyRate: rc.prevAccuracyRate,
          status,
        };
      });

      setResultData({
        correctCount,
        totalCount,
        wrongCards,
        chunkResults,
      });
    } else {
      setResultData({
        correctCount,
        totalCount,
        wrongCards,
      });
    }

    setSaveStatus({ isSaving: true, isSuccess: false });

    fetch('/api/test-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        results,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setSaveStatus({
            isSaving: false,
            isSuccess: true,
            savedCount: data.savedAnswersCount ?? results.length,
          });
        } else {
          setSaveStatus({
            isSaving: false,
            isSuccess: false,
            errorMessage: data.error || '保存エラー',
            detail: data.detail || `HTTP ${res.status}`,
          });
        }
      })
      .catch((err) => {
        console.error('Error completing test session:', err);
        setSaveStatus({
          isSaving: false,
          isSuccess: false,
          errorMessage: '通信エラー',
          detail: err?.message || String(err),
        });
      });
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-ink/60 font-maru">
        <RefreshCw className="h-6 w-6 animate-spin text-ink/40" />
        <p className="text-xs">テストを準備中...</p>
      </div>
    );
  }

  if (resumePrompt) {
    const isDailyCheck = sessionType === 'daily_check';
    return (
      <div className="mx-auto flex min-h-[85vh] max-w-md md:max-w-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-full rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-300">
            <RotateCcw className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-mincho text-xl font-bold text-ink">
              前回の続きから再開しますか？
            </h2>
            <p className="mt-1.5 font-maru text-xs text-ink/60 leading-relaxed">
              前回の中断データが見つかりました。<br />
              <strong className="text-ink font-bold">
                {resumePrompt.answeredCount} / {cards.length} 語
              </strong> まで回答済みです。
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setInitialAnswers(resumePrompt.answeredMap);
                setInitialIndex(resumePrompt.answeredCount);
                setResumePrompt(null);
              }}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer hover:bg-ink/90"
            >
              <Play className="h-4 w-4 fill-paper" />
              <span>続きから再開する（{resumePrompt.answeredCount + 1}問目〜）</span>
            </button>

            {!isDailyCheck ? (
              <button
                type="button"
                onClick={() => {
                  setInitialAnswers(new Map());
                  setInitialIndex(0);
                  setResumePrompt(null);
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line bg-paper font-maru text-xs font-medium text-ink/70 transition hover:bg-paper-hover active:scale-98 cursor-pointer"
              >
                最初からやり直す
              </button>
            ) : (
              <p className="font-maru text-[11px] text-ink/40 pt-1">
                ※ 本番チェックは1日1回限定のため、続きからのみ受験可能です
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resultData) {
    if (isReviewDay && resultData.chunkResults) {
      return (
        <ChunkSummaryScreen
          totalCorrect={resultData.correctCount}
          totalCount={resultData.totalCount}
          chunkResults={resultData.chunkResults}
        />
      );
    }

    return (
      <TestResultScreen
        correctCount={resultData.correctCount}
        totalCount={resultData.totalCount}
        wrongCards={resultData.wrongCards}
        sessionType={sessionType}
        saveStatus={saveStatus}
      />
    );
  }

  return (
    <WordJudgeCardScreen
      cards={cards}
      initialIndex={initialIndex}
      initialAnswers={initialAnswers}
      onJudge={handleSingleJudge}
      onFinished={handleFinished}
      title={sessionType === 'daily_check' ? '本日のテスト結果' : '苦手克服テスト結果'}
    />
  );
}

```

---

## components/theme/ThemeProvider.tsx

```tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'washi' | 'dark-purple';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'washi',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('washi');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('tango_theme') as ThemeMode | null;
    if (saved === 'dark-purple' || saved === 'washi') {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('tango_theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

```

---

## components/theme/ThemeSelector.tsx

```tsx
'use client';

import React from 'react';
import { useTheme, type ThemeMode } from './ThemeProvider';
import { CheckCircle2, Moon, Sun } from 'lucide-react';

interface ThemeOption {
  id: ThemeMode;
  name: string;
  subtitle: string;
  description: string;
  icon: any;
  previewClass: string;
  borderClass: string;
  palette: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'washi',
    name: '和紙 (既定)',
    subtitle: 'Washi Cream & Sumi Ink',
    description: '生成りの和紙と墨、朱糸の伝統的な学習帳配色。日中の学習に最適です。',
    icon: Sun,
    previewClass: 'bg-[#F5F4EF]',
    borderClass: 'border-[#D8D3C4]',
    palette: ['#F5F4EF', '#FFFFFF', '#232A3B', '#E2483D', '#F5C84C'],
  },
  {
    id: 'dark-purple',
    name: '紫夜 (新テーマ)',
    subtitle: 'Obsidian Purple & Violet Light',
    description: '漆黒の紫紺に藤色の文字が映えるダークテーマ。夜間の集中学習に最適です。',
    icon: Moon,
    previewClass: 'bg-[#120E1C]',
    borderClass: 'border-[#34274F]',
    palette: ['#120E1C', '#1E172E', '#F3EEFA', '#FF5353', '#F7C948'],
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5">
        {THEME_OPTIONS.map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;

          return (
            <div
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99] ${
                isSelected
                  ? 'border-akashiito bg-paper-card ring-2 ring-akashiito shadow-sm'
                  : 'border-line bg-paper-card hover:bg-paper-hover'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  {/* テーマアイコン */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isSelected
                        ? 'bg-akashiito text-white shadow-2xs'
                        : 'bg-paper text-ink-muted border border-line'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* テキスト説明 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-mincho text-base font-bold text-ink">
                        {opt.name}
                      </h3>
                      {isSelected && (
                        <span className="rounded-full bg-akashiito/10 border border-akashiito/30 px-2 py-0.2 font-maru text-[10px] font-bold text-akashiito">
                          適用中
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-ink-muted uppercase">
                      {opt.subtitle}
                    </p>
                    <p className="font-maru text-xs text-ink/70 leading-relaxed pt-0.5">
                      {opt.description}
                    </p>

                    {/* カラースウォッチパレット */}
                    <div className="flex items-center gap-1.5 pt-2">
                      {opt.palette.map((color, i) => (
                        <span
                          key={i}
                          style={{ backgroundColor: color }}
                          className="h-4 w-4 rounded-full border border-line/40 shadow-2xs inline-block"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* チェックマーク */}
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-akashiito shrink-0 mt-0.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

```

---

## components/weakness/ChunkSummaryScreen.tsx

```tsx
'use client';

import React from 'react';
import Link from 'next/link';

export interface ChunkResultItem {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  correctCount: number;
  totalCount: number;
  accuracyRate: number; // 0..100 (%)
  prevAccuracyRate: number | null; // 0..100 (%)
  status: 'improved' | 'same' | 'worse' | 'first';
}

interface ChunkSummaryScreenProps {
  totalCorrect: number;
  totalCount: number;
  chunkResults: ChunkResultItem[];
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

export function ChunkSummaryScreen({
  totalCorrect,
  totalCount,
  chunkResults,
}: ChunkSummaryScreenProps) {
  const overallAccuracy = totalCount > 0 ? Math.round((totalCorrect / totalCount) * 100) : 0;

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between p-6 md:p-8 lg:p-10 bg-paper max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full">
      <div className="space-y-6">
        <div className="text-center pt-4">
          <span className="inline-block rounded-full bg-highlighter/40 px-3 py-1 font-maru text-xs font-bold text-ink mb-2">
            総復習テスト完了 🎉
          </span>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">今週の復習サマリー</h1>
          <p className="mt-1 font-maru text-xs md:text-sm text-ink/60">
            各範囲の定着度を確認して、着実にステップアップしていきましょう
          </p>

          <div className="mt-5 rounded-3xl border border-line bg-white p-5 md:p-6 shadow-sm text-center">
            <span className="font-maru text-xs md:text-sm text-ink/50 block">全体の正答率</span>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-mincho text-4xl md:text-5xl font-bold tracking-tight text-ink">
                {overallAccuracy}%
              </span>
              <span className="font-maru text-xs md:text-sm font-bold text-ink/50">
                ({totalCorrect} / {totalCount}語)
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60 px-1">範囲ごとの定着状況</h2>
          <div className="space-y-2">
            {chunkResults.map((chunk) => {
              let badgeText = '初測定';
              let badgeClass = 'bg-line/20 text-ink/60 border-line/40';

              if (chunk.status === 'improved') {
                badgeText = '定着向上 ↑';
                badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
              } else if (chunk.status === 'same') {
                badgeText = '維持 →';
                badgeClass = 'bg-paper text-ink/70 border-line font-medium';
              } else if (chunk.status === 'worse') {
                badgeText = '要復習 ⚠️';
                badgeClass = 'bg-akashiito/15 text-akashiito border-akashiito-border font-bold';
              }

              return (
                <div
                  key={chunk.chunkId}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition ${
                    chunk.status === 'worse'
                      ? 'border-akashiito-border/80 bg-akashiito/5'
                      : 'border-line bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mincho text-sm md:text-base font-bold text-ink">
                        No.{chunk.rangeStart}〜{chunk.rangeEnd}
                      </span>
                      <span className="font-maru text-[10px] md:text-xs text-ink/40">
                        ({formatDateShort(chunk.originDate)})
                      </span>
                    </div>
                    <p className="mt-0.5 font-maru text-xs md:text-sm text-ink/60">
                      正解 {chunk.correctCount}/{chunk.totalCount}語 ({chunk.accuracyRate}%)
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs ${badgeClass}`}>
                      {badgeText}
                    </span>
                    {chunk.prevAccuracyRate !== null && (
                      <span className="block mt-0.5 font-maru text-[10px] text-ink/40">
                        前回正答率 {chunk.prevAccuracyRate}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-6 pb-2">
        <Link
          href="/dashboard"
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}

```

---

## components/weakness/DrillFilterDialog.tsx

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Clock, Layers, X, Play } from 'lucide-react';

interface DrillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  originAssignmentId?: string; // チャンク指定の場合
}

export function DrillFilterDialog({
  isOpen,
  onClose,
  title,
  originAssignmentId,
}: DrillFilterDialogProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<'all' | 'mistakes' | 'recent'>('all');
  const [limit, setLimit] = useState<number>(10);
  const [days, setDays] = useState<number>(7);

  if (!isOpen) return null;

  const handleStart = () => {
    let url = '/test?mode=normal';
    if (originAssignmentId) {
      url += `&originAssignmentId=${encodeURIComponent(originAssignmentId)}`;
    } else {
      url += '&weak=true';
    }

    url += `&filter=${filterMode}`;
    if (filterMode !== 'all') {
      url += `&limit=${limit}`;
    }
    if (filterMode === 'recent') {
      url += `&days=${days}`;
    }

    onClose();
    router.push(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-5 text-left animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between border-b border-line/60 pb-3">
          <div>
            <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
              WEAKNESS DRILL
            </span>
            <h3 className="font-mincho text-lg font-bold text-ink">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. モード選択 */}
        <div className="space-y-2">
          <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
            絞り込みモードを選択
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === 'all'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span className="font-maru text-xs">すべて</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('mistakes')}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === 'mistakes'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }`}
            >
              <Flame className="h-4 w-4 text-akashiito" />
              <span className="font-maru text-xs">ミス多順</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('recent')}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === 'recent'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }`}
            >
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-maru text-xs">直近ミス</span>
            </button>
          </div>
        </div>

        {/* 2. 出題数選択 (ミス多順 または 直近ミス選択時) */}
        {filterMode !== 'all' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              出題する単語数
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setLimit(count)}
                  className={`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 ${
                    limit === count
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }`}
                >
                  {count} 語
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. 期間選択 (直近ミス選択時のみ) */}
        {filterMode === 'recent' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              間違えた対象期間
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '直近 3 日以内', value: 3 },
                { label: '直近 7 日以内', value: 7 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDays(item.value)}
                  className={`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 ${
                    days === item.value
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 開始ボタン */}
        <button
          type="button"
          onClick={handleStart}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-98 hover:bg-ink/90 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-paper" />
          <span>
            {filterMode === 'all'
              ? 'すべての苦手単語でスタート'
              : `${filterMode === 'mistakes' ? 'ミスが多い順に' : '直近で間違えた単語を'} ${limit}語 特訓する`}
          </span>
        </button>
      </div>
    </div>
  );
}

```

---

## components/weakness/WeaknessBottomSheet.tsx

```tsx
'use client';

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
  return `${m}/${d}`;
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
      label = `${baseDate}(${currentOccur})`;
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
          (acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
          ''
        )
      : '';

  return (
    <div className="py-1">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-20 w-full overflow-visible">
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
          style={{ transform: `translateY(${dragY}px)` }}
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
                    {hasAttempts ? `${accuracy}%` : '—'}
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
        title={`No.${chunk.rangeStart}〜${chunk.rangeEnd} の苦手克服`}
        originAssignmentId={chunk.chunkId}
      />
    </>
  );
}

```

---

## components/weakness/WeaknessChunkTile.tsx

```tsx
'use client';

import React from 'react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessChunkTileProps {
  chunk: ChunkStat;
  onClick: (chunk: ChunkStat) => void;
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
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
      className={`relative flex min-h-[120px] min-w-[130px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] hover:shadow-xs cursor-pointer ${styleClass}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="font-maru text-[11px] font-bold text-ink/60">
            {formatDateLabel(chunk.originDate)}
          </span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${badgeStyle}`}>
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
            {hasAttempts ? `${accuracy}%` : '—'}
          </span>
        </div>
        <span className="font-maru text-[10px] text-ink/50">
          {hasAttempts ? `${totalSessionsCount}回受験` : '未受験'}
        </span>
      </div>
    </button>
  );
};

```

---

## components/weakness/WeaknessMapClient.tsx

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';
import { WeaknessChunkTile } from './WeaknessChunkTile';
import { WeaknessBottomSheet } from './WeaknessBottomSheet';
import { DrillFilterDialog } from './DrillFilterDialog';

interface WeaknessMapClientProps {
  chunks: ChunkStat[];
  wordbookName: string;
}

export function WeaknessMapClient({ chunks, wordbookName }: WeaknessMapClientProps) {
  const [selectedChunk, setSelectedChunk] = useState<ChunkStat | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const totalChunks = chunks.length;
  const attentionCount = chunks.filter((c) => c.needsAttention).length;
  const totalMistakes = chunks.reduce((acc, c) => acc + c.mistakeWords.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">弱点マップ</h1>
            <p className="font-maru text-xs md:text-sm text-ink/50 mt-0.5">
              {wordbookName || '単語帳'} の進度と定着傾向
            </p>
          </div>
        </div>
      </div>

      {/* 3つの統計サマリーカード */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">総学習範囲</span>
          <span className="font-mincho text-xl font-bold text-ink">{totalChunks}</span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">チャンク</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">要注意範囲</span>
          <span className={`font-mincho text-xl font-bold ${attentionCount > 0 ? 'text-akashiito' : 'text-ink'}`}>
            {attentionCount}
          </span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">箇所</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-3 text-center shadow-xs">
          <span className="block font-maru text-[10px] text-ink/50">苦手単語数</span>
          <span className="font-mincho text-xl font-bold text-ink">{totalMistakes}</span>
          <span className="font-maru text-[10px] text-ink/40 ml-0.5">語</span>
        </div>
      </div>

      {/* タイル一覧 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">学習範囲タイル一覧</h2>
          <span className="font-maru text-[10px] text-ink/40">タップして詳細・単語を確認</span>
        </div>

        {chunks.length === 0 ? (
          <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-xs">
            <p className="font-mincho text-base font-bold text-ink/70">まだ学習記録がありません</p>
            <p className="mt-1 font-maru text-xs text-ink/40">
              デイリーテストを進めると、ここに弱点分析が表示されます
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {chunks.map((chunk) => (
              <WeaknessChunkTile
                key={chunk.chunkId}
                chunk={chunk}
                onClick={setSelectedChunk}
              />
            ))}
          </div>
        )}
      </section>

      {/* 苦手克服テスト開始ボタン */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setIsFilterDialogOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90 cursor-pointer"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>単語帳全体の苦手克服テストを始める</span>
        </button>
      </div>

      {/* 詳細ボトムシート */}
      <WeaknessBottomSheet
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
      />

      {/* 全体用絞り込みダイアログ */}
      <DrillFilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        title="単語帳全体の苦手克服テスト"
      />
    </div>
  );
}

```

---

## components/weekly-range/CycleSettingsPanel.tsx

```tsx
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

```

---

## components/weekly-range/DaySequenceEditor.tsx

```tsx
'use client';

import type { DayType } from '@/lib/assignment/cycleTypes';

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];
const TYPE_ORDER: DayType[] = ['new', 'review', 'off'];
const TYPE_LABEL: Record<DayType, string> = { new: '新規', review: '復習', off: '休み' };
const TYPE_STYLE: Record<DayType, string> = {
  new: 'bg-paper border-ink text-ink font-medium',
  review: 'bg-highlighter/50 border-highlighter text-ink font-bold shadow-sm',
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
          className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-xs transition active:scale-95 ${TYPE_STYLE[value[i]]}`}
        >
          <span className="font-maru text-xs">{label}</span>
          <span className="mt-0.5 text-[10px]">{TYPE_LABEL[value[i]]}</span>
        </button>
      ))}
    </div>
  );
}

```

---

## components/weekly-range/WeeklyPreviewPanel.tsx

```tsx
'use client';

import type { PreviewDay } from '@/lib/assignment/calculateWeeklyPreview';

const TYPE_BADGE: Record<PreviewDay['type'], { label: string; className: string }> = {
  new: { label: '新規進捗', className: 'bg-paper text-ink border-line font-medium' },
  review: { label: '総復習', className: 'bg-[#E6F7F2] text-[#136C56] border-[#9FE1CB] font-bold shadow-2xs' },
  off: { label: '休み', className: 'bg-line/30 text-ink/40 border-line' },
};

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
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
              <span className={`rounded-full border px-2.5 py-0.5 text-xs ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <span className="font-maru text-sm font-bold text-ink">
              {day.rangeStart !== null ? `No.${day.rangeStart} 〜 No.${day.rangeEnd}` : '休み'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

```

---

## components/weekly-range/WeeklyRangeModal.tsx

```tsx
'use client';

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
            className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'settings' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
            }`}
          >
            ⚙️ ペース設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition cursor-pointer ${
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
            className="min-h-[50px] w-full rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-98 disabled:opacity-40 cursor-pointer hover:bg-ink/90"
          >
            {isSubmitting ? '保存中…' : `保存してスケジュールを確定 (No.${rangeStart}〜No.${preview.calculatedEnd})`}
          </button>
        </div>
      </div>
    </div>
  );
}

```

---

## components/wordbook/WordbookSelector.tsx

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Book, CheckCircle2 } from "lucide-react";
import type { Wordbook } from "@/types";

interface WordbookSelectorProps {
  wordbooks: Wordbook[];
  currentWordbookId?: string | null;
  redirectPath?: string;
}

export const WordbookSelector: React.FC<WordbookSelectorProps> = ({
  wordbooks,
  currentWordbookId = null,
  redirectPath = "/dashboard",
}) => {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    currentWordbookId || (wordbooks[0]?.id ?? null)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/users/wordbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordbookId: selectedId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "設定に失敗しました");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {wordbooks.map((wb) => {
          const isSelected = selectedId === wb.id;
          return (
            <div
              key={wb.id}
              onClick={() => setSelectedId(wb.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                isSelected
                  ? "border-akashiito bg-akashiito-subtle/40 ring-1 ring-akashiito"
                  : "border-line bg-paper-card hover:bg-paper-hover"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      isSelected
                        ? "bg-akashiito text-white"
                        : "bg-paper text-ink-muted border border-line"
                    }`}
                  >
                    <Book className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-mincho text-base font-bold text-ink">{wb.name}</h3>
                    <p className="font-number text-xs text-ink-muted">収録語数: {wb.total_words} 語</p>
                  </div>
                </div>

                {isSelected && <CheckCircle2 className="h-5 w-5 text-akashiito" />}
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="primary" size="lg" onClick={handleSave} disabled={!selectedId} isLoading={loading}>
        この単語帳で決定する
      </Button>
    </div>
  );
};

```

---

## lib/assignment/buildDailyAssignmentRows.ts

```ts
import type { PreviewDay } from './calculateWeeklyPreview';

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

```

---

## lib/assignment/calculateAssignments.ts

```ts
import { getWeekDates, DAY_LABELS_SAT } from './weekDates';

export type DayType = 'progress' | 'review' | 'rest';

export interface CalculatedDay {
  date: string;
  dayLabel: string;
  dayType: DayType;
  rangeStart: number | null;
  rangeEnd: number | null;
  wordCount: number;
}

export interface CalculateParams {
  weekStartDate: string;
  startNumber: number;
  wordsPerDay: number;
  pattern: '5-2' | '4-3' | 'custom';
  daySequence?: DayType[];
  totalWords?: number;
}

export function calculateWeeklyAssignments(params: CalculateParams): CalculatedDay[] {
  const { weekStartDate, startNumber, wordsPerDay, pattern, totalWords = 2000 } = params;
  const dates = getWeekDates(weekStartDate);

  let sequence: DayType[] = [];
  if (pattern === '5-2') {
    sequence = ['progress', 'progress', 'progress', 'progress', 'progress', 'review', 'review'];
  } else if (pattern === '4-3') {
    sequence = ['progress', 'progress', 'progress', 'progress', 'review', 'review', 'review'];
  } else {
    sequence = params.daySequence ?? ['progress', 'progress', 'progress', 'progress', 'progress', 'review', 'review'];
  }

  let currentStart = startNumber;
  let weekProgressStart: number | null = null;
  let weekProgressEnd: number | null = null;

  const result: CalculatedDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = dates[i];
    const dayLabel = DAY_LABELS_SAT[i];
    const dayType = sequence[i] ?? 'progress';

    if (dayType === 'progress') {
      const pStart = currentStart;
      const pEnd = Math.min(pStart + wordsPerDay - 1, totalWords);
      const count = pEnd >= pStart ? pEnd - pStart + 1 : 0;

      if (weekProgressStart === null) weekProgressStart = pStart;
      weekProgressEnd = pEnd;
      currentStart = pEnd + 1;

      result.push({
        date,
        dayLabel,
        dayType,
        rangeStart: pStart,
        rangeEnd: pEnd,
        wordCount: count,
      });
    } else if (dayType === 'review') {
      const rStart = weekProgressStart ?? startNumber;
      const rEnd = weekProgressEnd ?? (startNumber + wordsPerDay - 1);
      const count = rEnd >= rStart ? rEnd - rStart + 1 : 0;

      result.push({
        date,
        dayLabel,
        dayType,
        rangeStart: rStart,
        rangeEnd: rEnd,
        wordCount: count,
      });
    } else {
      result.push({
        date,
        dayLabel,
        dayType: 'rest',
        rangeStart: null,
        rangeEnd: null,
        wordCount: 0,
      });
    }
  }

  return result;
}

```

---

## lib/assignment/calculateWeeklyPreview.ts

```ts
import { resolveDayTypes, CYCLE_DAY_LABELS, type CycleType, type DayType } from './cycleTypes';

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

```

---

## lib/assignment/cycleTypes.ts

```ts
export type DayType = 'new' | 'review' | 'off';
export type CycleType = 'five_two' | 'four_three' | 'custom';

// 曜日順は 土,日,月,火,水,木,金 固定（土曜起点）
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
  throw new Error(`不明な cycleType: ${cycleType}`);
}

```

---

## lib/assignment/generateDailyAssignments.ts

```ts
import { getWeekDates } from './weekDates';

export type DayType = 'learn' | 'review' | 'off';

export interface DayScheduleConfig {
  dayIndex: number; // 0=土, 1=日, 2=月, 3=火, 4=水, 5=木, 6=金
  type: DayType;
}

export interface DailyAssignmentRow {
  user_id: string;
  wordbook_id: string;
  date: string; // YYYY-MM-DD
  range_start: number;
  range_end: number;
  is_review_day: boolean;
}

export interface GenerateAssignmentParams {
  userId: string;
  wordbookId: string;
  weekStartDate: string; // 土曜日の日付 YYYY-MM-DD
  rangeStart: number;
  wordsPerDay: number;
  patternType?: '5_2' | '4_3' | 'custom';
  customDays?: DayType[]; // 長さ7の配列 (土〜金)
  maxWordsLimit?: number; // 単語帳の total_words
}

/**
 * 週間計画から各曜日の割当(daily_assignments)を生成する
 */
export function generateDailyAssignmentRows(
  params: GenerateAssignmentParams
): { rows: DailyAssignmentRow[]; calculatedRangeEnd: number; totalWords: number } {
  const {
    userId,
    wordbookId,
    weekStartDate,
    rangeStart,
    wordsPerDay,
    patternType = '5_2',
    customDays,
    maxWordsLimit = Infinity,
  } = params;

  const weekDates = getWeekDates(weekStartDate);

  // 曜日ごとのタイプ決定 (土〜金)
  let dayTypes: DayType[] = ['learn', 'learn', 'learn', 'learn', 'learn', 'review', 'review'];

  if (patternType === '4_3') {
    dayTypes = ['learn', 'learn', 'learn', 'learn', 'review', 'review', 'review'];
  } else if (patternType === 'custom' && customDays && customDays.length === 7) {
    dayTypes = customDays;
  }

  const rows: DailyAssignmentRow[] = [];
  let currentStart = rangeStart;
  const learnDayIndices: number[] = [];

  // 1. 新規学習日の割り当て
  dayTypes.forEach((type, index) => {
    if (type === 'learn') {
      learnDayIndices.push(index);
      const start = currentStart;
      let end = start + wordsPerDay - 1;
      if (end > maxWordsLimit) {
        end = maxWordsLimit;
      }
      if (start <= maxWordsLimit) {
        rows.push({
          user_id: userId,
          wordbook_id: wordbookId,
          date: weekDates[index],
          range_start: start,
          range_end: end,
          is_review_day: false,
        });
      }
      currentStart = end + 1;
    }
  });

  const calculatedRangeEnd = Math.min(
    maxWordsLimit,
    Math.max(rangeStart, currentStart - 1)
  );
  const totalWords = Math.max(0, calculatedRangeEnd - rangeStart + 1);

  // 2. 復習日の割り当て（今週進んだ範囲全体を復習）
  dayTypes.forEach((type, index) => {
    if (type === 'review' && totalWords > 0) {
      rows.push({
        user_id: userId,
        wordbook_id: wordbookId,
        date: weekDates[index],
        range_start: rangeStart,
        range_end: calculatedRangeEnd,
        is_review_day: true,
      });
    }
  });

  // 日付順にソート
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return { rows, calculatedRangeEnd, totalWords };
}

```

---

## lib/assignment/weekDates.ts

```ts
/**
 * 日本時間(Asia/Tokyo)基準の日付計算ユーティリティ
 * 週のサイクルは「土曜日始まり・金曜日終わり」の7日間
 */

export const DAY_LABELS_SAT = ['土', '日', '月', '火', '水', '木', '金'] as const;

export function getTodayJST(): string {
  const now = new Date();
  return now.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 指定日(YYYY-MM-DD)の前日(-1日)の日付(YYYY-MM-DD)を返す */
export function getYesterday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** 指定日(YYYY-MM-DD)が属する「土曜始まりの週」の土曜日の日付を返す */
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
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(saturday);
    dt.setUTCDate(saturday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

```

---

## lib/scoring/computeDailyScore.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDifficultyStages } from '@/lib/streak/updateWordCorrectStreaks';

const FULL_VALUE_THRESHOLD = 20;
const REFERENCE_MAX_SCORE = 20;
const MAX_WEIGHT = 1.5;
const MIN_WEIGHT = 0.5;

/**
 * 単語の習熟度ステージ (0〜6) に応じた難易度重みを計算する
 * ステージ0 (未習熟/新出) ほど重く (1.5), ステージ6 (定着済み) ほど軽く (0.5) する
 */
export function difficultyWeight(stage: number): number {
  const clamped = Math.min(Math.max(0, stage), 6);
  return MAX_WEIGHT - (MAX_WEIGHT - MIN_WEIGHT) * (clamped / 6);
}

/**
 * 逓減係数を計算する (20語までは満額 1.0、それ以降は平方根で緩やかに逓減)
 */
export function diminishingReturnFactor(
  orderIndexToday: number,
  fullValueThreshold = FULL_VALUE_THRESHOLD
): number {
  if (orderIndexToday <= fullValueThreshold) return 1.0;
  return Math.sqrt(fullValueThreshold / orderIndexToday);
}

/**
 * 単一単語の獲得スコアを計算する
 */
export function scoreForWord(
  isCorrect: boolean,
  stage: number,
  orderIndexToday: number
): number {
  if (!isCorrect) return 0;
  return difficultyWeight(stage) * diminishingReturnFactor(orderIndexToday);
}

export interface ComputeScoreParams {
  supabase: SupabaseClient;
  userId: string;
  date: string;
  answers: Array<{ wordId: string; isKnown: boolean }>;
}

export interface ComputedDailyScoreResult {
  userId: string;
  date: string;
  rawScore: number;
  normalizedScore: number;
  wordCount: number;
  accuracyRate: number;
  avgDifficultyWeight: number;
  avgDiminishingFactor: number;
}

/**
 * 本番デイリーチェックのスコアを算出して daily_score_entries に永続化する
 */
export async function computeAndSaveDailyScore(
  params: ComputeScoreParams
): Promise<ComputedDailyScoreResult | null> {
  const { supabase, userId, date, answers } = params;
  if (!answers || answers.length === 0) return null;

  // 1. word_id の重複を除き、初回出現順を対象にする
  const uniqueAnswers: Array<{ wordId: string; isKnown: boolean }> = [];
  const seenWordIds = new Set<string>();

  for (const ans of answers) {
    if (!seenWordIds.has(ans.wordId)) {
      seenWordIds.add(ans.wordId);
      uniqueAnswers.push({ wordId: ans.wordId, isKnown: ans.isKnown });
    }
  }

  const wordIds = uniqueAnswers.map((a) => a.wordId);
  const wordCount = wordIds.length;
  if (wordCount === 0) return null;

  // 2. getDifficultyStages で対象 word_id のステージを一括取得 (0〜6)
  const stagesMap = await getDifficultyStages(supabase, userId, wordIds);

  let rawScore = 0;
  let correctCount = 0;
  let totalDifficultyWeight = 0;
  let totalDiminishingFactor = 0;

  uniqueAnswers.forEach((item, index) => {
    const orderIndex = index + 1; // 1-based index
    const stage = stagesMap.get(item.wordId) ?? 0;
    const dWeight = difficultyWeight(stage);
    const dFactor = diminishingReturnFactor(orderIndex);

    totalDifficultyWeight += dWeight;
    totalDiminishingFactor += dFactor;

    if (item.isKnown) {
      correctCount += 1;
      rawScore += dWeight * dFactor;
    }
  });

  // 3. 正規化スコア (0〜100) の算出 (REFERENCE_MAX_SCORE = 20 を基準値とする)
  const normalizedScore = Math.min(
    100,
    Math.round((rawScore / REFERENCE_MAX_SCORE) * 100)
  );

  const accuracyRate =
    wordCount > 0 ? Math.round((correctCount / wordCount) * 10000) / 10000 : 0;
  const avgDifficultyWeight =
    wordCount > 0
      ? Math.round((totalDifficultyWeight / wordCount) * 10000) / 10000
      : 1.0;
  const avgDiminishingFactor =
    wordCount > 0
      ? Math.round((totalDiminishingFactor / wordCount) * 10000) / 10000
      : 1.0;
  const rawScoreRounded = Math.round(rawScore * 10000) / 10000;

  // 4. daily_score_entries に upsert
  const { error: upsertError } = await supabase
    .from('daily_score_entries')
    .upsert(
      {
        user_id: userId,
        date: date,
        raw_score: rawScoreRounded,
        normalized_score: normalizedScore,
        word_count: wordCount,
        accuracy_rate: accuracyRate,
        avg_difficulty_weight: avgDifficultyWeight,
        avg_diminishing_factor: avgDiminishingFactor,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

  if (upsertError) {
    console.error('Failed to upsert daily_score_entries:', upsertError);
  }

  return {
    userId,
    date,
    rawScore: rawScoreRounded,
    normalizedScore,
    wordCount,
    accuracyRate,
    avgDifficultyWeight,
    avgDiminishingFactor,
  };
}

```

---

## lib/scoring/determineArchetype.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailyScoreEntryData {
  user_id: string;
  date: string;
  raw_score: number;
  normalized_score: number;
  word_count: number;
  accuracy_rate: number;
  avg_difficulty_weight: number;
  avg_diminishing_factor: number;
}

export interface ArchetypeResult {
  key: string;
  badgeLabel: string;
  title: string;
  message: string;
  colorClass: string;
}

/**
 * メンバーのスコア系アーキタイプをインメモリで同期判定する (N+1ネットワーク遅延を完全解消)
 */
export function determineArchetype(
  targetUserId: string,
  allGroupEntriesForDate: DailyScoreEntryData[],
  recentScoresForUser: number[] = []
): ArchetypeResult | null {
  const self = allGroupEntriesForDate.find((e) => e.user_id === targetUserId);
  if (!self) return null;

  // 1. ゾンビ・グリット型 (物量突破)
  if (self.normalized_score >= 85 && (self.accuracy_rate ?? 0) < 0.65) {
    return {
      key: 'zombie_grit',
      badgeLabel: '物量突破',
      title: 'ゾンビ・グリット型',
      message: '正解の数で押し切った、物量の勝利。',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    };
  }

  // 2. レジェンド・コレクター型 (高難度制覇)
  if (
    (self.accuracy_rate ?? 0) >= 0.9 &&
    (self.avg_difficulty_weight ?? 0) >= 1.2 &&
    (self.word_count ?? 0) >= 15
  ) {
    return {
      key: 'legend_collector',
      badgeLabel: '高難度制覇',
      title: 'レジェンド・コレクター型',
      message: '手強い単語だけを、高精度で撃破。',
      colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    };
  }

  // 3. パーフェクト・スナイパー型 (精密無比)
  if (
    (self.accuracy_rate ?? 0) >= 0.95 &&
    self.normalized_score < 55 &&
    (self.word_count ?? 0) >= 5
  ) {
    return {
      key: 'perfect_sniper',
      badgeLabel: '精密無比',
      title: 'パーフェクト・スナイパー型',
      message: '少数精鋭、狙った的を外さない。',
      colorClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    };
  }

  // 4. タイブレーク・チャンピオン型 (僅差の覇者)
  const tiedOthers = allGroupEntriesForDate.filter(
    (e) => e.user_id !== targetUserId && e.normalized_score === self.normalized_score
  );
  if (tiedOthers.length > 0) {
    const maxOtherRaw = Math.max(...tiedOthers.map((e) => Number(e.raw_score ?? 0)));
    if (Number(self.raw_score) > maxOtherRaw) {
      return {
        key: 'tiebreak_champion',
        badgeLabel: '僅差の覇者',
        title: 'タイブレーク・チャンピオン型',
        message: '同着の中身で、一歩リード。',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    }
  }

  // 5. 急成長型 (自己ベスト更新)
  if (recentScoresForUser.length >= 3) {
    const sum = recentScoresForUser.reduce((acc, score) => acc + score, 0);
    const avg = sum / recentScoresForUser.length;
    if (self.normalized_score - avg >= 20) {
      return {
        key: 'rapid_growth',
        badgeLabel: '自己ベスト更新',
        title: '急成長型',
        message: '直近の自分を、大きく更新。',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-300',
      };
    }
  }

  return null;
}

```

---

## lib/srs/buildReviewQueue.ts

```ts
import { ReviewQueueItem } from './types';

interface DueReviewItem {
  id: string;
  stage: number;
  ease_factor: number;
  wrong_count: number;
  interval_days: number;
  words: {
    id: string;
    word: string;
    meaning: string;
    pronunciation?: string | null;
    example_sentences?: Array<{ text: string; translation?: string | null }>;
  };
}

interface NewWordCandidate {
  id: string;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  example_sentences?: Array<{ text: string; translation?: string | null }>;
}

export function generate4Choices(
  correctMeaning: string,
  distractorPool: string[]
): { choices: string[]; correctChoiceIndex: number } {
  const filtered = distractorPool.filter((m) => m && m !== correctMeaning);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const selectedDistractors = shuffled.slice(0, 3);

  const fallback = [
    '考慮する・検討する',
    '維持する・継続する',
    '達成する・成し遂げる',
    '要求する・必要とする',
    '改善する・向上させる',
  ];
  let fallbackIdx = 0;
  while (selectedDistractors.length < 3) {
    const candidate = fallback[fallbackIdx % fallback.length];
    if (candidate !== correctMeaning && !selectedDistractors.includes(candidate)) {
      selectedDistractors.push(candidate);
    }
    fallbackIdx++;
  }

  const choices = [correctMeaning, ...selectedDistractors].sort(() => Math.random() - 0.5);
  const correctChoiceIndex = choices.indexOf(correctMeaning);
  return { choices, correctChoiceIndex };
}

export function buildInterleavedQueue(
  dueReviews: DueReviewItem[],
  newCandidates: NewWordCandidate[],
  distractorPool: string[],
  maxTotal = 20
): ReviewQueueItem[] {
  const queue: ReviewQueueItem[] = [];
  let rIdx = 0;
  let nIdx = 0;

  while (
    (rIdx < dueReviews.length || nIdx < newCandidates.length) &&
    queue.length < maxTotal
  ) {
    let reviewsAdded = 0;
    while (rIdx < dueReviews.length && reviewsAdded < 4 && queue.length < maxTotal) {
      const item = dueReviews[rIdx];
      const ex = item.words?.example_sentences?.[0] || null;
      queue.push({
        queueId: `review-${item.words.id}-${Date.now()}-${Math.random()}`,
        wordId: item.words.id,
        word: item.words.word,
        meaning: item.words.meaning,
        pronunciation: item.words.pronunciation,
        format: 'review',
        exampleSentence: ex ? { text: ex.text, translation: ex.translation } : null,
        stage: item.stage,
        easeFactor: item.ease_factor,
        wrongCount: item.wrong_count,
      });
      rIdx++;
      reviewsAdded++;
    }

    if (nIdx < newCandidates.length && queue.length < maxTotal) {
      const nItem = newCandidates[nIdx];
      const ex = nItem.example_sentences?.[0] || null;
      const { choices, correctChoiceIndex } = generate4Choices(nItem.meaning, distractorPool);
      queue.push({
        queueId: `new-${nItem.id}-${Date.now()}-${Math.random()}`,
        wordId: nItem.id,
        word: nItem.word,
        meaning: nItem.meaning,
        pronunciation: nItem.pronunciation,
        format: 'new',
        exampleSentence: ex ? { text: ex.text, translation: ex.translation } : null,
        choices,
        correctChoiceIndex,
      });
      nIdx++;
    }

    if (rIdx >= dueReviews.length && nIdx < newCandidates.length) {
      while (nIdx < newCandidates.length && queue.length < maxTotal) {
        const nItem = newCandidates[nIdx];
        const ex = nItem.example_sentences?.[0] || null;
        const { choices, correctChoiceIndex } = generate4Choices(nItem.meaning, distractorPool);
        queue.push({
          queueId: `new-${nItem.id}-${Date.now()}-${Math.random()}`,
          wordId: nItem.id,
          word: nItem.word,
          meaning: nItem.meaning,
          pronunciation: nItem.pronunciation,
          format: 'new',
          exampleSentence: ex ? { text: ex.text, translation: ex.translation } : null,
          choices,
          correctChoiceIndex,
        });
        nIdx++;
      }
    }
  }

  return queue;
}

export function insertRetryItem(
  currentQueue: ReviewQueueItem[],
  currentIndex: number,
  distractorPool: string[]
): ReviewQueueItem[] {
  const currentItem = currentQueue[currentIndex];
  if (!currentItem) return currentQueue;

  const retryItem: ReviewQueueItem = {
    ...currentItem,
    queueId: `${currentItem.wordId}-retry-${Date.now()}`,
    isRetry: true,
  };

  if (retryItem.format === 'new') {
    const { choices, correctChoiceIndex } = generate4Choices(retryItem.meaning, distractorPool);
    retryItem.choices = choices;
    retryItem.correctChoiceIndex = correctChoiceIndex;
  }

  const offset = 5 + Math.floor(Math.random() * 5);
  const targetIndex = currentIndex + 1 + offset;

  const newQueue = [...currentQueue];
  if (targetIndex >= newQueue.length) {
    newQueue.push(retryItem);
  } else {
    newQueue.splice(targetIndex, 0, retryItem);
  }
  return newQueue;
}

```

---

## lib/srs/dates.ts

```ts
export function getTodayJST(): string {
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return jstFormatter.format(now);
}

export function addDaysJST(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 0, 0, 0));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isYesterdayJST(prevDateStr: string | null, todayStr: string): boolean {
  if (!prevDateStr) return false;
  return prevDateStr === addDaysJST(todayStr, -1);
}

```

---

## lib/srs/homeState.ts

```ts
import { SupabaseClient } from '@supabase/supabase-js';
import { getTodayJST } from './dates';
import { HomeStateMachine } from './types';

export async function evaluateHomeState(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeStateMachine> {
  const todayJst = getTodayJST();

  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('id, wordbook_id, start_date, end_date')
    .eq('user_id', userId)
    .lte('start_date', todayJst)
    .gte('end_date', todayJst)
    .maybeSingle();

  if (!weeklyRange) {
    return { state: 'no_range' };
  }

  const { count: dueReviewCount } = await supabase
    .from('word_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_in_srs', true)
    .lte('next_review_at', todayJst);

  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('start_number, end_number, is_review_day')
    .eq('user_id', userId)
    .eq('date', todayJst)
    .maybeSingle();

  let unintroducedCount = 0;
  if (assignment && !assignment.is_review_day && assignment.start_number && assignment.end_number) {
    const { data: rangeWords } = await supabase
      .from('words')
      .select('id')
      .eq('wordbook_id', weeklyRange.wordbook_id)
      .gte('number', assignment.start_number)
      .lte('number', assignment.end_number);

    if (rangeWords && rangeWords.length > 0) {
      const wordIds = rangeWords.map((w) => w.id);
      const { data: progressWords } = await supabase
        .from('word_progress')
        .select('word_id')
        .eq('user_id', userId)
        .in('word_id', wordIds);

      const progressWordIds = new Set(progressWords?.map((p) => p.word_id) || []);
      unintroducedCount = wordIds.filter((id) => !progressWordIds.has(id)).length;
    }
  }

  const reviewDueTotal = dueReviewCount || 0;
  const newCandidateCount = Math.min(unintroducedCount, 20);
  const sessionCount = Math.min(reviewDueTotal + newCandidateCount, 20);

  const { count: todayIntroducedCount } = await supabase
    .from('daily_new_words')
    .select('word_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('date', todayJst);

  const { data: dailyCheckSession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'daily_check')
    .gte('created_at', `${todayJst}T00:00:00+09:00`)
    .lte('created_at', `${todayJst}T23:59:59+09:00`)
    .maybeSingle();

  const dailyCheckDone = !!dailyCheckSession;
  const introducedCount = todayIntroducedCount || 0;

  const { data: streakRow } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', userId)
    .maybeSingle();

  if (sessionCount > 0) {
    return {
      state: 'review_due',
      sessionCount,
      dueReviewCount: reviewDueTotal,
      todayNewCount: newCandidateCount,
    };
  }

  if (introducedCount > 0 && !dailyCheckDone) {
    return {
      state: 'daily_check_due',
      count: introducedCount,
    };
  }

  const { count: remainingAssignments } = await supabase
    .from('daily_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('date', todayJst)
    .eq('is_review_day', false);

  return {
    state: 'completed',
    streak: streakRow?.current_streak || 0,
    longestStreak: streakRow?.longest_streak || 0,
    hasAheadContent: (remainingAssignments || 0) > 0,
  };
}

```

---

## lib/srs/onAnswer.ts

```ts
import { addDaysJST } from './dates';

export const FIXED_INTERVAL_TABLE = [0, 1, 3, 7, 14, 30, 90] as const;

export interface SrsCalculationInput {
  stage: number;
  easeFactor: number;
  intervalDays: number;
  correctStreak: number;
  wrongCount: number;
}

export interface SrsCalculationOutput {
  stage: number;
  easeFactor: number;
  intervalDays: number;
  correctStreak: number;
  wrongCount: number;
  nextReviewAt: string;
}

export function calculateSrsUpdate(
  current: SrsCalculationInput,
  isCorrect: boolean,
  todayJst: string
): SrsCalculationOutput {
  let stage = current.stage;
  let easeFactor = current.easeFactor;
  let intervalDays = current.intervalDays;
  let correctStreak = current.correctStreak;
  let wrongCount = current.wrongCount;

  if (isCorrect) {
    stage = Math.min(stage + 1, 6);
    if (stage <= 2) {
      intervalDays = FIXED_INTERVAL_TABLE[stage];
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    easeFactor = Math.min(easeFactor + 0.05, 2.8);
    correctStreak += 1;
  } else {
    stage = Math.max(stage - 2, 0);
    intervalDays = 1;
    easeFactor = Math.max(easeFactor - 0.2, 1.3);
    correctStreak = 0;
    wrongCount += 1;
  }

  easeFactor = Math.round(easeFactor * 100) / 100;
  const calculatedInterval = Math.max(1, Math.round(intervalDays));
  const nextReviewAt = addDaysJST(todayJst, calculatedInterval);

  return {
    stage,
    easeFactor,
    intervalDays: calculatedInterval,
    correctStreak,
    wrongCount,
    nextReviewAt,
  };
}

```

---

## lib/srs/types.ts

```ts
export interface WordItem {
  id: string;
  wordbook_id: string;
  number: number;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  frequency_rank?: number | null;
  is_writing_target?: boolean;
}

export interface ExampleSentence {
  id: string;
  word_id: string;
  text: string;
  translation?: string | null;
}

export interface WordProgress {
  id: string;
  user_id: string;
  word_id: string;
  stage: number;
  ease_factor: number;
  interval_days: number;
  next_review_at: string | null;
  correct_streak: number;
  wrong_count: number;
  last_reviewed_at: string | null;
  exposure_count: number;
  is_in_srs: boolean;
}

export interface ReviewQueueItem {
  queueId: string;
  wordId: string;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  format: 'new' | 'review';
  exampleSentence?: {
    text: string;
    translation?: string | null;
  } | null;
  choices?: string[];
  correctChoiceIndex?: number;
  stage?: number;
  easeFactor?: number;
  wrongCount?: number;
  isRetry?: boolean;
}

export type HomeStateMachine =
  | { state: 'no_range' }
  | { state: 'review_due'; sessionCount: number; dueReviewCount: number; todayNewCount: number }
  | { state: 'daily_check_due'; count: number }
  | { state: 'completed'; streak: number; longestStreak: number; hasAheadContent: boolean };

```

---

## lib/streak/updateStreak.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getYesterday } from '@/lib/assignment/weekDates';

export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  today: string
): Promise<void> {
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (!streak) {
    await supabase.from('streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    return;
  }

  if (streak.last_active_date === today) return;

  const isConsecutive = streak.last_active_date === getYesterday(today);
  const nextCurrent = isConsecutive ? streak.current_streak + 1 : 1;

  await supabase
    .from('streaks')
    .update({
      current_streak: nextCurrent,
      longest_streak: Math.max(streak.longest_streak, nextCurrent),
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

```

---

## lib/streak/updateWordCorrectStreaks.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WordCorrectStreak {
  user_id: string;
  word_id: string;
  streak_count: number;
  last_updated_date: string;
  updated_at: string;
}

/**
 * 単語ごとの連続正解カウントを更新する
 * - セッションの type (normal / daily_check) を問わず更新対象
 * - 同一単語について、同日(JST)内の初回答のみ反映（2回目以降は streak を変動させない）
 * - 正解(is_known=true): streak_count + 1
 * - 不正解(is_known=false): streak_count = 0 にリセット
 */
export async function updateWordCorrectStreaks(
  supabase: SupabaseClient,
  userId: string,
  answers: Array<{ wordId: string; isKnown: boolean }>,
  todayJst: string
): Promise<void> {
  if (!answers || answers.length === 0) return;

  // 同一バッチ内で同一単語が複数回登場する場合は最初の回答を採用
  const firstAnswers = new Map<string, boolean>();
  for (const ans of answers) {
    if (!firstAnswers.has(ans.wordId)) {
      firstAnswers.set(ans.wordId, ans.isKnown);
    }
  }

  const wordIds = Array.from(firstAnswers.keys());
  if (wordIds.length === 0) return;

  // 既存の streak 情報を取得
  const { data: existingRows, error: fetchError } = await supabase
    .from('word_correct_streaks')
    .select('word_id, streak_count, last_updated_date')
    .eq('user_id', userId)
    .in('word_id', wordIds);

  if (fetchError) {
    console.error('Failed to fetch existing word_correct_streaks:', fetchError);
  }

  const existingMap最为 = new Map((existingRows ?? []).map((r) => [r.word_id, r]));
  const upsertRows: Array<{
    user_id: string;
    word_id: string;
    streak_count: number;
    last_updated_date: string;
    updated_at: string;
  }> = [];

  const nowIso = new Date().toISOString();

  for (const [wordId, isKnown] of firstAnswers.entries()) {
    const existing = existingMap最为.get(wordId);

    // 同じ日(JST)にすでに更新済みなら何もしない (同日重複更新防止)
    if (existing && existing.last_updated_date === todayJst) {
      continue;
    }

    const currentStreak = existing?.streak_count ?? 0;
    const newStreak = isKnown ? currentStreak + 1 : 0;

    upsertRows.push({
      user_id: userId,
      word_id: wordId,
      streak_count: newStreak,
      last_updated_date: todayJst,
      updated_at: nowIso,
    });
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('word_correct_streaks')
      .upsert(upsertRows, { onConflict: 'user_id,word_id' });

    if (upsertError) {
      console.error('Failed to upsert word_correct_streaks:', upsertError);
    }
  }
}

/**
 * 特定の単語の streak 情報を取得する
 */
export async function getWordStreak(
  supabase: SupabaseClient,
  userId: string,
  wordId: string
): Promise<{ streak_count: number; last_updated_date: string } | null> {
  const { data, error } = await supabase
    .from('word_correct_streaks')
    .select('streak_count, last_updated_date')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * フェーズC-3 (difficultyWeight計算) 用ヘルパー
 * 連続正解回数を 0〜6 のステージ値にクランプして返す
 */
export async function getDifficultyStage(
  supabase: SupabaseClient,
  userId: string,
  wordId: string
): Promise<number> {
  const row = await getWordStreak(supabase, userId, wordId);
  const streak = row?.streak_count ?? 0;
  return Math.min(Math.max(0, streak), 6);
}

/**
 * フェーズC-3 (バッチスコア計算) 用ヘルパー
 * 複数単語のクランプ済みステージ値 (0〜6) を Map で一括取得する
 */
export async function getDifficultyStages(
  supabase: SupabaseClient,
  userId: string,
  wordIds不易: string[]
): Promise<Map<string, number>> {
  const stageMap = new Map<string, number>();
  if (!wordIds不易 || wordIds不易.length === 0) return stageMap;

  // 初期値 0 で埋める
  for (const wid of wordIds不易) {
    stageMap.set(wid, 0);
  }

  const { data, error } = await supabase
    .from('word_correct_streaks')
    .select('word_id, streak_count')
    .eq('user_id', userId)
    .in('word_id', wordIds不易);

  if (error || !data) return stageMap;

  for (const row of data) {
    const rawStreak = row.streak_count ?? 0;
    stageMap.set(row.word_id, Math.min(Math.max(0, rawStreak), 6));
  }

  return stageMap;
}

```

---

## lib/supabase/client.ts

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

```

---

## lib/supabase/server.ts

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component からの呼び出し時は無視
          }
        },
      },
    }
  );
}

```

---

## lib/test/getTodayTestWords.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TestWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  originDailyAssignmentId?: string;
  number?: number;
}

export interface ReviewChunkSummaryInfo {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  prevAccuracyRate: number | null; // 0..100 (%)
}

export interface TodayTestContext {
  dailyAssignmentId: string;
  wordbookId: string;
  isReviewDay: boolean;
  rangeStart: number;
  rangeEnd: number;
  cards: TestWordCard[];
  reviewChunks?: ReviewChunkSummaryInfo[];
}

export async function getTodayTestContext(
  supabase: SupabaseClient,
  userId: string,
  today: string
): Promise<TodayTestContext | null> {
  // 1. 今日の割当を取得
  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('id, wordbook_id, range_start, range_end, is_review_day')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (!assignment) return null;

  // 2. 単語リスト取得と復習日割当取得を並列実行
  const wordsPromise = supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', assignment.wordbook_id)
    .gte('number', assignment.range_start)
    .lte('number', assignment.range_end)
    .order('number', { ascending: true });

  const progressPromise = assignment.is_review_day
    ? supabase
        .from('daily_assignments')
        .select('id, range_start, range_end, date')
        .eq('user_id', userId)
        .eq('wordbook_id', assignment.wordbook_id)
        .eq('is_review_day', false)
        .gte('range_start', assignment.range_start)
        .lte('range_end', assignment.range_end)
        .order('range_start', { ascending: true })
    : Promise.resolve({ data: [] });

  const [wordsRes, progressRes] = await Promise.all([wordsPromise, progressPromise]);

  const wordList = wordsRes.data ?? [];
  const pList = progressRes.data ?? [];
  const wordIds = wordList.map((w) => w.id);
  const pIds = pList.map((p) => p.id);

  // 3. 学習回数集計と復習日過去回答取得を並列実行
  const studyCountsPromise = getStudyCounts(supabase, userId, wordIds);
  const prevAnswersPromise =
    pIds.length > 0
      ? supabase
          .from('test_answers')
          .select('is_known, origin_daily_assignment_id, created_at, session_id, test_sessions!inner(user_id, date, created_at)')
          .eq('test_sessions.user_id', userId)
          .in('origin_daily_assignment_id', pIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] });

  const [studyCounts, prevAnswersRes] = await Promise.all([studyCountsPromise, prevAnswersPromise]);

  let reviewChunks: ReviewChunkSummaryInfo[] | undefined;
  const chunkByRange: Array<{ id: string; range_start: number; range_end: number; date: string }> = [];

  if (assignment.is_review_day && pList.length > 0) {
    chunkByRange.push(...pList);

    const prevAnswers = prevAnswersRes.data ?? [];
    const answersByChunk = new Map<string, Array<{ is_known: boolean; sessionId: string; created_at: string }>>();

    prevAnswers.forEach((a) => {
      const cid = a.origin_daily_assignment_id;
      if (!cid) return;
      const list = answersByChunk.get(cid) ?? [];
      list.push({ is_known: a.is_known, sessionId: a.session_id, created_at: a.created_at });
      answersByChunk.set(cid, list);
    });

    reviewChunks = pList.map((p) => {
      const cAnswers = answersByChunk.get(p.id) ?? [];
      let prevAccuracyRate: number | null = null;
      if (cAnswers.length > 0) {
        const sessionGroups = new Map<string, typeof cAnswers>();
        cAnswers.forEach((ans) => {
          const list = sessionGroups.get(ans.sessionId) ?? [];
          list.push(ans);
          sessionGroups.set(ans.sessionId, list);
        });
        const lastSessionAnswers = Array.from(sessionGroups.values()).pop();
        if (lastSessionAnswers && lastSessionAnswers.length > 0) {
          const corrects = lastSessionAnswers.filter((a) => a.is_known).length;
          prevAccuracyRate = Math.round((corrects / lastSessionAnswers.length) * 100);
        }
      }
      return {
        chunkId: p.id,
        rangeStart: p.range_start,
        rangeEnd: p.range_end,
        originDate: p.date,
        prevAccuracyRate,
      };
    });
  }

  const cards: TestWordCard[] = wordList.map((w) => {
    let originDailyAssignmentId: string | undefined;
    if (assignment.is_review_day) {
      const matched = chunkByRange.find(
        (c) => w.number >= c.range_start && w.number <= c.range_end
      );
      originDailyAssignmentId = matched?.id;
    } else {
      originDailyAssignmentId = assignment.id;
    }

    return {
      wordId: w.id,
      headword: w.word,
      pronunciation: w.pronunciation ?? undefined,
      meaning: w.meaning,
      studyCount: studyCounts.get(w.id) ?? 0,
      originDailyAssignmentId,
      number: w.number,
    };
  });

  return {
    dailyAssignmentId: assignment.id,
    wordbookId: assignment.wordbook_id,
    isReviewDay: assignment.is_review_day,
    rangeStart: assignment.range_start,
    rangeEnd: assignment.range_end,
    cards,
    reviewChunks,
  };
}

async function getStudyCounts(
  supabase: SupabaseClient,
  userId: string,
  wordIds: string[]
): Promise<Map<string, number>> {
  if (wordIds.length === 0) return new Map();

  const { data } = await supabase
    .from('test_answers')
    .select('word_id, test_sessions!inner(user_id)')
    .eq('test_sessions.user_id', userId)
    .in('word_id', wordIds);

  const counts = new Map<string, number>();
  (data ?? []).forEach((row: { word_id: string }) => {
    counts.set(row.word_id, (counts.get(row.word_id) ?? 0) + 1);
  });
  return counts;
}

```

---

## lib/test/resolveOriginAssignment.ts

```ts
import { createClient } from "@/lib/supabase/server";

export async function resolveOriginAssignment(
  userId: string,
  wordbookId: string,
  wordIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!wordIds || wordIds.length === 0) return map;

  const supabase = await createClient();

  const { data: words, error: wordsError } = await supabase
    .from("words")
    .select("id, number")
    .in("id", wordIds);

  if (wordsError || !words || words.length === 0) {
    return map;
  }

  const { data: assignments, error: assignError } = await supabase
    .from("daily_assignments")
    .select("id, range_start, range_end")
    .eq("user_id", userId)
    .eq("wordbook_id", wordbookId)
    .eq("is_review_day", false);

  if (assignError || !assignments || assignments.length === 0) {
    return map;
  }

  for (const word of words) {
    const matched = assignments.find(
      (a) => word.number >= a.range_start && word.number <= a.range_end
    );
    if (matched) {
      map.set(word.id, matched.id);
    }
  }

  return map;
}

```

---

## lib/weakness/computeChunkStats.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChunkMistakeWord {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  number: number;
  wrongCount: number;
  totalCount: number;
}

export interface ChunkHistoryPoint {
  testDate: string;
  accuracyRate: number;
  correctCount: number;
  totalCount: number;
}

export interface ChunkStat {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  totalAttempts: number;
  correctCount: number;
  accuracyRate: number;
  fullHistory: ChunkHistoryPoint[];
  drillHistory: ChunkHistoryPoint[];
  needsAttention: boolean;
  mistakeWords: ChunkMistakeWord[];
}

export async function computeChunkStats(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string
): Promise<ChunkStat[]> {
  // 1. 割当とセッション履歴を並列取得
  const [assignRes, sessionsRes] = await Promise.all([
    supabase
      .from('daily_assignments')
      .select('id, range_start, range_end, date')
      .eq('user_id', userId)
      .eq('wordbook_id', wordbookId)
      .eq('is_review_day', false)
      .order('date', { ascending: true }),
    supabase
      .from('test_sessions')
      .select('id, date, type, completed_at, created_at, test_answers(id, is_known, origin_daily_assignment_id, word_id, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const assignments = assignRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  if (assignments.length === 0) {
    return [];
  }

  // 2. ユーザーの学習範囲に必要な単語のみに絞り込んで取得 (1900語全件取得を廃止して軽量化)
  const minNum = Math.min(...assignments.map((a) => a.range_start));
  const maxNum = Math.max(...assignments.map((a) => a.range_end));

  const { data: words } = await supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId)
    .gte('number', minNum)
    .lte('number', maxNum);

  const wordList = words ?? [];
  const wordMap = new Map<string, (typeof wordList)[0]>();
  wordList.forEach((w) => {
    wordMap.set(w.id, w);
  });

  // 全回答フラット化
  const allAnswers: Array<{
    id: string;
    is_known: boolean;
    origin_daily_assignment_id?: string | null;
    word_id: string;
    session_id: string;
    session_type: string;
    date: string;
    created_at: string;
  }> = [];

  sessions.forEach((s: any) => {
    const answersList = s.test_answers ?? [];
    answersList.forEach((a: any) => {
      allAnswers.push({
        id: a.id,
        is_known: a.is_known,
        origin_daily_assignment_id: a.origin_daily_assignment_id,
        word_id: a.word_id,
        session_id: s.id,
        session_type: s.type || 'normal',
        date: s.date,
        created_at: a.created_at || s.created_at,
      });
    });
  });

  return assignments.map((assignment) => {
    const chunkWordCount = assignment.range_end - assignment.range_start + 1;

    const chunkAnswers = allAnswers.filter((ans) => {
      if (ans.origin_daily_assignment_id === assignment.id) {
        return true;
      }
      const w = wordMap.get(ans.word_id);
      return w && w.number >= assignment.range_start && w.number <= assignment.range_end;
    });

    const totalAttempts = chunkAnswers.length;
    const correctCount = chunkAnswers.filter((a) => a.is_known).length;

    const sessionMap = new Map<
      string,
      { date: string; created_at: string; type: string; answers: typeof chunkAnswers }
    >();

    chunkAnswers.forEach((ans) => {
      const sId = ans.session_id;
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, {
          date: ans.date,
          created_at: ans.created_at,
          type: ans.session_type,
          answers: [],
        });
      }
      sessionMap.get(sId)!.answers.push(ans);
    });

    const sortedSessions = Array.from(sessionMap.values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    const fullHistory: ChunkHistoryPoint[] = [];
    const drillHistory: ChunkHistoryPoint[] = [];

    sortedSessions.forEach((s) => {
      const sTotal = s.answers.length;
      const sCorrect = s.answers.filter((a) => a.is_known).length;
      const accuracyRate = sTotal > 0 ? Math.round((sCorrect / sTotal) * 100) : 0;

      const isFullScope =
        s.type === 'daily_check' || sTotal >= Math.min(Math.ceil(chunkWordCount * 0.7), chunkWordCount);

      const point: ChunkHistoryPoint = {
        testDate: s.date,
        accuracyRate,
        correctCount: sCorrect,
        totalCount: sTotal,
      };

      if (isFullScope) {
        fullHistory.push(point);
      } else {
        drillHistory.push(point);
      }
    });

    let currentAccuracyRate = 0;
    if (fullHistory.length > 0) {
      currentAccuracyRate = fullHistory[fullHistory.length - 1].accuracyRate;
    } else if (drillHistory.length > 0) {
      currentAccuracyRate = drillHistory[drillHistory.length - 1].accuracyRate;
    } else if (totalAttempts > 0) {
      currentAccuracyRate = Math.round((correctCount / totalAttempts) * 100);
    }

    let needsAttention = false;
    if (fullHistory.length > 0) {
      const recent = fullHistory.slice(-2);
      const avg = recent.reduce((sum, p) => sum + p.accuracyRate, 0) / recent.length;
      needsAttention = avg < 70;
    } else if (totalAttempts > 0) {
      needsAttention = currentAccuracyRate < 70;
    }

    const wordStatsMap = new Map<string, { mistakes: number; total: number }>();
    chunkAnswers.forEach((a) => {
      const cur = wordStatsMap.get(a.word_id) ?? { mistakes: 0, total: 0 };
      cur.total += 1;
      if (!a.is_known) cur.mistakes += 1;
      wordStatsMap.set(a.word_id, cur);
    });

    const mistakeWords: ChunkMistakeWord[] = [];
    wordStatsMap.forEach((stats, wordId) => {
      if (stats.mistakes > 0) {
        const wInfo = wordMap.get(wordId);
        if (wInfo) {
          mistakeWords.push({
            wordId: wInfo.id,
            headword: wInfo.word,
            pronunciation: wInfo.pronunciation ?? undefined,
            meaning: wInfo.meaning,
            number: wInfo.number,
            wrongCount: stats.mistakes,
            totalCount: stats.total,
          });
        }
      }
    });

    mistakeWords.sort((a, b) => b.wrongCount - a.wrongCount || a.number - b.number);

    return {
      chunkId: assignment.id,
      rangeStart: assignment.range_start,
      rangeEnd: assignment.range_end,
      originDate: assignment.date,
      totalAttempts,
      correctCount,
      accuracyRate: currentAccuracyRate,
      fullHistory,
      drillHistory,
      needsAttention,
      mistakeWords,
    };
  });
}

```

---

## lib/weakness/getWeakWords.ts

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WeakWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
  accuracyRate: number; // 0..100 (%)
  number?: number;
  originDailyAssignmentId?: string;
  mistakeCount?: number;
  lastWrongAt?: string;
}

export interface GetWeakWordsOptions {
  chunkId?: string;
  filterMode?: 'all' | 'mistakes' | 'recent';
  limit?: number; // 5, 10, 20 等
  days?: number;  // 直近 3, 7 日 等
}

/**
 * 苦手単語を条件に応じて高速抽出する (N+1ゼロ & 対象単語のみクエリして高速化)
 */
export async function getWeakWords(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string,
  options?: GetWeakWordsOptions
): Promise<WeakWordCard[]> {
  const filterMode = options?.filterMode || 'all';
  const targetLimit = options?.limit || (filterMode === 'all' ? 50 : 10);
  const filterDays = options?.days;
  const targetChunkId = options?.chunkId;

  // 1. チャンク指定がある場合は範囲を取得
  let chunkRange: { start: number; end: number } | null = null;
  if (targetChunkId) {
    const { data: chunk } = await supabase
      .from('daily_assignments')
      .select('range_start, range_end')
      .eq('id', targetChunkId)
      .eq('user_id', userId)
      .single();

    if (chunk) {
      chunkRange = { start: chunk.range_start, end: chunk.range_end };
    }
  }

  // 2. ユーザーの全回答履歴を一括取得 (N+1ゼロ)
  const { data: sessions, error: sessionsError } = await supabase
    .from('test_sessions')
    .select('id, created_at, test_answers(id, is_known, word_id, created_at, origin_daily_assignment_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (sessionsError || !sessions || sessions.length === 0) return [];

  interface WordAgg {
    wordId: string;
    totalAttempts: number;
    correctCount: number;
    mistakeCount: number;
    lastWrongAt: string | null;
    lastAnswerKnown: boolean;
    originDailyAssignmentId?: string | null;
  }

  const aggMap = new Map<string, WordAgg>();

  sessions.forEach((s: any) => {
    const answersList = s.test_answers ?? [];
    answersList.forEach((a: any) => {
      const cur = aggMap.get(a.word_id) ?? {
        wordId: a.word_id,
        totalAttempts: 0,
        correctCount: 0,
        mistakeCount: 0,
        lastWrongAt: null,
        lastAnswerKnown: true,
        originDailyAssignmentId: a.origin_daily_assignment_id,
      };

      cur.totalAttempts += 1;
      cur.lastAnswerKnown = a.is_known;
      if (a.is_known) {
        cur.correctCount += 1;
      } else {
        cur.mistakeCount += 1;
        const answerCreatedAt = a.created_at || s.created_at;
        if (!cur.lastWrongAt || answerCreatedAt > cur.lastWrongAt) {
          cur.lastWrongAt = answerCreatedAt;
        }
      }

      aggMap.set(a.word_id, cur);
    });
  });

  // 3. 苦手単語（ミス回数 >= 1 かつ 不正解または正答率60%以下）をフィルタ
  const now = new Date();
  const daysThreshold = filterDays
    ? new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  let candidateAggs = Array.from(aggMap.values()).filter((agg) => {
    const accuracy =
      agg.totalAttempts > 0 ? Math.round((agg.correctCount / agg.totalAttempts) * 100) : 0;
    const isWeak = !agg.lastAnswerKnown || accuracy <= 60 || agg.mistakeCount > 0;
    if (!isWeak || agg.mistakeCount === 0) return false;

    // 直近期間フィルター
    if (filterMode === 'recent' && daysThreshold && agg.lastWrongAt) {
      if (agg.lastWrongAt < daysThreshold) return false;
    }

    return true;
  });

  if (candidateAggs.length === 0) return [];

  // 4. ソート処理
  if (filterMode === 'mistakes') {
    // 間違えた回数が多い順 (同点は直近ミスが新しい順)
    candidateAggs.sort((a, b) => {
      if (b.mistakeCount !== a.mistakeCount) return b.mistakeCount - a.mistakeCount;
      return (b.lastWrongAt || '').localeCompare(a.lastWrongAt || '');
    });
  } else if (filterMode === 'recent') {
    // 最後に間違えた日時が新しい順
    candidateAggs.sort((a, b) => (b.lastWrongAt || '').localeCompare(a.lastWrongAt || ''));
  } else {
    // すべての苦手単語: 正答率が低い順 (苦手順)
    candidateAggs.sort((a, b) => {
      const accA = a.totalAttempts > 0 ? (a.correctCount / a.totalAttempts) * 100 : 0;
      const accB = b.totalAttempts > 0 ? (b.correctCount / b.totalAttempts) * 100 : 0;
      if (accA !== accB) return accA - accB;
      return b.mistakeCount - a.mistakeCount;
    });
  }

  // 5. 必要な単語のみを words テーブルから抽出 (全件取得を完全回避)
  const targetWordIds = candidateAggs.map((c) => c.wordId);

  let wordQuery = supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId)
    .in('id', targetWordIds);

  if (chunkRange) {
    wordQuery = wordQuery.gte('number', chunkRange.start).lte('number', chunkRange.end);
  }

  const { data: words, error: wordsError } = await wordQuery;
  if (wordsError || !words || words.length === 0) return [];

  const wordMap = new Map((words ?? []).map((w) => [w.id, w]));

  const weakCards: WeakWordCard[] = [];
  for (const agg of candidateAggs) {
    const w = wordMap.get(agg.wordId);
    if (!w) continue;

    const accuracyRate =
      agg.totalAttempts > 0 ? Math.round((agg.correctCount / agg.totalAttempts) * 100) : 0;

    weakCards.push({
      wordId: w.id,
      headword: w.word,
      pronunciation: w.pronunciation ?? undefined,
      meaning: w.meaning,
      studyCount: agg.totalAttempts,
      accuracyRate,
      number: w.number,
      originDailyAssignmentId: targetChunkId || agg.originDailyAssignmentId || undefined,
      mistakeCount: agg.mistakeCount,
      lastWrongAt: agg.lastWrongAt || undefined,
    });

    if (weakCards.length >= targetLimit) {
      break;
    }
  }

  return weakCards;
}

```

---

## next.config.ts

```ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // Next.js 16 Turbopack 互換フラグ
};

// 開発時は Turbopack で高速起動、Vercel本番ビルド時は Serwist PWA をビルド
export default isDev
  ? nextConfig
  : require("@serwist/next").default({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      disable: false,
      reloadOnOnline: true,
    })(nextConfig);

```

---

## package.json

```json
{
  "name": "tango-share-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@serwist/next": "^9.5.12",
    "@supabase/ssr": "^0.12.4",
    "@supabase/supabase-js": "^2.112.3",
    "clsx": "^2.1.1",
    "csv-parse": "^7.0.2",
    "lucide-react": "^1.33.0",
    "next": "16.3.2",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "serwist": "^9.5.12",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.2",
    "tailwindcss": "^4",
    "tsx": "^4.23.12",
    "typescript": "^5"
  },
  "engines": {
    "node": ">=20.9.0"
  }
}

```

---

## proxy.ts

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // 1. Next.js のリンクプリフェッチリクエスト時は Supabase 通信をスキップして即レスポンス
  if (
    request.headers.get("x-middleware-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // 2. 認証クッキーが存在しない場合は無駄なネットワーク往復をスキップ
  const authCookie = request.cookies.getAll().find((c) => c.name.includes("-auth-token"));
  if (!authCookie) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // セッション更新
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

```

---

## tailwind.config.ts

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F5F4EF",
          card: "#FFFFFF",
          hover: "#EFECE3",
        },
        ink: {
          DEFAULT: "#232A3B",
          muted: "#626B7F",
          subtle: "#8D95A5",
        },
        akashiito: {
          DEFAULT: "#E2483D",
          hover: "#C9382E",
          subtle: "#FDF2F1",
          border: "#F7B8B3",
        },
        highlighter: {
          DEFAULT: "#F5C84C",
          subtle: "#FEF8E8",
        },
        line: {
          DEFAULT: "#D8D3C4",
          light: "#EBE8DF",
        },
      },
      fontFamily: {
        mincho: ["var(--font-shippori)", "serif"],
        gothic: ["var(--font-zen-kaku)", "sans-serif"],
        number: ["var(--font-zen-maru)", "sans-serif"],
      },
      boxShadow: {
        paper: "0 2px 8px -2px rgba(35, 42, 59, 0.05), 0 1px 3px -1px rgba(35, 42, 59, 0.05)",
        sheet: "0 8px 24px -6px rgba(226, 72, 61, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;

```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}

```

---

## vercel.json

```json
{
  "framework": "nextjs",
  "regions": ["hnd1"]
}

```

---

