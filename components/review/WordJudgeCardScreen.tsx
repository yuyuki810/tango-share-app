'use client';

import { useState } from 'react';
import { WordJudgeCard, type WordCardData } from './WordJudgeCard';

interface WordJudgeCardScreenProps {
  cards: WordCardData[];
  onJudge: (wordId: string, isKnown: boolean) => void;
  onAllDone?: () => void;
}

const MAX_STACK_VISIBLE = 3;

export function WordJudgeCardScreen({ cards, onJudge, onAllDone }: WordJudgeCardScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = cards.length;
  const remaining = cards.slice(currentIndex, currentIndex + MAX_STACK_VISIBLE);

  const handleJudge = (wordId: string, isKnown: boolean) => {
    onJudge(wordId, isKnown);
    const next = currentIndex + 1;
    if (next >= total) {
      onAllDone?.();
    }
    setCurrentIndex(next);
  };

  if (currentIndex >= total) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-mincho text-2xl font-bold text-ink">おつかれさま!</p>
        <p className="font-maru text-sm text-ink/60">{total}語の判定が終わりました</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 上部プログレスバー */}
      <div className="px-4 pb-2 pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
        <p className="mt-1 font-maru text-right text-xs text-ink/40">
          {currentIndex}/{total}
        </p>
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
