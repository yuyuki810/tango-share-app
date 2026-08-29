"use client";

import React, { useState, useEffect } from 'react';

interface DailyCheckCardProps {
  word: string;
  meaning: string;
  pronunciation?: string | null;
  currentIndex: number;
  totalCount: number;
  onJudged: (isKnown: boolean) => void;
}

export function DailyCheckCard({
  word,
  meaning,
  pronunciation,
  currentIndex,
  totalCount,
  onJudged,
}: DailyCheckCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [word]);

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-line p-6 shadow-xs flex flex-col justify-between min-h-[380px]">
      <div className="flex justify-between items-center text-xs font-mono text-stone-400">
        <span>Daily Check</span>
        <span>
          {currentIndex + 1} / {totalCount}
        </span>
      </div>

      <div className="text-center my-6">
        <h2 className="font-serif text-3xl sm:text-4xl text-ink font-bold tracking-tight">
          {word}
        </h2>
        {pronunciation && (
          <p className="text-sm font-sans text-stone-400 mt-1">{pronunciation}</p>
        )}

        <div className="mt-8 min-h-[72px] flex items-center justify-center">
          {!isRevealed ? (
            <button
              type="button"
              onClick={() => setIsRevealed(true)}
              className="text-xs text-stone-400 hover:text-stone-600 min-h-[44px] px-4 py-2 rounded-lg border border-dashed border-stone-200"
            >
              タップして意味を表示
            </button>
          ) : (
            <p className="font-serif text-xl text-ink font-semibold">{meaning}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4">
        <button
          type="button"
          onClick={() => onJudged(false)}
          className="min-h-[56px] rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium text-sm hover:bg-stone-100 active:scale-[0.98] transition-all"
        >
          わからなかった
        </button>
        <button
          type="button"
          onClick={() => onJudged(true)}
          className="min-h-[56px] rounded-xl bg-ink text-paper font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          わかった
        </button>
      </div>
    </div>
  );
}
