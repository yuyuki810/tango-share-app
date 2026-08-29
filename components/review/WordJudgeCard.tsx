"use client";

import React, { useState, useEffect } from "react";

export interface WordCardData {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  studyCount?: number;
  originDailyAssignmentId?: string;
  number?: number;
}

interface WordJudgeCardProps {
  card: WordCardData;
  onJudge: (isKnown: boolean) => void;
  currentIndex: number;
  totalCards: number;
}

export function WordJudgeCard({
  card,
  onJudge,
  currentIndex,
  totalCards,
}: WordJudgeCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [card.wordId]);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-between h-[480px] p-6 rounded-2xl bg-paper border border-line shadow-sm">
      <div className="flex items-center justify-between text-xs text-ink/50 font-maru">
        <span>
          {currentIndex + 1} / {totalCards}
        </span>
        {typeof card.studyCount === "number" && (
          <span>学習 {card.studyCount}回目</span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center my-4 space-y-4">
        <div>
          <h2 className="text-3xl font-bold text-ink font-mincho tracking-wide">
            {card.headword}
          </h2>
          {card.pronunciation && (
            <p className="text-xs text-ink/40 font-maru mt-1">
              {card.pronunciation}
            </p>
          )}
        </div>

        <div
          onClick={() => setIsRevealed(!isRevealed)}
          className="w-full min-h-[100px] p-4 rounded-xl border border-dashed border-line/80 flex items-center justify-center cursor-pointer transition select-none hover:bg-ink/5"
        >
          {isRevealed ? (
            <p className="text-lg font-medium text-ink font-mincho animate-in fade-in duration-150">
              {card.meaning}
            </p>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-ink/40 font-maru">
              <span className="w-2 h-2 rounded-full bg-akashiito/60 inline-block" />
              <span>タップして意味を表示</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => onJudge(false)}
          className="w-full py-3.5 rounded-xl border border-line bg-paper text-ink/70 font-bold text-sm transition hover:bg-ink/5 active:scale-[0.98] font-maru"
        >
          わからない
        </button>
        <button
          type="button"
          onClick={() => onJudge(true)}
          className="w-full py-3.5 rounded-xl bg-ink text-paper font-bold text-sm transition hover:opacity-90 active:scale-[0.98] font-maru"
        >
          わかる
        </button>
      </div>
    </div>
  );
}
