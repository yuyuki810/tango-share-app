import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { getTodayTestContext } from '@/lib/test/getTodayTestWords';
import { TestSessionRunner } from '@/components/test/TestSessionRunner';

interface TestPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const params = await searchParams;
  const sessionType = params.mode === 'normal' ? 'normal' : 'daily_check';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = getTodayJST();
  const context = await getTodayTestContext(supabase, user.id, today);

  if (!context || context.cards.length === 0) {
    return (
      <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-mincho text-lg text-ink">今日のテストはありません</p>
        <p className="font-maru text-xs text-ink/60">範囲が未設定か、今日はお休みです</p>
        <Link
          href="/dashboard"
          className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink"
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
      />
    </main>
  );
}
