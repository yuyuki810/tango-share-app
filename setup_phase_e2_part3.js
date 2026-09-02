/**
 * setup_phase_e2_part3.js
 * フェーズE-2: フロントエンド（再開ダイアログ・都度保存・完了判定）一括反映スクリプト
 * 
 * 実行方法:
 *   node setup_phase_e2_part3.js
 */

const fs = require('fs');
const path = require('path');

function writeFile(relativeFilePath, fileContent) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf8');
  console.log(`[FILE] 生成完了: ${relativeFilePath}`);
}

console.log('=== フェーズE-2 フロントエンドコンポーネントの生成を開始します ===\n');

// -----------------------------------------------------------------------------
// 1. components/review/WordJudgeCardScreen.tsx
// -----------------------------------------------------------------------------
const wordJudgeCardScreenTsx = `'use client';

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
            style={{ width: \`\${(currentIndex / total) * 100}%\` }}
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
`;

writeFile('components/review/WordJudgeCardScreen.tsx', wordJudgeCardScreenTsx);

// -----------------------------------------------------------------------------
// 2. components/test/TestSessionRunner.tsx (再開確認ダイアログ & 都度保存)
// -----------------------------------------------------------------------------
const testSessionRunnerTsx = `'use client';

import { useState, useEffect } from 'react';
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [resumePrompt, setResumePrompt] = useState<{
    answeredCount: number;
    answeredMap: Map<string, boolean>;
  } | null>(null);

  const [initialIndex, setInitialIndex] = useState(0);
  const [initialAnswers, setInitialAnswers] = useState<Map<string, boolean>>(new Map());

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
          setSessionId(data.session.id);

          // 未完了セッションがあり、回答済みの単語がある場合
          if (data.mode === 'resume' && data.answeredWords && data.answeredWords.length > 0) {
            const answeredMap = new Map<string, boolean>();
            data.answeredWords.forEach((a: any) => {
              answeredMap.set(a.wordId, a.isKnown);
            });

            // まだ未回答の単語が残っている場合は再開ダイアログを表示
            if (data.answeredWords.length < cards.length) {
              setResumePrompt({
                answeredCount: data.answeredWords.length,
                answeredMap,
              });
            } else {
              // 既に全問解いている場合はそのまま完了判定へ
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

  // 2. 単語判定のたびに即座に都度保存 (/api/test-sessions/answer)
  const handleSingleJudge = (wordId: string, isKnown: boolean) => {
    if (!sessionId) return;

    const matchedCard = cards.find((c) => c.wordId === wordId);
    fetch('/api/test-sessions/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        wordId,
        isKnown,
        originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
      }),
    }).catch((err) => {
      console.error('Answer streaming error:', err);
    });
  };

  // 3. 全問終了時のセッション完了確定処理 (/api/test-sessions/complete)
  const handleFinished = (resultsMap: Map<string, boolean>) => {
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
        const cMistakes = cTotal - cCorrect;
        const cMistakeRate = cTotal > 0 ? Math.round((cMistakes / cTotal) * 100) / 100 : 0;

        let status: 'improved' | 'same' | 'worse' | 'first' = 'first';
        if (rc.prevMistakeRate !== null) {
          const diff = cMistakeRate - rc.prevMistakeRate;
          if (diff <= -0.1) {
            status = 'improved';
          } else if (diff >= 0.1) {
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
          mistakeRate: cMistakeRate,
          prevMistakeRate: rc.prevMistakeRate,
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

    // セッション完了確定
    fetch('/api/test-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
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
            detail: data.detail || \`HTTP \${res.status}\`,
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

  // ローディング中
  if (isInitializing) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-ink/60 font-maru">
        <RefreshCw className="h-6 w-6 animate-spin text-ink/40" />
        <p className="text-xs">テストを準備中...</p>
      </div>
    );
  }

  // 再開確認ダイアログ
  if (resumePrompt) {
    const isDailyCheck = sessionType === 'daily_check';
    return (
      <div className="mx-auto flex min-h-[85vh] max-w-md md:max-w-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-full rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200">
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
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer"
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
`;

writeFile('components/test/TestSessionRunner.tsx', testSessionRunnerTsx);

// -----------------------------------------------------------------------------
// 3. app/(main)/test/page.tsx (completed_at がある場合のみブロック)
// -----------------------------------------------------------------------------
const testPageTsx = `export const dynamic = 'force-dynamic';
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
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
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
    const weakCards = await getWeakWords(supabase, user.id, profile.wordbook_id);

    if (weakCards.length === 0) {
      return (
        <main className="mx-auto flex h-[80vh] max-w-md md:max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
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

  // 3. 本番デイリーチェックの完了済み重複受験ガード (completed_at がある場合のみブロック)
  if (sessionType === 'daily_check') {
    const { data: existingSession } = await supabase
      .from('test_sessions')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'daily_check')
      .maybeSingle();

    // 既に完了している場合のみブロック画面を表示 (未完了の場合はTestSessionRunnerで再開)
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
`;

writeFile('app/(main)/test/page.tsx', testPageTsx);

// -----------------------------------------------------------------------------
// 4. app/(main)/dashboard/page.tsx (completed_at があるセッションのみ完了判定)
// -----------------------------------------------------------------------------
const dashboardPageTsx = `import Link from 'next/link';
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

  // 週内（土〜金）の完了済み daily_check (completed_at IS NOT NULL) を取得
  const { data: weekDailyCheckSessions } = await supabase
    .from('test_sessions')
    .select('date')
    .eq('user_id', user.id)
    .eq('type', 'daily_check')
    .not('completed_at', 'is', null)
    .in('date', weekDates);

  const completedDates = new Set((weekDailyCheckSessions ?? []).map((s) => s.date));
  const isDailyCheckCompleted = completedDates.has(today);

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
            className="rounded-full border border-line bg-white px-2.5 py-1 font-maru text-[10px] md:text-xs text-ink/60 hover:text-ink transition"
          >
            🔍 自己診断
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-maru text-xs md:text-sm font-bold text-amber-900 shadow-2xs">
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
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
          <Link
            href="/weakness"
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
`;

writeFile('app/(main)/dashboard/page.tsx', dashboardPageTsx);

// -----------------------------------------------------------------------------
// 5. app/(main)/group/page.tsx (completed_at があるセッションのみ完了判定)
// -----------------------------------------------------------------------------
const groupPageTsx = `export const dynamic = 'force-dynamic';
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
      <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl px-4 py-8 text-center space-y-4">
        <h1 className="font-mincho text-xl md:text-2xl font-bold text-ink">グループに参加していません</h1>
        <p className="font-maru text-xs md:text-sm text-ink/60">
          グループを作成するか、招待コードを入力して参加してください。
        </p>
        <Link
          href="/join-group"
          className="inline-block rounded-xl bg-ink px-4 py-2.5 text-xs md:text-sm font-bold text-paper font-maru"
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

  // 1. 本日の 完了済み daily_check セッションを取得 (completed_at IS NOT NULL)
  const { data: todaySessions } = await supabase
    .from('test_sessions')
    .select('user_id')
    .eq('type', 'daily_check')
    .eq('date', today)
    .not('completed_at', 'is', null)
    .in('user_id', memberIds);

  const doneUserIds = new Set((todaySessions ?? []).map((s) => s.user_id));

  // 2. 本日のスコアエントリーを取得
  const { data: scoreRows } = await supabase
    .from('daily_score_entries')
    .select('user_id, date, raw_score, normalized_score, word_count, accuracy_rate, avg_difficulty_weight, avg_diminishing_factor')
    .eq('date', today)
    .in('user_id', memberIds);

  const allGroupEntries = (scoreRows ?? []) as DailyScoreEntryData[];
  const scoreMap = new Map(allGroupEntries.map((s) => [s.user_id, s]));

  // 3. 各メンバーのストリークを取得
  const { data: streaks } = await supabase
    .from('streaks')
    .select('user_id, current_streak')
    .in('user_id', memberIds);

  const streakMap = new Map((streaks ?? []).map((s) => [s.user_id, s.current_streak ?? 0]));

  // 4. 受験済みメンバーをランキング順にソート (normalized_score 降順 -> raw_score 降順)
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

  // 5. 各受験メンバーのアーキタイプを判定
  const archetypeMap = new Map<string, ArchetypeResult | null>();
  for (const m of doneMembers) {
    const arch = await determineArchetype(supabase, m.id, today, allGroupEntries);
    archetypeMap.set(m.id, arch);
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
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
            style={{ width: \`\${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%\` }}
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
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-sm md:text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98"
          >
            今日の本番チェックを受ける
          </Link>
        )}
      </div>

      {/* ランキング一覧 (受験済みメンバー) */}
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

              // 順位ごとのバッジ
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
                  className={\`flex items-start justify-between rounded-2xl border p-4 md:p-5 shadow-xs transition \${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }\`}
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

                      {/* アーキタイプバッジ & 皆勤賞バッジ & フォールバックⓘ */}
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

      {/* 未受験メンバー一覧 */}
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
                  className={\`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition \${
                    isMe
                      ? 'border-akashiito-border/60 bg-akashiito-subtle/30'
                      : 'border-dashed border-line bg-white/60 text-ink/60'
                  }\`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mincho text-sm md:text-base font-bold text-ink/80">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-akashiito/10 px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold text-akashiito">
                            あなた
                          </span>
                        )}
                      </div>
                      {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                    </div>
                  </div>
                  <span className="rounded-full bg-stone-100 border border-line px-2.5 py-0.5 font-maru text-xs md:text-sm font-medium text-stone-500">
                    未受験
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
`;

writeFile('app/(main)/group/page.tsx', groupPageTsx);

console.log('\n================================================================');
console.log('✅ フロントエンドコンポーネントの一括生成が完了しました！');
console.log('================================================================\n');