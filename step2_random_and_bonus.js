const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[Updated] ${filePath}`);
}

// 1. app/(main)/test/page.tsx
writeFile(
  'app/(main)/test/page.tsx',
  `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { getTodayTestContext } from '@/lib/test/getTodayTestWords';
import { getWeakWords } from '@/lib/weakness/getWeakWords';
import { TestSessionRunner } from '@/components/test/TestSessionRunner';
import { CheckCircle2 } from 'lucide-react';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface TestPageProps {
  searchParams: Promise<{
    mode?: string;
    originAssignmentId?: string;
    weak?: string;
    filter?: 'all' | 'mistakes' | 'recent';
    limit?: string;
    days?: string;
    random?: string;
  }>;
}

export default async function TestPage({ searchParams }: TestPageProps) {
  const params = await searchParams;
  const sessionType = params.mode === 'daily_check' ? 'daily_check' : 'normal';

  const filterMode = params.filter || 'all';
  const filterLimit = params.limit ? Number(params.limit) : undefined;
  const filterDays = params.days ? Number(params.days) : undefined;
  const isRandomOrder = params.random === 'true';

  // 弱点マップ起点かどうかの判定 (戻り先URLの動的切り替え)
  const isFromWeakness = !!params.originAssignmentId || params.weak === 'true';
  const backUrl = isFromWeakness ? '/weakness' : '/dashboard';
  const backLabel = isFromWeakness ? '弱点マップへ戻る' : 'ダッシュボードへ戻る';

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
    let weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id, {
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

    if (isRandomOrder) {
      weakCards = shuffleArray(weakCards);
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={params.originAssignmentId}
          sessionType="normal"
          isReviewDay={false}
          backUrl={backUrl}
          backLabel={backLabel}
          isRandomOrder={isRandomOrder}
        />
      </main>
    );
  }

  // 2. 単語帳全体の苦手克服テスト
  if (params.weak === 'true') {
    let weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id, {
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
            href="/weakness"
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-ink shadow-sm font-maru"
          >
            弱点マップへ戻る
          </Link>
        </main>
      );
    }

    if (isRandomOrder) {
      weakCards = shuffleArray(weakCards);
    }

    return (
      <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
        <TestSessionRunner
          cards={weakCards}
          dailyAssignmentId={null}
          sessionType="normal"
          isReviewDay={false}
          backUrl={backUrl}
          backLabel={backLabel}
          isRandomOrder={isRandomOrder}
        />
      </main>
    );
  }

  const today = getTodayJST();

  // 3. 本番デイリーチェックの重複受験ガード
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

  let finalCards = context.cards;
  if (isRandomOrder) {
    finalCards = shuffleArray(finalCards);
  }

  return (
    <main className="mx-auto h-[100dvh] max-w-md md:max-w-xl lg:max-w-2xl bg-paper">
      <TestSessionRunner
        cards={finalCards}
        dailyAssignmentId={context.dailyAssignmentId}
        sessionType={sessionType}
        isReviewDay={context.isReviewDay}
        reviewChunks={context.reviewChunks}
        backUrl={backUrl}
        backLabel={backLabel}
        isRandomOrder={isRandomOrder}
      />
    </main>
  );
}`
);

// 2. components/test/TestSessionRunner.tsx
writeFile(
  'components/test/TestSessionRunner.tsx',
  `'use client';

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
  backUrl?: string;
  backLabel?: string;
  isRandomOrder?: boolean;
}

export function TestSessionRunner({
  cards,
  dailyAssignmentId,
  sessionType,
  isReviewDay = false,
  reviewChunks = [],
  backUrl = '/dashboard',
  backLabel = 'ダッシュボードへ戻る',
  isRandomOrder = false,
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

    const cardWordIds = cards.map((c) => c.wordId);

    fetch('/api/test-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: sessionType,
        dailyAssignmentId,
        totalCount: cards.length,
        wordIds: cardWordIds,
        isRandomOrder,
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

          if (data.mode === 'resume' && Array.isArray(data.answeredWords) && data.answeredWords.length > 0) {
            const answeredWords: Array<{ wordId: string; isKnown: boolean }> = data.answeredWords;
            const isValidCount = answeredWords.length < cards.length;
            const isMatchWords = answeredWords.every(
              (a, idx) => a.wordId === cards[idx]?.wordId
            );

            if (isValidCount && isMatchWords) {
              const answeredMap = new Map<string, boolean>();
              answeredWords.forEach((a) => {
                answeredMap.set(a.wordId, a.isKnown);
              });

              setResumePrompt({
                answeredCount: answeredWords.length,
                answeredMap,
              });
            } else {
              setInitialAnswers(new Map());
              setInitialIndex(0);
            }
          } else {
            setInitialAnswers(new Map());
            setInitialIndex(0);
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
  }, [sessionType, dailyAssignmentId, cards, isRandomOrder]);

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

  const handleModifyJudge = async (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    if (!currentId) return;

    try {
      const res = await fetch('/api/test-sessions/modify-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentId,
          wordId,
          isKnown,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to modify answer:', data.error);
      }
    } catch (err) {
      console.error('Modify answer request error:', err);
    }
  };

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
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-ink/60 font-maru select-none">
        <RefreshCw className="h-6 w-6 animate-spin text-ink/40" />
        <p className="text-xs">テストを準備中...</p>
      </div>
    );
  }

  if (resumePrompt) {
    const isDailyCheck = sessionType === 'daily_check';
    return (
      <div className="mx-auto flex min-h-[85vh] max-w-md md:max-w-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 select-none">
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
        backUrl={backUrl}
        backLabel={backLabel}
      />
    );
  }

  return (
    <WordJudgeCardScreen
      cards={cards}
      initialIndex={initialIndex}
      initialAnswers={initialAnswers}
      onJudge={handleSingleJudge}
      onModifyJudge={handleModifyJudge}
      onFinished={handleFinished}
      title={sessionType === 'daily_check' ? '本日のテスト結果' : '苦手克服テスト結果'}
      backUrl={backUrl}
      backLabel={backLabel}
    />
  );
}`
);

// 3. app/api/test-sessions/start/route.ts
writeFile(
  'app/api/test-sessions/start/route.ts',
  `import { NextRequest, NextResponse } from "next/server";
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
    const { type = "normal", dailyAssignmentId = null, totalCount = 0, wordIds = [], isRandomOrder = false } = body;
    const today = getTodayJST();

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

    let incompleteQuery = supabase
      .from("test_sessions")
      .select("id, type, date, total_count, correct_count, created_at, is_random_order")
      .eq("user_id", user.id)
      .eq("type", type)
      .is("completed_at", null);

    if (type === "daily_check") {
      incompleteQuery = incompleteQuery.eq("date", today);
    } else if (totalCount > 0) {
      incompleteQuery = incompleteQuery.eq("total_count", totalCount);
    }

    const { data: incompleteSession } = await incompleteQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (incompleteSession) {
      const { data: answers } = await supabase
        .from("test_answers")
        .select("word_id, is_known, origin_daily_assignment_id, created_at")
        .eq("session_id", incompleteSession.id)
        .order("created_at", { ascending: true });

      const answeredList = answers ?? [];

      let isValidResume = false;
      if (
        answeredList.length > 0 &&
        totalCount > 0 &&
        answeredList.length < totalCount
      ) {
        if (Array.isArray(wordIds) && wordIds.length > 0) {
          const expectedPrefix = wordIds.slice(0, answeredList.length);
          const actualIds = answeredList.map((a) => a.word_id);
          isValidResume = actualIds.every((id, idx) => id === expectedPrefix[idx]);
        } else {
          isValidResume = true;
        }
      }

      if (isValidResume) {
        return NextResponse.json({
          success: true,
          mode: "resume",
          session: incompleteSession,
          answeredWords: answeredList.map((a) => ({
            wordId: a.word_id,
            isKnown: a.is_known,
            originDailyAssignmentId: a.origin_daily_assignment_id,
          })),
        });
      }
    }

    const { data: newSession, error: createError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: type,
        correct_count: 0,
        total_count: totalCount,
        completed_at: null,
        is_random_order: isRandomOrder,
      })
      .select("id, type, date, total_count, correct_count, created_at, is_random_order")
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
}`
);

// 4. app/api/test-sessions/complete/route.ts
writeFile(
  'app/api/test-sessions/complete/route.ts',
  `import { NextRequest, NextResponse } from "next/server";
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

    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("id, user_id, date, type, completed_at, is_random_order")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.completed_at) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        sessionId: session.id,
      });
    }

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

    const { data: allAnswers } = await supabase
      .from("test_answers")
      .select("word_id, is_known, origin_daily_assignment_id")
      .eq("session_id", sessionId);

    const answerList = allAnswers ?? [];
    const correctCount = answerList.filter((a) => a.is_known).length;
    const totalCount = answerList.length;

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

    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", (streakErr as any)?.message || String(streakErr));
    }

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

    let computedScore: any = null;
    if (session.type === "daily_check") {
      try {
        computedScore = await computeAndSaveDailyScore({
          supabase,
          userId: user.id,
          date: today,
          answers: answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        });

        // ランダム出題時のみ +5点ボーナス (最大100にクランプ) を付与
        if (session.is_random_order && computedScore) {
          const bonusScore = Math.min(100, computedScore.normalizedScore + 5);
          await supabase
            .from("daily_score_entries")
            .update({
              normalized_score: bonusScore,
              random_bonus_applied: true,
            })
            .eq("user_id", user.id)
            .eq("date", today);

          computedScore.normalizedScore = bonusScore;
          computedScore.randomBonusApplied = true;
        }
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
      isRandomOrder: session.is_random_order,
    });
  } catch (err: any) {
    console.error("Complete API fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}`
);

// 5. components/dashboard/TodayRangeCard.tsx
writeFile(
  'components/dashboard/TodayRangeCard.tsx',
  `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, RotateCcw, Shuffle } from 'lucide-react';

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

  const [isRandom, setIsRandom] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tango_random_order');
      if (saved === 'true') {
        setIsRandom(true);
      }
    } catch {}
  }, []);

  const toggleRandom = () => {
    const next = !isRandom;
    setIsRandom(next);
    try {
      localStorage.setItem('tango_random_order', String(next));
    } catch {}
  };

  const dailyCheckUrl = \`/test?mode=daily_check\${isRandom ? '&random=true' : ''}\`;
  const normalTestUrl = \`/test?mode=normal\${isRandom ? '&random=true' : ''}\`;

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
                  ? 'border-[#9FE1CB] bg-[#E6F7F2] text-[#136C56]'
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
        <div className="space-y-3">
          {/* ランダム出題トグル */}
          <div className="flex items-center justify-between rounded-xl bg-paper/60 border border-line/60 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Shuffle className={\`h-3.5 w-3.5 \${isRandom ? 'text-akashiito' : 'text-ink/40'}\`} />
              <span className="font-maru text-xs font-bold text-ink/80">ランダム出題で受ける</span>
              {!isDailyCheckCompleted && (
                <span className="rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.2 font-maru text-[9px] font-bold text-amber-900">
                  本番+5点ボーナス
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleRandom}
              className={\`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none \${
                isRandom ? 'bg-akashiito' : 'bg-line'
              }\`}
              aria-label="ランダム出題の切り替え"
            >
              <span
                className={\`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out \${
                  isRandom ? 'translate-x-4' : 'translate-x-0'
                }\`}
              />
            </button>
          </div>

          {!isDailyCheckCompleted ? (
            <>
              <Link
                href={dailyCheckUrl}
                prefetch={true}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E24B4A] font-mincho text-base font-bold text-white shadow-md shadow-[#E24B4A]/25 transition active:scale-98 hover:opacity-95"
              >
                {hasIncompleteSession && <RotateCcw className="h-4 w-4" />}
                <span>{hasIncompleteSession ? '前回の続きから再開する' : '今日の本番チェックを受ける'}</span>
              </Link>
              <div className="text-center pt-0.5">
                <Link
                  href={normalTestUrl}
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
                href={normalTestUrl}
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
}`
);

// 6. components/weakness/DrillFilterDialog.tsx
writeFile(
  'components/weakness/DrillFilterDialog.tsx',
  `'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Clock, Layers, X, Play, Shuffle } from 'lucide-react';

interface DrillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  originAssignmentId?: string;
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
  const [isRandom, setIsRandom] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleStart = () => {
    let url = '/test?mode=normal';
    if (originAssignmentId) {
      url += \`&originAssignmentId=\${encodeURIComponent(originAssignmentId)}\`;
    } else {
      url += '&weak=true';
    }

    url += \`&filter=\${filterMode}\`;
    if (filterMode !== 'all') {
      url += \`&limit=\${limit}\`;
    }
    if (filterMode === 'recent') {
      url += \`&days=\${days}\`;
    }
    if (isRandom) {
      url += '&random=true';
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
              className={\`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 \${
                filterMode === 'all'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }\`}
            >
              <Layers className="h-4 w-4" />
              <span className="font-maru text-xs">すべて</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('mistakes')}
              className={\`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 \${
                filterMode === 'mistakes'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }\`}
            >
              <Flame className="h-4 w-4 text-akashiito" />
              <span className="font-maru text-xs">ミス多順</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('recent')}
              className={\`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 \${
                filterMode === 'recent'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }\`}
            >
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-maru text-xs">直近ミス</span>
            </button>
          </div>
        </div>

        {/* 2. 出題数選択 */}
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
                  className={\`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 \${
                    limit === count
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }\`}
                >
                  {count} 語
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. 期間選択 */}
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
                  className={\`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 \${
                    days === item.value
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }\`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. 出題順 (ランダムトグル) */}
        <div className="flex items-center justify-between rounded-xl bg-white border border-line/80 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Shuffle className={\`h-4 w-4 \${isRandom ? 'text-akashiito' : 'text-ink/40'}\`} />
            <span className="font-maru text-xs font-bold text-ink">出題順をシャッフルする</span>
          </div>
          <button
            type="button"
            onClick={() => setIsRandom(!isRandom)}
            className={\`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none \${
              isRandom ? 'bg-akashiito' : 'bg-line'
            }\`}
            aria-label="ランダム出題の切り替え"
          >
            <span
              className={\`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out \${
                isRandom ? 'translate-x-4' : 'translate-x-0'
              }\`}
            />
          </button>
        </div>

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
              : \`\${filterMode === 'mistakes' ? 'ミスが多い順に' : '直近で間違えた単語を'} \${limit}語 特訓する\`}
          </span>
        </button>
      </div>
    </div>
  );
}`
);

// 7. app/(main)/group/page.tsx
const groupPath = 'app/(main)/group/page.tsx';
let groupContent = fs.readFileSync(groupPath, 'utf8');
if (!groupContent.includes('random_bonus_applied')) {
  // select に random_bonus_applied を追加
  groupContent = groupContent.replace(
    /avg_diminishing_factor\s*'\)/g,
    "avg_diminishing_factor, random_bonus_applied')"
  );
  // アイコンインポートに Shuffle を追加
  groupContent = groupContent.replace(
    /Users, User, Trophy/g,
    'Users, User, Trophy, Shuffle'
  );
  // バッジ表示を追加
  groupContent = groupContent.replace(
    /const wbName = \(m\.wordbooks as \{ name\?: string \} \| null\)\?\.name;/g,
    `const wbName = (m.wordbooks as { name?: string } | null)?.name;\n              const hasBonus = !!(scoreEntry as any)?.random_bonus_applied;`
  );
  groupContent = groupContent.replace(
    /\{isMe && \(\s*<span className="rounded-full bg-ink text-paper px-1\.5 py-0\.2 font-maru text-\[10px\] md:text-xs font-bold">\s*あなた\s*<\/span>\s*\)\}/g,
    `{isMe && (\n                          <span className="rounded-full bg-ink text-paper px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold">\n                            あなた\n                          </span>\n                        )}\n                        {hasBonus && (\n                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-300 px-1.5 py-0.2 font-maru text-[9px] font-bold text-amber-900">\n                            <Shuffle className="h-2.5 w-2.5 text-amber-700" />\n                            <span>+5</span>\n                          </span>\n                        )}`
  );
  writeFile(groupPath, groupContent);
}

console.log('✅ ステップ2 (ランダム出題・ボーナス・戻り先連携) の更新が完了しました。');
