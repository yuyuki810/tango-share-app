/**
 * setup_phase_a.js
 * フェーズA: 確認テストの実データ接続 一括セットアップスクリプト
 * 
 * 実行方法: node setup_phase_a.js
 */

const fs = require('fs');
const path = require('path');

const files = {
  // =========================================================================
  // 1. データベース マイグレーション SQL
  // =========================================================================
  'supabase/migrations/20250101000000_phase_a_test_connection.sql': `-- wordbooks: 名前の重複投入を防ぐため一意制約を追加し、単語帳マスタを登録
alter table wordbooks add constraint uq_wordbooks_name unique (name);

insert into wordbooks (name, total_words) values
  ('システム英単語', 2180),
  ('英単語ターゲット1900', 1900)
on conflict (name) do update set total_words = excluded.total_words;

-- words: 発音記号カラム(任意)
alter table words add column if not exists pronunciation text;

-- test_answers: 復習日のテストで各単語がどの「進める日」由来かを記録するカラムとインデックス
alter table test_answers
  add column if not exists origin_daily_assignment_id uuid references daily_assignments(id) on delete set null;

create index if not exists idx_test_answers_origin on test_answers(origin_daily_assignment_id);

-- streaks: シンプルな連続記録テーブル
create table if not exists streaks (
  user_id uuid primary key references users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table streaks enable row level security;

create policy "own streaks" on streaks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
`,

  // =========================================================================
  // 2. 日付ユーティリティ (JST基準)
  // =========================================================================
  'lib/assignment/weekDates.ts': `/**
 * JST (UTC+9) 基準の日付文字列 (YYYY-MM-DD) を取得する
 */
export function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * JST基準で今週の開始日(直近の土曜日)を取得する
 */
export function getThisWeekSaturdayJST(): string {
  const todayStr = getTodayJST();
  const [y, m, d] = todayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  // getUTCDay(): 0: 日, 1: 月, ..., 6: 土
  const day = date.getUTCDay();
  const diffToSat = (day + 1) % 7;
  date.setUTCDate(date.getUTCDate() - diffToSat);

  return date.toISOString().slice(0, 10);
}

/**
 * 週開始日(土曜日)から7日分(土〜金)の日付文字列の配列を返す
 */
export function getWeekDates(weekStartDate: string): string[] {
  const [y, m, d] = weekStartDate.split('-').map(Number);
  const dates: string[] = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(Date.UTC(y, m - 1, d + i));
    dates.push(current.toISOString().slice(0, 10));
  }

  return dates;
}

/**
 * 指定日の前日の日付文字列を取得する
 */
export function getYesterday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
`,

  // =========================================================================
  // 3. 今日のテスト対象単語取得ロジック
  // =========================================================================
  'lib/test/getTodayTestWords.ts': `import type { SupabaseClient } from '@supabase/supabase-js';

export interface TestWordCard {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount: number;
}

export interface TodayTestContext {
  dailyAssignmentId: string;
  wordbookId: string;
  isReviewDay: boolean;
  rangeStart: number;
  rangeEnd: number;
  cards: TestWordCard[];
}

export async function getTodayTestContext(
  supabase: SupabaseClient,
  userId: string,
  today: string // YYYY-MM-DD
): Promise<TodayTestContext | null> {
  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('id, wordbook_id, range_start, range_end, is_review_day')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (!assignment) return null;

  const { data: words } = await supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', assignment.wordbook_id)
    .gte('number', assignment.range_start)
    .lte('number', assignment.range_end)
    .order('number', { ascending: true });

  const wordList = words ?? [];
  const studyCounts = await getStudyCounts(
    supabase,
    userId,
    wordList.map((w) => w.id)
  );

  const cards: TestWordCard[] = wordList.map((w) => ({
    wordId: w.id,
    headword: w.word,
    pronunciation: w.pronunciation ?? undefined,
    meaning: w.meaning,
    studyCount: studyCounts.get(w.id) ?? 0,
  }));

  return {
    dailyAssignmentId: assignment.id,
    wordbookId: assignment.wordbook_id,
    isReviewDay: assignment.is_review_day,
    rangeStart: assignment.range_start,
    rangeEnd: assignment.range_end,
    cards,
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
`,

  // =========================================================================
  // 4. 復習日の割当元解決ロジック
  // =========================================================================
  'lib/test/resolveOriginAssignment.ts': `import type { SupabaseClient } from '@supabase/supabase-js';
import { getWeekDates } from '@/lib/assignment/weekDates';

export interface DailyAssignmentRange {
  id: string;
  rangeStart: number;
  rangeEnd: number;
}

export async function getWeekProgressAssignments(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string,
  weekStartDate: string
): Promise<DailyAssignmentRange[]> {
  const weekDates = getWeekDates(weekStartDate);
  const { data } = await supabase
    .from('daily_assignments')
    .select('id, date, range_start, range_end')
    .eq('user_id', userId)
    .eq('wordbook_id', wordbookId)
    .eq('is_review_day', false)
    .in('date', weekDates)
    .order('date', { ascending: true });

  return (data ?? []).map((a) => ({
    id: a.id,
    rangeStart: a.range_start,
    rangeEnd: a.range_end,
  }));
}

export function resolveOriginAssignmentId(
  wordNumber: number,
  progressAssignments: DailyAssignmentRange[]
): string | null {
  const match = progressAssignments.find(
    (a) => wordNumber >= a.rangeStart && wordNumber <= a.rangeEnd
  );
  return match?.id ?? null;
}
`,

  // =========================================================================
  // 5. ストリーク更新ロジック
  // =========================================================================
  'lib/streak/updateStreak.ts': `import type { SupabaseClient } from '@supabase/supabase-js';
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
`,

  // =========================================================================
  // 6. テスト完了 API ルート
  // =========================================================================
  'app/api/test-sessions/complete/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST, getThisWeekSaturdayJST } from '@/lib/assignment/weekDates';
import { getWeekProgressAssignments, resolveOriginAssignmentId } from '@/lib/test/resolveOriginAssignment';
import { updateStreak } from '@/lib/streak/updateStreak';

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
  const { dailyAssignmentId, type, results } = body as {
    dailyAssignmentId: string;
    type: 'daily_check' | 'normal';
    results: Array<{ wordId: string; isKnown: boolean }>;
  };

  if (!dailyAssignmentId || !type || !Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: '入力が不足しています' }, { status: 400 });
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('daily_assignments')
    .select('id, wordbook_id, is_review_day')
    .eq('id', dailyAssignmentId)
    .eq('user_id', user.id)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json({ error: '該当する日次割当が見つかりません' }, { status: 404 });
  }

  const wordIds = results.map((r) => r.wordId);
  const originMap = new Map<string, string | null>();

  if (assignment.is_review_day) {
    const { data: wordRows } = await supabase
      .from('words')
      .select('id, number')
      .in('id', wordIds);

    const weekStartDate = getThisWeekSaturdayJST();
    const progressAssignments = await getWeekProgressAssignments(
      supabase,
      user.id,
      assignment.wordbook_id,
      weekStartDate
    );
    (wordRows ?? []).forEach((w) => {
      originMap.set(w.id, resolveOriginAssignmentId(w.number, progressAssignments));
    });
  } else {
    wordIds.forEach((id) => originMap.set(id, dailyAssignmentId));
  }

  const today = getTodayJST();
  const correctCount = results.filter((r) => r.isKnown).length;

  const { data: session, error: sessionError } = await supabase
    .from('test_sessions')
    .insert({
      user_id: user.id,
      date: today,
      type,
      correct_count: correctCount,
      total_count: results.length,
    })
    .select()
    .single();

  if (sessionError || !session) {
    if (sessionError?.code === '23505') {
      return NextResponse.json({ error: '本日の確認テストは既に受験済みです' }, { status: 409 });
    }
    return NextResponse.json({ error: 'テスト結果の保存に失敗しました' }, { status: 500 });
  }

  const answerRows = results.map((r) => ({
    session_id: session.id,
    word_id: r.wordId,
    is_known: r.isKnown,
    origin_daily_assignment_id: originMap.get(r.wordId) ?? null,
  }));

  const { error: answersError } = await supabase.from('test_answers').insert(answerRows);
  if (answersError) {
    return NextResponse.json(
      { error: '回答の保存に失敗しました', detail: answersError.message },
      { status: 500 }
    );
  }

  if (type === 'daily_check') {
    await updateStreak(supabase, user.id, today);
  }

  return NextResponse.json({ ok: true, correctCount, totalCount: results.length });
}
`,

  // =========================================================================
  // 7. テストランナー コンポーネント (Client Component)
  // =========================================================================
  'components/test/TestSessionRunner.tsx': `"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';

interface TestSessionRunnerProps {
  dailyAssignmentId: string;
  type: 'daily_check' | 'normal';
  cards: WordCardData[];
}

export function TestSessionRunner({ dailyAssignmentId, type, cards }: TestSessionRunnerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resultsRef = useRef<Array<{ wordId: string; isKnown: boolean }>>([]);

  const handleJudge = (wordId: string, isKnown: boolean) => {
    resultsRef.current.push({ wordId, isKnown });
  };

  const handleAllDone = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/test-sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyAssignmentId, type, results: resultsRef.current }),
      });
      if (!res.ok) {
        const resBody = await res.json();
        setError(resBody.error ?? '保存に失敗しました');
        setIsSubmitting(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('通信エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-akashiito">{error}</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="min-h-[44px] rounded-lg border border-line px-4 text-ink/70"
        >
          ホームに戻る
        </button>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="font-mincho text-ink">テスト結果を記録中...</p>
      </div>
    );
  }

  return <WordJudgeCardScreen cards={cards} onJudge={handleJudge} onAllDone={handleAllDone} />;
}
`,

  // =========================================================================
  // 8. テスト開始 CTA ボタン
  // =========================================================================
  'components/dashboard/TestCTA.tsx': `import Link from 'next/link';

interface TestCTAProps {
  wordCount: number;
  isReviewDay: boolean;
}

export function TestCTA({ wordCount, isReviewDay }: TestCTAProps) {
  return (
    <Link
      href="/test"
      className="block min-h-[56px] w-full rounded-2xl bg-akashiito px-4 py-3 text-center font-mincho text-paper shadow-sm transition hover:opacity-95"
    >
      {isReviewDay ? \`復習テスト(\${wordCount}語)\` : \`今日の確認テスト(\${wordCount}語)\`}
    </Link>
  );
}
`,

  // =========================================================================
  // 9. ストリークバッジ
  // =========================================================================
  'components/dashboard/StreakBadge.tsx': `interface StreakBadgeProps {
  currentStreak: number;
}

export function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink/60">
      🔥 {currentStreak}日連続
    </span>
  );
}
`,

  // =========================================================================
  // 10. テスト画面
  // =========================================================================
  'app/(main)/test/page.tsx': `import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { getTodayTestContext } from '@/lib/test/getTodayTestWords';
import { TestSessionRunner } from '@/components/test/TestSessionRunner';

interface TestPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const isNormalMode = resolvedParams.mode === 'normal';

  const today = getTodayJST();
  const context = await getTodayTestContext(supabase, user.id, today);

  if (!context || context.cards.length === 0) {
    return (
      <main className="mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-center gap-2 bg-paper px-6 text-center">
        <p className="font-mincho text-lg text-ink">今日の学習範囲がありません</p>
        <p className="text-sm text-ink/60">
          今週の範囲がまだ設定されていないか、休みの日の可能性があります
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto h-[100dvh] max-w-md bg-paper">
      <TestSessionRunner
        dailyAssignmentId={context.dailyAssignmentId}
        type={isNormalMode ? 'normal' : 'daily_check'}
        cards={context.cards}
      />
    </main>
  );
}
`,

  // =========================================================================
  // 11. ホーム画面 (Dashboard)
  // =========================================================================
  'app/(main)/dashboard/page.tsx': `import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST, getThisWeekSaturdayJST, getWeekDates } from '@/lib/assignment/weekDates';
import { TodayRangeCard } from '@/components/dashboard/TodayRangeCard';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { SetRangeCTA } from '@/components/dashboard/SetRangeCTA';
import { TestCTA } from '@/components/dashboard/TestCTA';
import { StreakBadge } from '@/components/dashboard/StreakBadge';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name, total_words)')
    .eq('id', user.id)
    .single();

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST();
  const weekDates = getWeekDates(weekStartDate);

  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  const { data: assignments } = await supabase
    .from('daily_assignments')
    .select('date, range_start, range_end, is_review_day')
    .eq('user_id', user.id)
    .in('date', weekDates);

  const assignmentByDate = new Map((assignments ?? []).map((a) => [a.date, a]));
  const todayAssignment = assignmentByDate.get(today);

  const { data: todaySession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .eq('type', 'daily_check')
    .maybeSingle();

  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle();

  const weekDays = weekDates.map((date) => {
    const a = assignmentByDate.get(date);
    return {
      date,
      rangeStart: a?.range_start ?? null,
      rangeEnd: a?.range_end ?? null,
      isReviewDay: a?.is_review_day ?? false,
    };
  });

  const wordbookName = (profile?.wordbooks as { name?: string } | null)?.name ?? '';
  const wordbookTotalWords = (profile?.wordbooks as { total_words?: number } | null)?.total_words ?? 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6">
      {!weeklyRange ? (
        <SetRangeCTA
          wordbookId={profile?.wordbook_id ?? ''}
          wordbookTotalWords={wordbookTotalWords}
          weekStartDate={weekStartDate}
          hasExistingRange={false}
        />
      ) : !todayAssignment ? (
        <div className="rounded-2xl border border-line bg-white/60 p-5 text-center text-ink/60">
          今日は学習の予定がありません
        </div>
      ) : todaySession ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="font-mincho text-lg text-ink">今日の分は完了!</p>
          <div className="mt-2">
            <StreakBadge currentStreak={streak?.current_streak ?? 0} />
          </div>
        </div>
      ) : (
        <TestCTA
          wordCount={todayAssignment.range_end - todayAssignment.range_start + 1}
          isReviewDay={todayAssignment.is_review_day}
        />
      )}

      <TodayRangeCard
        rangeStart={todayAssignment?.range_start ?? null}
        rangeEnd={todayAssignment?.range_end ?? null}
        isReviewDay={todayAssignment?.is_review_day ?? false}
        wordbookName={wordbookName}
      />

      <section>
        <h2 className="mb-2 font-mincho text-sm text-ink/60">今週のスケジュール</h2>
        <WeeklySchedule days={weekDays} todayDate={today} />
      </section>
    </main>
  );
}
`,

  // =========================================================================
  // 12. グループ画面
  // =========================================================================
  'app/(main)/group/page.tsx': `import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';

export default async function GroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('group_id').eq('id', user.id).single();
  if (!me?.group_id) {
    return (
      <main className="mx-auto max-w-md px-4 py-6 text-center text-ink/60">
        グループに参加していません
      </main>
    );
  }

  const { data: members } = await supabase
    .from('users')
    .select('id, name')
    .eq('group_id', me.group_id);

  const today = getTodayJST();
  const memberIds = (members ?? []).map((m) => m.id);

  const { data: todaySessions } = await supabase
    .from('test_sessions')
    .select('user_id, correct_count, total_count')
    .eq('type', 'daily_check')
    .eq('date', today)
    .in('user_id', memberIds);

  const sessionByUser = new Map((todaySessions ?? []).map((s) => [s.user_id, s]));
  const done = (members ?? []).filter((m) => sessionByUser.has(m.id));
  const notDone = (members ?? []).filter((m) => !sessionByUser.has(m.id));

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6">
      <h1 className="font-mincho text-lg text-ink">今日のグループの様子</h1>

      <section>
        <h2 className="mb-2 text-sm text-ink/60">完了した人</h2>
        <ul className="space-y-2">
          {done.map((m) => {
            const s = sessionByUser.get(m.id)!;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3"
              >
                <span className="text-ink">{m.name}</span>
                <span className="font-maru text-sm text-ink/60">
                  {s.correct_count}/{s.total_count}
                </span>
              </li>
            );
          })}
          {done.length === 0 && <p className="text-sm text-ink/40">まだ誰もいません</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink/60">まだの人</h2>
        <ul className="space-y-2">
          {notDone.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-dashed border-line bg-white/50 px-4 py-3 text-ink/50"
            >
              {m.name}
            </li>
          ))}
          {notDone.length === 0 && <p className="text-sm text-ink/40">全員完了しています!</p>}
        </ul>
      </section>
    </main>
  );
}
`,

  // =========================================================================
  // 13. サンプル単語シードスクリプト (.env.local 自動読み込み対応)
  // =========================================================================
  'scripts/seed-sample-words.js': `const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// .env.local の自動パース・読み込み
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        const val = values.join('=').replace(/(^["']|["']$)/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL と Supabase Key を .env.local に設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleWords = [
  { number: 1, word: 'abandon', pronunciation: 'əˈbændən', meaning: '〜を捨てる、放棄する' },
  { number: 2, word: 'benefit', pronunciation: 'ˈbenɪfɪt', meaning: '利益、恩恵' },
  { number: 3, word: 'consequence', pronunciation: '', meaning: '結果、影響' },
  { number: 4, word: 'diminish', pronunciation: '', meaning: '減少する、弱める' },
  { number: 5, word: 'evident', pronunciation: '', meaning: '明白な' },
];

async function seed() {
  console.log('--- サンプル単語の投入を開始 ---');
  const { data: wordbook, error: wbError } = await supabase
    .from('wordbooks')
    .select('id, name')
    .eq('name', 'システム英単語')
    .single();

  if (wbError || !wordbook) {
    console.error('単語帳「システム英単語」が見つかりません。先にマイグレーションを実行してください。');
    return;
  }

  const rows = sampleWords.map((w) => ({
    ...w,
    wordbook_id: wordbook.id,
  }));

  const { error } = await supabase.from('words').upsert(rows, { onConflict: 'wordbook_id,number' });
  if (error) {
    console.error('単語投入エラー:', error.message);
  } else {
    console.log(\`システム英単語に \${rows.length} 語のサンプルデータを投入しました。\`);
  }
}

seed();
`
};

// =========================================================================
// ファイル生成実行部
// =========================================================================
let createdCount = 0;
for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[OK] ${filePath}`);
  createdCount++;
}

console.log(`\n🎉 フェーズAの全ファイル (${createdCount} 件) の配置が完了しました！`);