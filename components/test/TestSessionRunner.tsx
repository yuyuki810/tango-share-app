'use client';

import { useState, useEffect, useRef } from "react";
import { WordJudgeCardScreen } from "@/components/review/WordJudgeCardScreen";
import type { WordCardData } from "@/components/review/WordJudgeCard";
import { ChunkSummaryScreen, type ChunkResultItem } from "@/components/weakness/ChunkSummaryScreen";
import { TestResultScreen } from "@/components/test/TestResultScreen";
import type { ReviewChunkSummaryInfo } from "@/lib/test/getTodayTestWords";
import { RefreshCw, Play, RotateCcw } from "lucide-react";

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface TestSessionRunnerProps {
  cards: WordCardData[];
  dailyAssignmentId: string | null;
  sessionType: "daily_check" | "normal";
  isReviewDay?: boolean;
  reviewChunks?: ReviewChunkSummaryInfo[];
  backUrl?: string;
  backLabel?: string;
  isRandomOrder?: boolean;
}

export function TestSessionRunner({
  cards: initialCards,
  dailyAssignmentId,
  sessionType,
  isReviewDay = false,
  reviewChunks = [],
  backUrl = "/dashboard",
  backLabel = "ダッシュボードへ戻る",
  isRandomOrder = false,
}: TestSessionRunnerProps) {
  const [cards, setCards] = useState<WordCardData[]>(initialCards);
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

  const initSession = (currentCardList: WordCardData[]) => {
    setIsInitializing(true);
    const cardWordIds = currentCardList.map((c) => c.wordId);

    fetch("/api/test-sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: sessionType,
        dailyAssignmentId,
        totalCount: currentCardList.length,
        wordIds: cardWordIds,
        isRandomOrder,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          const currentId = data.session.id;
          setSessionId(currentId);
          sessionIdRef.current = currentId;

          if (pendingAnswersQueue.current.length > 0) {
            pendingAnswersQueue.current.forEach((item) => {
              const matchedCard = currentCardList.find((c) => c.wordId === item.wordId);
              fetch("/api/test-sessions/answer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId: currentId,
                  wordId: item.wordId,
                  isKnown: item.isKnown,
                  originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
                }),
              }).catch((e) => console.error("Queue flush error:", e));
            });
            pendingAnswersQueue.current = [];
          }

          if (data.mode === "resume" && Array.isArray(data.answeredWords) && data.answeredWords.length > 0) {
            const answeredWords: Array<{ wordId: string; isKnown: boolean }> = data.answeredWords;
            const isValidCount = answeredWords.length < currentCardList.length;
            const isMatchWords = answeredWords.every(
              (a, idx) => a.wordId === currentCardList[idx]?.wordId
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
        }
      })
      .finally(() => {
        setIsInitializing(false);
      });
  };

  useEffect(() => {
    setCards(initialCards);
    initSession(initialCards);
  }, [sessionType, dailyAssignmentId, initialCards, isRandomOrder]);

  // 最初からやり直す (再シャッフル + 新セッション発行)
  const handleRestartFromScratch = () => {
    let nextCards = cards;
    if (isRandomOrder) {
      nextCards = shuffleArray(cards);
      setCards(nextCards);
    }
    setInitialAnswers(new Map());
    setInitialIndex(0);
    setResumePrompt(null);
    initSession(nextCards);
  };

  const handleSingleJudge = (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    const matchedCard = cards.find((c) => c.wordId === wordId);

    if (!currentId) {
      pendingAnswersQueue.current.push({ wordId, isKnown });
      return;
    }

    fetch("/api/test-sessions/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentId,
        wordId,
        isKnown,
        originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
      }),
    }).catch((err) => {
      console.error("Answer streaming error:", err);
    });
  };

  const handleModifyJudge = async (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    if (!currentId) return;

    try {
      const res = await fetch("/api/test-sessions/modify-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentId,
          wordId,
          isKnown,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to modify answer:", data.error);
      }
    } catch (err) {
      console.error("Modify answer request error:", err);
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
            (typeof c.number === "number" &&
              c.number >= rc.rangeStart &&
              c.number <= rc.rangeEnd)
        );
        const cTotal = chunkCards.length;
        const cCorrect = chunkCards.filter((c) => resultsMap.get(c.wordId) ?? false).length;
        const cAccuracy = cTotal > 0 ? Math.round((cCorrect / cTotal) * 100) : 0;

        let status: "improved" | "same" | "worse" | "first" = "first";
        if (rc.prevAccuracyRate !== null) {
          const diff = cAccuracy - rc.prevAccuracyRate;
          if (diff >= 10) {
            status = "improved";
          } else if (diff <= -10) {
            status = "worse";
          } else {
            status = "same";
          }
        } else {
          status = "first";
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

    fetch("/api/test-sessions/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
            errorMessage: data.error || "保存エラー",
            detail: data.detail || `HTTP ${res.status}`,
          });
        }
      })
      .catch((err) => {
        console.error("Error completing test session:", err);
        setSaveStatus({
          isSaving: false,
          isSuccess: false,
          errorMessage: "通信エラー",
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
    const isDailyCheck = sessionType === "daily_check";
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
                onClick={handleRestartFromScratch}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line bg-paper font-maru text-xs font-medium text-ink/70 transition hover:bg-paper-hover active:scale-98 cursor-pointer"
              >
                最初からやり直す (再シャッフル)
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
      title={sessionType === "daily_check" ? "本日のテスト結果" : "苦手克服テスト結果"}
      backUrl={backUrl}
      backLabel={backLabel}
    />
  );
}
