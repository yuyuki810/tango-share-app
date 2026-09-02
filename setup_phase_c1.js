/**
 * setup_phase_c1.js
 * フェーズC-1: 本番デイリーチェック（1日1回限定）一括セットアップスクリプト
 * 
 * 実行方法:
 *   node setup_phase_c1.js
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
  console.log(`[FILE] 生成/更新完了: ${relativeFilePath}`);
}

console.log('================================================================');
console.log('フェーズC-1: 本番デイリーチェック機能のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. マイグレーションSQL (supabase/migrations/20260831_phase_c1_daily_check_unique.sql)
// -----------------------------------------------------------------------------
const migrationSql = `-- =============================================================================
-- Migration: フェーズC-1 本番デイリーチェック 1日1回制約の追加
-- =============================================================================

-- test_sessions において、同一ユーザー・同日・同一タイプ(daily_check)の重複を防止するユニークインデックス
-- type = 'normal' の練習テストは何度でも保存可能
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_check_once_per_day 
ON test_sessions (user_id, date) 
WHERE (type = 'daily_check');
`;

writeFile('supabase/migrations/20260831_phase_c1_daily_check_unique.sql', migrationSql);

// -----------------------------------------------------------------------------
// 2. components/dashboard/TodayRangeCard.tsx
// -----------------------------------------------------------------------------
const todayRangeCard = `'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

interface TodayRangeCardProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
  isDailyCheckCompleted?: boolean;
}

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
  isDailyCheckCompleted = false,
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
          {hasRange && (
            <span
              className={\`rounded-full border px-3 py-0.5 font-maru text-xs font-bold shadow-xs \${
                isReviewDay
                  ? 'border-highlighter bg-highlighter/50 text-ink'
                  : 'border-line bg-paper text-ink/80'
              }\`}
            >
              {isReviewDay ? '総復習の日' : '新規進捗'}
            </span>
          )}
          {hasRange && (
            <span
              className={\`rounded-full px-2.5 py-0.5 font-maru text-[10px] font-bold border \${
                isDailyCheckCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-akashiito/10 text-akashiito border-akashiito-border'
              }\`}
            >
              本番チェック: {isDailyCheckCompleted ? '済' : '未'}
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
              <Link
                href="/test?mode=daily_check"
                className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98 hover:opacity-95"
              >
                今日の本番チェックを受ける
              </Link>
              <div className="text-center pt-0.5">
                <Link
                  href="/test?mode=normal"
                  className="font-maru text-xs text-ink/60 hover:text-ink underline decoration-line underline-offset-4 transition"
                >
                  本番前の練習テストを受ける（何度でも可能）
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 py-3 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-mincho text-sm font-bold">本日の本番チェックは受験済みです</span>
              </div>
              <Link
                href="/test?mode=normal"
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

writeFile('components/dashboard/TodayRangeCard.tsx', todayRangeCard);

// -----------------------------------------------------------------------------
// 3. app/(main)/dashboard/page.tsx
// -----------------------------------------------------------------------------
const dashboardPage = `import Link from 'next/link';
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
  const weekStartDate = getThisWeekSaturdayJST();
  const prevWeekStartDate = getPreviousSaturday(weekStartDate);
  const weekDates = getWeekDates(weekStartDate);

  // 本日の daily_check 受験状況確認
  const { data: todayDailyCheckSession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .eq('type', 'daily_check')
    .maybeSingle();

  const isDailyCheckCompleted = !!todayDailyCheckSession;

  // ストリーク情報取得
  const { data: streakRow } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle();

  const currentStreak = streakRow?.current_streak ?? 0;

  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

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
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-mincho text-2xl font-bold text-ink">単語帳</h1>
          <p className="font-maru text-xs text-ink/50">毎日コツコツ、記憶を定着</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/debug"
            className="rounded-full border border-line bg-white px-2.5 py-1 font-maru text-[10px] text-ink/60 hover:text-ink transition"
          >
            🔍 自己診断
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-akashiito/30 bg-akashiito/10 px-3 py-1 font-maru text-xs font-bold text-akashiito">
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
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
          <Link
            href="/weakness"
            className="flex items-center gap-1 font-maru text-xs text-ink/60 transition hover:text-ink underline decoration-line underline-offset-4"
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

writeFile('app/(main)/dashboard/page.tsx', dashboardPage);

// -----------------------------------------------------------------------------
// 4. app/(main)/test/page.tsx
// -----------------------------------------------------------------------------
const testPage = `export const dynamic = 'force-dynamic';
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
  searchParams: Promise<{ mode?: string; originAssignmentId?: string; weak?: string }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const params = await searchParams;
  const sessionType = params.mode === 'daily_check' ? 'daily_check' : 'normal';

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
    });

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">この範囲に苦手な単語はありません！</p>
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
      <main className="mx-auto h-[100dvh] max-w-md bg-paper">
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
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id);

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-mincho text-lg text-ink">現在、苦手な単語はありません！</p>
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
      <main className="mx-auto h-[100dvh] max-w-md bg-paper">
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

  // 3. 本番デイリーチェックの重複受験ガード（UI/ページレベル）
  if (sessionType === 'daily_check') {
    const { data: existingSession } = await supabase
      .from('test_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'daily_check')
      .maybeSingle();

    if (existingSession) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
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
      <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
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
    <main className="mx-auto h-[100dvh] max-w-md bg-paper">
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
`;

writeFile('app/(main)/test/page.tsx', testPage);

// -----------------------------------------------------------------------------
// 5. app/api/test-sessions/complete/route.ts
// -----------------------------------------------------------------------------
const completeRoute = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
import { resolveOriginAssignment } from "@/lib/test/resolveOriginAssignment";

interface CompletePayload {
  dailyAssignmentId?: string | null;
  type: "daily_check" | "normal";
  results: Array<{
    wordId: string;
    isKnown: boolean;
    originDailyAssignmentId?: string;
  }>;
}

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

    const body: CompletePayload = await req.json();
    const { dailyAssignmentId, results } = body;
    const targetType = body.type || "normal";

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "Invalid results payload", detail: "解答データが空です" },
        { status: 400 }
      );
    }

    const today = getTodayJST();

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("wordbook_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wordbook_id) {
      return NextResponse.json(
        { error: "User wordbook not found", detail: profileError?.message || "単語帳が設定されていません" },
        { status: 400 }
      );
    }

    // 本番デイリーチェックの重複登録ガード (409 Conflict)
    if (targetType === "daily_check") {
      const { data: existingDailyCheck } = await supabase
        .from("test_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("type", "daily_check")
        .maybeSingle();

      if (existingDailyCheck) {
        return NextResponse.json(
          {
            error: "Conflict",
            detail: "本日の本番デイリーチェックは既に受験済みです。1日1回のみ記録可能です。",
          },
          { status: 409 }
        );
      }
    }

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;

    // 1. test_sessions への挿入
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: targetType,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Failed to insert test_sessions:", sessionError);

      if (sessionError?.code === "23505" || sessionError?.message?.includes("uq_daily_check")) {
        return NextResponse.json(
          {
            error: "Conflict",
            detail: "本日の本番デイリーチェックは既に記録されています。",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to create test session",
          detail: \`test_sessions 登録エラー: \${sessionError?.message} (\${sessionError?.code})\`,
        },
        { status: 500 }
      );
    }

    // 2. test_answers への挿入
    const wordIds = results.map((r) => r.wordId);
    const originMap = await resolveOriginAssignment(
      user.id,
      profile.wordbook_id,
      wordIds
    );

    const { data: validAssignments } = await supabase
      .from("daily_assignments")
      .select("id")
      .eq("user_id", user.id);

    const validAssignmentIdSet = new Set((validAssignments ?? []).map((a) => a.id));

    const answerRows = results.map((r) => {
      let targetAssignmentId =
        r.originDailyAssignmentId ||
        originMap.get(r.wordId) ||
        (dailyAssignmentId ?? null);

      if (targetAssignmentId && !validAssignmentIdSet.has(targetAssignmentId)) {
        targetAssignmentId = null;
      }

      return {
        session_id: session.id,
        word_id: r.wordId,
        is_known: r.isKnown,
        origin_daily_assignment_id: targetAssignmentId,
      };
    });

    const { error: answersError } = await supabase
      .from("test_answers")
      .insert(answerRows);

    if (answersError) {
      console.error("Failed to insert test_answers:", answersError);
      return NextResponse.json(
        {
          error: "Failed to insert test_answers",
          detail: \`test_answers 登録エラー: \${answersError?.message} (\${answersError?.code})\`,
          sessionId: session.id,
        },
        { status: 500 }
      );
    }

    // 3. ストリーク更新
    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", streakErr);
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      savedAnswersCount: answerRows.length,
      correctCount,
      totalCount,
      type: targetType,
    });
  } catch (err: any) {
    console.error("Complete API fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/test-sessions/complete/route.ts', completeRoute);

// -----------------------------------------------------------------------------
// 6. components/test/TestResultScreen.tsx
// -----------------------------------------------------------------------------
const testResultScreen = `'use client';

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
`;

writeFile('components/test/TestResultScreen.tsx', testResultScreen);

// -----------------------------------------------------------------------------
// 7. app/(main)/group/page.tsx
// -----------------------------------------------------------------------------
const groupPage = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { Users, User, CheckCircle2 } from 'lucide-react';

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
      <main className="mx-auto max-w-md px-4 py-8 text-center space-y-4">
        <h1 className="font-mincho text-xl font-bold text-ink">グループに参加していません</h1>
        <p className="font-maru text-xs text-ink/60">
          グループを作成するか、招待コードを入力して参加してください。
        </p>
        <Link
          href="/join-group"
          className="inline-block rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-paper font-maru"
        >
          グループに参加・作成
        </Link>
      </main>
    );
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', me.group_id)
    .single();

  const { data: members } = await supabase
    .from('users')
    .select('id, name, wordbook_id, wordbooks(name)')
    .eq('group_id', me.group_id);

  const today = getTodayJST();
  const memberList = members ?? [];
  const memberIds = memberList.map((m) => m.id);

  const { data: todaySessions } = await supabase
    .from('test_sessions')
    .select('user_id')
    .eq('type', 'daily_check')
    .eq('date', today)
    .in('user_id', memberIds);

  const doneUserIds = new Set((todaySessions ?? []).map((s) => s.user_id));
  const doneMembers = memberList.filter((m) => doneUserIds.has(m.id));
  const notDoneMembers = memberList.filter((m) => !doneUserIds.has(m.id));
  const isMeDone = doneUserIds.has(user.id);
  const totalCount = memberList.length;
  const doneCount = doneMembers.length;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-24 pt-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50">
            GROUP STATUS
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">{group?.name || 'グループ'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs font-bold text-ink">
          <Users className="h-3.5 w-3.5 text-ink/60" />
          <span>{totalCount} / 4人</span>
        </div>
      </div>

      {/* 今日のデイリーチェック進捗サマリー */}
      <div className="rounded-3xl border border-line bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mincho text-sm font-bold text-ink">本日の本番デイリーチェック</span>
          <span className="font-maru text-xs font-bold text-ink">
            {doneCount} / {totalCount} 人 完了
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
          <div
            className="h-full rounded-full bg-ink transition-all duration-300"
            style={{ width: \`\${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%\` }}
          />
        </div>
        <p className="font-maru text-[11px] text-ink/50">
          {doneCount === totalCount
            ? '🎉 本日はグループ全員が本番チェックを完了しました！'
            : isMeDone
            ? 'あなたの本番チェックは完了しています。仲間の完了を待ちましょう。'
            : 'あなたはまだ本日の本番チェックを受けていません。'}
        </p>

        {!isMeDone && (
          <Link
            href="/test?mode=daily_check"
            className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-sm font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98"
          >
            今日の本番チェックを受ける
          </Link>
        )}
      </div>

      {/* メンバー受験状況一覧 (スコアは出さず、済/未のみ) */}
      <section className="space-y-3">
        <h2 className="font-mincho text-xs font-bold text-ink/60 px-1">メンバーの受験ステータス</h2>

        {/* 受験済みのメンバー */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-emerald-700 block px-1">
            完了 ({doneMembers.length}人)
          </span>
          {doneMembers.map((m) => {
            const isMe = m.id === user.id;
            const wbName = (m.wordbooks as { name?: string } | null)?.name;
            return (
              <div
                key={m.id}
                className={\`flex items-center justify-between rounded-2xl border p-3.5 shadow-xs transition \${
                  isMe
                    ? 'border-emerald-200 bg-emerald-50/50 ring-1 ring-emerald-200/50'
                    : 'border-line bg-white'
                }\`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mincho text-sm font-bold text-ink">{m.name}</span>
                      {isMe && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 font-maru text-[10px] font-bold text-emerald-800">
                          あなた
                        </span>
                      )}
                    </div>
                    {wbName && <span className="font-maru text-[10px] text-ink/40">{wbName}</span>}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 font-maru text-xs font-bold text-emerald-800">
                  済
                </span>
              </div>
            );
          })}
          {doneMembers.length === 0 && (
            <p className="rounded-xl border border-dashed border-line bg-white/40 p-3 text-center font-maru text-xs text-ink/40">
              まだ誰も受験していません
            </p>
          )}
        </div>

        {/* 未受検のメンバー */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold text-ink/50 block px-1">
            未受検 ({notDoneMembers.length}人)
          </span>
          {notDoneMembers.map((m) => {
            const isMe = m.id === user.id;
            const wbName = (m.wordbooks as { name?: string } | null)?.name;
            return (
              <div
                key={m.id}
                className={\`flex items-center justify-between rounded-2xl border p-3.5 transition \${
                  isMe
                    ? 'border-akashiito-border/60 bg-akashiito-subtle/30'
                    : 'border-dashed border-line bg-white/60 text-ink/60'
                }\`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mincho text-sm font-bold text-ink/80">{m.name}</span>
                      {isMe && (
                        <span className="rounded-full bg-akashiito/10 px-1.5 py-0.2 font-maru text-[10px] font-bold text-akashiito">
                          あなた
                        </span>
                      )}
                    </div>
                    {wbName && <span className="font-maru text-[10px] text-ink/40">{wbName}</span>}
                  </div>
                </div>
                <span className="rounded-full bg-stone-100 border border-line px-2.5 py-0.5 font-maru text-xs font-medium text-stone-500">
                  未
                </span>
              </div>
            );
          })}
          {notDoneMembers.length === 0 && (
            <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3 text-center font-maru text-xs text-emerald-700">
              全員完了しています！
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
`;

writeFile('app/(main)/group/page.tsx', groupPage);

// -----------------------------------------------------------------------------
// 8. components/layout/BottomNav.tsx
// -----------------------------------------------------------------------------
const bottomNav = `'use client';

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
    { href: '/weakness', label: '弱点マップ', icon: '🗺️' },
    { href: '/settings/wordbook', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={\`flex min-h-[52px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-95 \${
                isActive ? 'text-akashiito font-bold' : 'text-ink/50 hover:text-ink'
              }\`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5 font-maru text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
`;

writeFile('components/layout/BottomNav.tsx', bottomNav);

console.log('\n================================================================');
console.log('✅ フェーズC-1: 全ファイルの更新・生成が正常に完了しました！');
console.log('================================================================\n');
console.log('【DBマイグレーションの確認】');
console.log('Supabase SQL Editorにて、以下のマイグレーションSQLが適用されていることを確認してください:');
console.log('----------------------------------------------------------------');
console.log(migrationSql);
console.log('----------------------------------------------------------------');