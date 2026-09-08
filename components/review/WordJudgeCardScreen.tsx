'use client';

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WordJudgeCard, type WordCardData } from "./WordJudgeCard";
import { RotateCcw, AlertCircle, LogOut } from "lucide-react";

export interface WordJudgeCardScreenProps {
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
  backUrl = "/dashboard",
}: WordJudgeCardScreenProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answersMap, setAnswersMap] = useState<Map<string, boolean>>(
    () => new Map(initialAnswers || [])
  );
  const resultsRef = useRef<Map<string, boolean>>(
    new Map(initialAnswers || [])
  );

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisionIndex, setRevisionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialAnswers) {
      resultsRef.current = new Map(initialAnswers);
      setAnswersMap(new Map(initialAnswers));
    }
    if (typeof initialIndex === "number") {
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
      onAllDone?.(resultsArray);
      onFinished?.(updatedMap);
    }
    setCurrentIndex(next);
  };

  const handleReviseCommit = async (wordId: string, isKnown: boolean) => {
    try {
      resultsRef.current.set(wordId, isKnown);
      setAnswersMap(new Map(resultsRef.current));
      if (onModifyJudge) {
        await onModifyJudge(wordId, isKnown);
      }
    } finally {
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

  const canRevise = currentIndex > 0 && !isRevising;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col justify-between overflow-hidden overscroll-none touch-none max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full select-none">
      <div className="px-4 pb-2 pt-3 shrink-0 space-y-2 select-none">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line/80 bg-white/90 px-3 py-1 font-maru text-xs text-ink/60 transition active:scale-95 hover:text-ink cursor-pointer shadow-2xs"
            style={{ touchAction: "manipulation" }}
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
                  ? "border-line bg-white text-ink/75 hover:bg-paper hover:text-ink"
                  : "border-transparent text-ink/20 pointer-events-none"
              }`}
              style={{ touchAction: "manipulation" }}
              aria-label="直前の1問の回答を修正する"
            >
              <RotateCcw className="h-3 w-3 text-ink/40" />
              <span>前の回答を修正</span>
            </button>
          )}

          <span className="font-mono text-xs text-ink/60 font-bold select-none pointer-events-none">
            {Math.min(effectiveIndex + 1, total)}/{total}
          </span>
        </div>

        <div className="h-1.5 md:h-2 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(Math.min(effectiveIndex, total) / total) * 100}%` }}
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
            key={`${card.wordId}-${isRevising ? "rev" : "norm"}`}
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
