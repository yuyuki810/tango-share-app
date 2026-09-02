'use client';

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
            style={{ width: `${(currentIndex / total) * 100}%` }}
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
