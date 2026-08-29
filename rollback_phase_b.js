const fs = require('fs');
const path = require('path');

const filesToRemove = [
  "app/(main)/weakness/page.tsx",
  "components/weakness/WeaknessChunkTile.tsx",
  "components/weakness/WeaknessBottomSheet.tsx",
  "components/weakness/WeaknessClientView.tsx",
  "components/weakness/ChunkSummaryScreen.tsx",
  "lib/weakness/computeChunkStats.ts",
  "lib/weakness/getWeakWords.ts",
  "supabase/migrations/20250102000000_phase_b_weakness.sql",
  "supabase/migrations/20250102000000_phase_b_weakness_indexes.sql",
  "setup_phase_b.js",
  "setup_phase2.js",
  "setup_fix_wordbook.js",
  "fix_export.js",
  "fix_syntax.js",
  "fix_clean.js",
  "fix_preview_panel.js",
  "fix_all_exact.js"
];

const dirsToRemove = [
  "app/(main)/weakness",
  "components/weakness",
  "lib/weakness"
];

const filesToRestore = {
  "app/(main)/dashboard/page.tsx": "import { redirect } from 'next/navigation';\nimport Link from 'next/link';\nimport { createClient } from '@/lib/supabase/server';\nimport { getWeekDates, getTodayJST } from '@/lib/assignment/weekDates';\nimport { StreakBadge } from '@/components/dashboard/StreakBadge';\nimport { TodayRangeCard } from '@/components/dashboard/TodayRangeCard';\nimport { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';\nimport { SetRangeCTA } from '@/components/dashboard/SetRangeCTA';\nimport { TestCTA } from '@/components/dashboard/TestCTA';\n\nexport default async function DashboardPage() {\n  const supabase = await createClient();\n  const {\n    data: { user },\n  } = await supabase.auth.getUser();\n  if (!user) redirect('/login');\n\n  const today = getTodayJST();\n  const weekDates = getWeekDates();\n\n  const { data: profile } = await supabase\n    .from('users')\n    .select('name, group_id, wordbook_id, wordbooks(name)')\n    .eq('id', user.id)\n    .single();\n\n  const { data: streak } = await supabase\n    .from('streaks')\n    .select('current_streak')\n    .eq('user_id', user.id)\n    .maybeSingle();\n\n  const { data: currentRange } = await supabase\n    .from('weekly_ranges')\n    .select('*')\n    .eq('user_id', user.id)\n    .lte('start_date', today)\n    .gte('end_date', today)\n    .maybeSingle();\n\n  const { data: assignments } = await supabase\n    .from('daily_assignments')\n    .select('*')\n    .eq('user_id', user.id)\n    .gte('date', weekDates[0])\n    .lte('date', weekDates[6])\n    .order('date');\n\n  const todayAssignment = (assignments ?? []).find((a) => a.date === today);\n\n  const { data: todaySession } = await supabase\n    .from('test_sessions')\n    .select('id')\n    .eq('user_id', user.id)\n    .eq('date', today)\n    .eq('type', 'daily_check')\n    .maybeSingle();\n\n  const wordbookName = (profile?.wordbooks as unknown as { name: string } | null)?.name ?? '';\n\n  return (\n    <main className=\"mx-auto max-w-md space-y-6 px-4 py-6\">\n      <header className=\"flex items-center justify-between\">\n        <div>\n          <p className=\"text-xs text-ink/40\">おかえりなさい</p>\n          <h1 className=\"font-mincho text-xl text-ink\">{profile?.name ?? 'ゲスト'} さん</h1>\n        </div>\n        <StreakBadge currentStreak={streak?.current_streak ?? 0} />\n      </header>\n\n      {!currentRange && <SetRangeCTA />}\n\n      {currentRange && (\n        <section className=\"space-y-3\">\n          <TodayRangeCard\n            rangeStart={todayAssignment?.range_start ?? null}\n            rangeEnd={todayAssignment?.range_end ?? null}\n            isReviewDay={todayAssignment?.is_review_day ?? false}\n            wordbookName={wordbookName}\n          />\n\n          {!todaySession && todayAssignment && todayAssignment.range_start !== null && todayAssignment.range_end !== null && (\n            <TestCTA\n              wordCount={todayAssignment.range_end - todayAssignment.range_start + 1}\n              isReviewDay={todayAssignment.is_review_day}\n            />\n          )}\n\n          {todaySession && (\n            <div className=\"rounded-2xl border border-line bg-white/50 p-4 text-center\">\n              <p className=\"font-maru text-xs text-ink/60\">今日の確認テストは完了しています 🎉</p>\n            </div>\n          )}\n        </section>\n      )}\n\n      {currentRange && assignments && (\n        <section className=\"space-y-2\">\n          <h2 className=\"text-xs font-semibold text-ink/40\">今週のスケジュール</h2>\n          <WeeklySchedule assignments={assignments} todayDate={today} />\n        </section>\n      )}\n    </main>\n  );\n}\n",
  "app/(main)/test/page.tsx": "import { redirect } from 'next/navigation';\nimport Link from 'next/link';\nimport { createClient } from '@/lib/supabase/server';\nimport { getTodayJST } from '@/lib/assignment/weekDates';\nimport { getTodayTestContext } from '@/lib/test/getTodayTestWords';\nimport { TestSessionRunner } from '@/components/test/TestSessionRunner';\n\ninterface TestPageProps {\n  searchParams: Promise<{ mode?: string }>;\n}\n\nexport default async function TestPage({ searchParams }: TestPageProps) {\n  const params = await searchParams;\n  const sessionType = params.mode === 'normal' ? 'normal' : 'daily_check';\n\n  const supabase = await createClient();\n  const {\n    data: { user },\n  } = await supabase.auth.getUser();\n  if (!user) redirect('/login');\n\n  const today = getTodayJST();\n  const context = await getTodayTestContext(supabase, user.id, today);\n\n  if (!context || context.cards.length === 0) {\n    return (\n      <main className=\"mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center\">\n        <p className=\"font-mincho text-lg text-ink\">今日のテストはありません</p>\n        <p className=\"font-maru text-xs text-ink/60\">範囲が未設定か、今日はお休みです</p>\n        <Link\n          href=\"/dashboard\"\n          className=\"rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink\"\n        >\n          ホームへ戻る\n        </Link>\n      </main>\n    );\n  }\n\n  return (\n    <main className=\"mx-auto h-[100dvh] max-w-md bg-paper\">\n      <TestSessionRunner\n        cards={context.cards}\n        dailyAssignmentId={context.dailyAssignmentId}\n        sessionType={sessionType}\n      />\n    </main>\n  );\n}\n",
  "components/test/TestSessionRunner.tsx": "'use client';\n\nimport { useState } from 'react';\nimport { useRouter } from 'next/navigation';\nimport { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';\nimport type { WordCardData } from '@/components/review/WordJudgeCard';\n\ninterface TestSessionRunnerProps {\n  cards: WordCardData[];\n  dailyAssignmentId: string;\n  sessionType: 'daily_check' | 'normal';\n}\n\nexport function TestSessionRunner({\n  cards,\n  dailyAssignmentId,\n  sessionType,\n}: TestSessionRunnerProps) {\n  const router = useRouter();\n  const [answers, setAnswers] = useState<Map<string, boolean>>(new Map());\n  const [isSubmitting, setIsSubmitting] = useState(false);\n\n  const handleJudge = (wordId: string, isKnown: boolean) => {\n    setAnswers((prev) => new Map(prev).set(wordId, isKnown));\n  };\n\n  const handleAllDone = async () => {\n    if (isSubmitting) return;\n    setIsSubmitting(true);\n\n    const results = cards.map((c) => ({\n      wordId: c.wordId,\n      isKnown: answers.get(c.wordId) ?? false,\n    }));\n\n    try {\n      const res = await fetch('/api/test-sessions/complete', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({\n          dailyAssignmentId,\n          type: sessionType,\n          results,\n        }),\n      });\n\n      if (!res.ok) {\n        console.error('Failed to save test session');\n      }\n    } catch (err) {\n      console.error('Error submitting test session', err);\n    } finally {\n      router.push('/dashboard');\n      router.refresh();\n    }\n  };\n\n  return (\n    <WordJudgeCardScreen\n      cards={cards}\n      onJudge={handleJudge}\n      onAllDone={handleAllDone}\n    />\n  );\n}\n",
  "components/dashboard/SetRangeCTA.tsx": "import Link from 'next/link';\n\nexport function SetRangeCTA() {\n  return (\n    <div className=\"rounded-3xl border border-line bg-white p-6 shadow-xs\">\n      <h2 className=\"font-mincho text-lg text-ink\">今週の学習範囲が未設定です</h2>\n      <p className=\"mt-1 font-maru text-xs text-ink/60 leading-relaxed\">\n        土曜開始の1週間サイクルで、進める単語の範囲を決めましょう。\n      </p>\n      <Link\n        href=\"/assignments/setup\"\n        className=\"mt-4 block w-full rounded-2xl bg-ink py-3 text-center font-mincho text-sm text-paper transition hover:opacity-90\"\n      >\n        今週の範囲を設定する\n      </Link>\n    </div>\n  );\n}\n"
};

console.log('=== Rolling back Phase B changes to Phase A ===');

// 1. Remove Phase B files
for (const relPath of filesToRemove) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[Removed] ${relPath}`);
  }
}

// 2. Remove Phase B directories
for (const relDir of dirsToRemove) {
  const fullDir = path.join(process.cwd(), relDir);
  if (fs.existsSync(fullDir)) {
    try {
      fs.rmdirSync(fullDir, { recursive: true });
      console.log(`[Removed Directory] ${relDir}`);
    } catch (e) {}
  }
}

// 3. Restore Phase A original files
for (const [relPath, content] of Object.entries(filesToRestore)) {
  const fullPath = path.join(process.cwd(), relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[Restored to Phase A] ${relPath}`);
}

console.log('=== Rollback Complete! Project is back to Phase A clean state. ===');
