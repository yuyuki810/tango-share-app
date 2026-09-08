プロジェクトルートで実行できるスクリプトです。

```javascript
// setup_phase_f8.js
const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function writeFile(filePath, content) {
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
  console.log(`[Created/Updated] ${filePath}`);
}

// -----------------------------------------------------------------------------
// 1. マイグレーションSQL: is_random_order & random_bonus_applied の追加
// -----------------------------------------------------------------------------
writeFile(
  'supabase/migrations/20260907_add_random_order_and_bonus.sql',
  `-- ランダム出題フラグとデイリーチェックのランダムボーナス適用フラグを追加
ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS is_random_order boolean DEFAULT false;
ALTER TABLE daily_score_entries ADD COLUMN IF NOT EXISTS random_bonus_applied boolean DEFAULT false;

COMMENT ON COLUMN test_sessions.is_random_order IS '出題順がランダム(シャッフル)だったかどうかのフラグ';
COMMENT ON COLUMN daily_score_entries.random_bonus_applied IS 'ランダム出題による+5点ボーナスが適用されたかどうか';
`
);

// -----------------------------------------------------------------------------
// 2. app/(main)/test/page.tsx
//    backUrl判定 (弱点マップ起点なら /weakness) & ランダムシャッフル処理
// -----------------------------------------------------------------------------
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
}
`
);

// -----------------------------------------------------------------------------
// 3. components/test/TestSessionRunner.tsx
//    backUrl, isRandomOrder を API 及び子コンポーネントへ配線
// -----------------------------------------------------------------------------
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

  // 3. 回答修正ハンドラー
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

  // 4. 全問終了時のセッション完了確定処理
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
}
`
);

// -----------------------------------------------------------------------------
// 4. components/review/WordJudgeCardScreen.tsx
//    backUrl / backLabel による中断・完了遷移先の動的切替
// -----------------------------------------------------------------------------
writeFile(
  'components/review/WordJudgeCardScreen.tsx',
  `'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WordJudgeCard, type WordCardData } from './WordJudgeCard';
import { RotateCcw, AlertCircle, LogOut } from 'lucide-react';

interface WordJudgeCardScreenProps {
  cards: WordCardData[];
  initialIndex?: number;
  initialAnswers?: Map<string, boolean>;
  onJudge?: (wordId: string, isKnown: boolean) => void;
  onModifyJudge?: (wordId: string, isKnown: boolean) => Promise<void> | void;
  onAllDone?: (results: Array<{ wordId: string; isKnown: boolean }>) => void;
  onFinished?: (resultsMap: Map<string, boolean>) => void;
  title?: string;
  backUrl?: string;
  backLabel?: string;
}

const MAX_STACK_VISIBLE = 3;

export function WordJudgeCardScreen({
  cards,
  initialIndex = 0,
  initialAnswers,
  onJudge,
  onModifyJudge,
  onAllDone,
  onFinished,
  title,
  backUrl = '/dashboard',
  backLabel = 'ダッシュボードへ戻る',
}: WordJudgeCardScreenProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isCompleted, setIsCompleted] = useState(false);
  const [answersMap, setAnswersMap] = useState<Map<string, boolean>>(
    () => new Map(initialAnswers || [])
  );
  const resultsRef = useRef<Map<string, boolean>>(
    new Map(initialAnswers || [])
  );

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisionIndex, setRevisionIndex] = useState<number | null>(null);
  const [isModifyLoading, setIsModifyLoading] = useState(false);

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

  const effectiveIndex = isRevising && revisionIndex !== null ? revisionIndex : currentIndex;
  const remaining = isRevising && revisionIndex !== null
    ? [cards[revisionIndex]]
    : cards.slice(currentIndex, currentIndex + MAX_STACK_VISIBLE);

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

  const handleReviseCommit = async (wordId: string, isKnown: boolean) => {
    setIsModifyLoading(true);
    try {
      resultsRef.current.set(wordId, isKnown);
      setAnswersMap(new Map(resultsRef.current));
      if (onModifyJudge) {
        await onModifyJudge(wordId, isKnown);
      }
    } finally {
      setIsModifyLoading(false);
      setIsRevising(false);
      setRevisionIndex(null);
    }
  };

  const handleStartRevision = () => {
    if (isRevising || currentIndex <= 0) return;
    const targetIdx = currentIndex - 1;
    setRevisionIndex(targetIdx);
    setIsRevising(true);
  };

  if (isCompleted || currentIndex >= total) {
    const correctCount = cards.filter((c) => answersMap.get(c.wordId) ?? false).length;
    const wrongCards = cards.filter((c) => !(answersMap.get(c.wordId) ?? false));
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const isPerfect = wrongCards.length === 0;

    return (
      <div className="flex min-h-[100dvh] flex-col justify-between p-6 md:p-8 lg:p-10 bg-paper animate-in fade-in duration-200 max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full select-none">
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
            href={backUrl}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const canRevise = currentIndex > 0 && !isRevising;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col justify-between overflow-hidden overscroll-none touch-none max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full select-none">
      {/* 上部ヘッダー操作部 */}
      <div className="px-4 pb-2 pt-3 shrink-0 space-y-2 select-none">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line/80 bg-white/90 px-3 py-1 font-maru text-xs text-ink/60 transition active:scale-95 hover:text-ink cursor-pointer shadow-2xs"
            style={{ touchAction: 'manipulation' }}
            aria-label="テストを中断する"
          >
            <LogOut className="h-3 w-3 text-ink/40" />
            <span>中断</span>
          </button>

          {isRevising ? (
            <div className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-maru text-xs font-bold text-amber-900 shadow-2xs">
              <RotateCcw className="h-3 w-3 text-amber-600 animate-spin-once" />
              <span>直前の回答を修正中</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canRevise}
              onClick={handleStartRevision}
              className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 font-maru text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs ${
                canRevise
                  ? 'border-line bg-white text-ink/75 hover:bg-paper hover:text-ink'
                  : 'border-transparent text-ink/20 pointer-events-none'
              }`}
              style={{ touchAction: 'manipulation' }}
              aria-label="直前の1問の回答を修正する"
            >
              <RotateCcw className="h-3 w-3 text-ink/40" />
              <span>前の回答を修正</span>
            </button>
          )}

          <span className="font-mono text-xs text-ink/60 font-bold select-none pointer-events-none">
            {effectiveIndex + 1}/{total}
          </span>
        </div>

        <div className="h-1.5 md:h-2 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((effectiveIndex) / total) * 100}%` }}
          />
        </div>

        <div className="hidden sm:flex items-center justify-center">
          <div className="inline-flex items-center gap-2.5 text-[11px] font-mono text-ink/70 whitespace-nowrap bg-white/90 px-3 py-0.5 rounded-full border border-line shadow-2xs select-none">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">Space</kbd>
              <span className="font-maru text-[10px] text-ink/50">めくる</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">A</kbd>
              <span className="text-ink/30 text-[9px]">·</span>
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">←</kbd>
              <span className="font-bold text-akashiito text-[11px] ml-0.5">✕</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">D</kbd>
              <span className="text-ink/30 text-[9px]">·</span>
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">→</kbd>
              <span className="font-bold text-emerald-600 text-[11px] ml-0.5">◯</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 px-4 pb-6 pt-2 touch-none overflow-hidden overscroll-none">
        {remaining.map((card, i) => (
          <WordJudgeCard
            key={`${card.wordId}-${isRevising ? 'rev' : 'norm'}`}
            card={card}
            isTop={i === 0}
            stackOffset={i}
            onJudge={(isKnown) => {
              if (isRevising) {
                handleReviseCommit(card.wordId, isKnown);
              } else {
                handleJudge(card.wordId, isKnown);
              }
            }}
          />
        ))}
      </div>

      {showSuspendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowSuspendModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-line bg-paper p-5 shadow-xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-ink">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-line/30 text-ink/70">
                <AlertCircle className="h-4 w-4" />
              </div>
              <h3 className="font-mincho text-base font-bold text-ink">
                テストを中断しますか？
              </h3>
            </div>

            <p className="font-maru text-xs text-ink/70 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-line/60">
              ここまでの回答は<strong>すべて保存されています</strong>。いつでも続きから再開できます。
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line bg-white font-maru text-xs font-medium text-ink/70 transition active:scale-98 cursor-pointer hover:bg-paper"
              >
                続ける
              </button>
              <button
                type="button"
                onClick={() => router.push(backUrl)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer hover:bg-ink/90"
              >
                中断する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`
);

// -----------------------------------------------------------------------------
// 5. components/test/TestResultScreen.tsx
//    backUrl / backLabel による戻るボタンリンクの切り替え
// -----------------------------------------------------------------------------
writeFile(
  'components/test/TestResultScreen.tsx',
  `'use client';

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
  backUrl?: string;
  backLabel?: string;
}

export function TestResultScreen({
  correctCount,
  totalCount,
  wrongCards,
  sessionType,
  saveStatus,
  backUrl = '/dashboard',
  backLabel = 'ダッシュボードへ戻る',
}: TestResultScreenProps) {
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const isPerfect = wrongCards.length === 0;
  const isDailyCheck = sessionType === 'daily_check';

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between p-6 bg-paper animate-in fade-in duration-200 select-none">
      <div className="space-y-6">
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
                  {isDailyCheck ? '本番チェック記録完了' : '練習結果を記録完了'}
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

      <div className="pt-6 pb-2 space-y-2">
        <Link
          href={backUrl}
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
        >
          {backLabel}
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
`
);

// -----------------------------------------------------------------------------
// 6. components/dashboard/TodayRangeCard.tsx
//    ランダム出題トグルUIの追加 & 本番時+5点ボーナスの明記
// -----------------------------------------------------------------------------
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

  // ランダム出題設定 (localStorageで永続保持)
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
}
`
);

// -----------------------------------------------------------------------------
// 7. components/weakness/DrillFilterDialog.tsx
//    弱点マップドリルでのランダム出題トグル追加
// -----------------------------------------------------------------------------
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
}
`
);

// -----------------------------------------------------------------------------
// 8. components/weekly-range/WeeklyRangeModal.tsx
//    1日の標準学習単語数を 50問 に更新 (初期値 50)
// -----------------------------------------------------------------------------
writeFile(
  'components/weekly-range/WeeklyRangeModal.tsx',
  `'use client';

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
  // 1日の標準単語数を 50問 に更新
  const [perDayCount, setPerDayCount] = useState<number>(initialPerDayCount ?? 50);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRangeStart(initialRangeStart ?? 1);
      setPerDayCount(initialPerDayCount ?? 50);
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

  const overflowMessage = \`⚠️ 単語帳の最大No.(\${wordbookTotalWords})を超えています(No.\${preview.calculatedEnd}まで到達予定)。1日の単語数または開始No.を調整してください\`;

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
        style={{ transform: \`translateY(\${dragY}px)\` }}
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
            className={\`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition cursor-pointer \${
              activeTab === 'settings' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
            }\`}
          >
            ⚙️ ペース設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={\`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition cursor-pointer \${
              activeTab === 'preview' ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-white text-ink/70'
            }\`}
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
            {isSubmitting ? '保存中…' : \`保存してスケジュールを確定 (No.\${rangeStart}〜No.\${preview.calculatedEnd})\`}
          </button>
        </div>
      </div>
    </div>
  );
}
`
);

// -----------------------------------------------------------------------------
// 9. components/weekly-range/CycleSettingsPanel.tsx
//    チップ群を 50問運用向けに更新 [20, 30, 40, 50, 75, 100]
// -----------------------------------------------------------------------------
writeFile(
  'components/weekly-range/CycleSettingsPanel.tsx',
  `'use client';

import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import { DaySequenceEditor } from './DaySequenceEditor';

const START_QUICK_ADDS = [10, 50, 100];
const PER_DAY_CHIPS = [20, 30, 40, 50, 75, 100];

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
              className={\`min-h-[44px] rounded-xl border px-2 text-sm transition \${
                cycleType === opt.value
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 active:bg-paper'
              }\`}
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
        <p className="mb-1.5 font-maru text-xs font-medium text-ink/60">1日の単語数 (標準50語)</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangePerDayCount(Math.max(1, perDayCount - 10))}
            className="min-h-[46px] min-w-[46px] rounded-xl border border-line bg-white text-lg font-bold text-ink shadow-sm transition active:bg-paper"
            aria-label="10減らす"
          >
            −10
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
            onClick={() => onChangePerDayCount(perDayCount + 10)}
            className="min-h-[46px] min-w-[46px] rounded-xl border border-line bg-white text-lg font-bold text-ink shadow-sm transition active:bg-paper"
            aria-label="10増やす"
          >
            ＋10
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PER_DAY_CHIPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangePerDayCount(n)}
              className={\`min-h-[36px] rounded-full border px-3 text-xs transition \${
                perDayCount === n ? 'border-ink bg-ink text-paper font-bold shadow-sm' : 'border-line bg-white text-ink/70 active:bg-paper'
              }\`}
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
`
);

// -----------------------------------------------------------------------------
// 10. app/api/test-sessions/start/route.ts
//     isRandomOrder フラグの受領と test_sessions.is_random_order 保存
// -----------------------------------------------------------------------------
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

    // 3. 新規セッションを作成 (is_random_order を永続化)
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
}
`
);

// -----------------------------------------------------------------------------
// 11. app/api/test-sessions/complete/route.ts
//     daily_check完走時、is_random_order なら +5点ボーナス (最大100) を後処理付与
// -----------------------------------------------------------------------------
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

    // 1. 対象セッションを取得 (is_random_order を含めて取得)
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("id, user_id, date, type, completed_at, is_random_order")
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

    // 6. 全体連続学習ストリーク更新
    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", (streakErr as any)?.message || String(streakErr));
    }

    // 7. 単語ごとの連続正解カウント更新
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
        // computeDailyScore.ts の数式はそのまま利用 (不可侵事項遵守)
        computedScore = await computeAndSaveDailyScore({
          supabase,
          userId: user.id,
          date: today,
          answers: answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        });

        // ランダム出題の場合のみ、+5点ボーナスを後処理で付与 (最大100にクランプ)
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
}
`
);

// -----------------------------------------------------------------------------
// 12. app/(main)/group/page.tsx
//     ランキングで random_bonus_applied 獲得者に小さなバッジを表示
// -----------------------------------------------------------------------------
writeFile(
  'app/(main)/group/page.tsx',
  `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { Users, User, Trophy, Shuffle } from 'lucide-react';
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

interface ScoreEntryWithBonus extends DailyScoreEntryData {
  random_bonus_applied?: boolean;
}

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
      .select('user_id, date, raw_score, normalized_score, word_count, accuracy_rate, avg_difficulty_weight, avg_diminishing_factor, random_bonus_applied')
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
  const allGroupEntries = (scoreRowsRes.data ?? []) as ScoreEntryWithBonus[];
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
              const hasBonus = !!scoreEntry?.random_bonus_applied;

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
                        {hasBonus && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-300 px-1.5 py-0.2 font-maru text-[9px] font-bold text-amber-900">
                            <Shuffle className="h-2.5 w-2.5 text-amber-700" />
                            <span>+5</span>
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

      <div className="pt-4 border-t border-line/40 flex justify-center">
        <LeaveGroupDialog />
      </div>
    </main>
  );
}
`
);

console.log('\\n✨ [フェーズF-8] 全ファイルの生成・更新が完了しました。');
```