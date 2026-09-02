'use client';

import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from 'react';

export interface WordCardData {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  exampleSentence?: string;
  studyCount: number;
  originDailyAssignmentId?: string;
  number?: number;
}

interface WordJudgeCardProps {
  card: WordCardData;
  isTop: boolean;
  stackOffset: number;
  onJudge: (isKnown: boolean) => void;
}

const SWIPE_THRESHOLD_RATIO = 0.25;

function getHeadwordFontSize(word: string): string {
  const len = word.length;
  if (len <= 8) return 'text-5xl sm:text-6xl lg:text-7xl';
  if (len <= 12) return 'text-4xl sm:text-5xl lg:text-6xl';
  if (len <= 16) return 'text-3xl sm:text-4xl lg:text-5xl';
  return 'text-2xl sm:text-3xl lg:text-4xl';
}

export function WordJudgeCard({ card, isTop, stackOffset, onJudge }: WordJudgeCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const isPointerDown = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleReveal = useCallback(() => {
    if (!isRevealed) {
      setIsRevealed(true);
    }
  }, [isRevealed]);

  const commitJudge = useCallback(
    (isKnown: boolean) => {
      if (exitDirection !== null) return;
      setExitDirection(isKnown ? 'right' : 'left');
      setTimeout(() => onJudge(isKnown), 200);
    },
    [exitDirection, onJudge]
  );

  // キーボードショートカット処理 (Space / W : めくる, A / ← : 不正解, D / S / → : 正解)
  useEffect(() => {
    if (!isTop || exitDirection !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト入力欄にフォーカスがある場合はショートカットを無視
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const code = e.code;
      const key = e.key;

      // 1. めくる (Space, ArrowUp, KeyW, Enter)
      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'KeyW' ||
        key === ' ' ||
        key === 'ArrowUp' ||
        key === 'w' ||
        key === 'W' ||
        key === 'Enter'
      ) {
        e.preventDefault();
        handleReveal();
        return;
      }

      // 2. わからなかった (ArrowLeft, KeyA, a, A)
      if (
        code === 'ArrowLeft' ||
        code === 'KeyA' ||
        key === 'ArrowLeft' ||
        key === 'a' ||
        key === 'A'
      ) {
        e.preventDefault();
        commitJudge(false);
        return;
      }

      // 3. わかった (ArrowRight, KeyD, KeyS, d, D, s, S)
      if (
        code === 'ArrowRight' ||
        code === 'KeyD' ||
        code === 'KeyS' ||
        key === 'ArrowRight' ||
        key === 'd' ||
        key === 'D' ||
        key === 's' ||
        key === 'S'
      ) {
        e.preventDefault();
        commitJudge(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTop, exitDirection, handleReveal, commitJudge]);

  // ポインター / スワイプ操作
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTop || exitDirection !== null) return;
    if ((e.target as HTMLElement).closest('button[data-action="judge"]')) return;

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    isPointerDown.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current || dragStartX.current === null) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - (dragStartY.current ?? e.clientY);

    if (!isRevealed) return;

    if (!isDragging && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setIsDragging(true);
    }

    if (isDragging) {
      setDragX(deltaX);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;

    const deltaX = dragStartX.current !== null ? e.clientX - dragStartX.current : 0;
    const deltaY = dragStartY.current !== null ? e.clientY - dragStartY.current : 0;
    const isTap = Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10;

    if (!isRevealed && isTap) {
      handleReveal();
    } else if (isRevealed && isDragging) {
      const width = cardRef.current?.offsetWidth ?? 320;
      if (Math.abs(dragX) > width * SWIPE_THRESHOLD_RATIO) {
        commitJudge(dragX > 0);
      } else {
        setDragX(0);
      }
    } else {
      setDragX(0);
    }

    dragStartX.current = null;
    dragStartY.current = null;
    isPointerDown.current = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartX.current = null;
    dragStartY.current = null;
    isPointerDown.current = false;
    setIsDragging(false);
    setDragX(0);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const studyCountLabel = card.studyCount === 0 ? 'はじめての単語' : `${card.studyCount}回目`;
  const headwordFontSize = getHeadwordFontSize(card.headword);

  const transform = isTop
    ? exitDirection
      ? `translateX(${exitDirection === 'right' ? 550 : -550}px) rotate(${exitDirection === 'right' ? 10 : -10}deg)`
      : `translateX(${dragX}px) rotate(${dragX * 0.02}deg)`
    : 'none';

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform,
        zIndex: 10 - stackOffset,
        opacity: exitDirection ? 0 : 1,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      className={`absolute inset-0 flex select-none flex-col justify-between rounded-3xl border border-line bg-white p-6 md:p-8 lg:p-10 shadow-lg touch-none ${
        !isRevealed && isTop ? 'cursor-pointer' : ''
      } ${
        isTop && !isDragging
          ? 'transition-[transform,opacity] duration-200 motion-reduce:transition-none'
          : 'transition-none'
      }`}
    >
      {/* 1. 学習回数バッジ */}
      <div className="flex justify-between items-center">
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs md:text-sm text-ink/60 font-maru">
          {studyCountLabel}
        </span>
        {card.number && (
          <span className="font-mono text-xs text-ink/40">
            No.{card.number}
          </span>
        )}
      </div>

      {/* ドラッグ中のスタンプ表示 */}
      {isTop && isRevealed && dragX !== 0 && (
        <div
          style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}
          className={`pointer-events-none absolute top-16 z-20 rounded-xl border-2 px-4 py-1.5 text-sm md:text-base font-bold shadow-sm ${
            dragX > 0
              ? 'right-6 md:right-10 -rotate-12 border-ink text-ink bg-white/90'
              : 'left-6 md:left-10 rotate-12 border-ink/60 text-ink/60 bg-white/90'
          }`}
        >
          {dragX > 0 ? 'わかった' : 'わからなかった'}
        </div>
      )}

      {/* 2. 単語本体 */}
      <div className="my-auto flex w-full flex-col items-center justify-center gap-2 py-4 text-center">
        <p
          className={`w-full font-mincho font-bold text-ink tracking-tight whitespace-nowrap leading-normal py-2 ${headwordFontSize}`}
        >
          {card.headword}
        </p>
        {card.pronunciation ? (
          <p className="font-maru text-lg sm:text-xl md:text-2xl text-ink/75 tracking-wider">
            /{card.pronunciation}/
          </p>
        ) : (
          <div className="h-7" />
        )}
      </div>

      {/* 3. 下部エリア */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="relative h-24 md:h-28 overflow-hidden rounded-2xl">
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-paper p-3 md:p-4 text-center">
            <p className="font-maru text-base md:text-lg font-bold text-ink leading-snug">
              {card.meaning}
            </p>
            {card.exampleSentence && (
              <p className="mt-1 font-maru text-xs md:text-sm text-ink/50 line-clamp-1">
                {card.exampleSentence}
              </p>
            )}
          </div>

          <div
            style={{
              transform: isRevealed ? 'translateX(105%) rotate(6deg)' : 'translateX(0)',
            }}
            className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-akashiito text-sm md:text-base font-bold text-paper shadow-inner transition-transform duration-300 ease-out motion-reduce:transition-none ${
              isRevealed ? 'pointer-events-none' : ''
            }`}
          >
            タップして確認
          </div>
        </div>

        {/* 4. 判定ボタン (キーバッジなしのクリーンなボタン) */}
        <div
          className={`flex gap-3 md:gap-4 transition-opacity duration-200 ${
            isRevealed && isTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            data-action="judge"
            tabIndex={isRevealed && isTop ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              commitJudge(false);
            }}
            className="min-h-[56px] md:min-h-[60px] flex-1 rounded-2xl border border-line bg-white font-medium text-ink/70 transition active:bg-paper hover:bg-paper/50 flex items-center justify-center cursor-pointer shadow-xs"
          >
            わからなかった
          </button>
          <button
            type="button"
            data-action="judge"
            tabIndex={isRevealed && isTop ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              commitJudge(true);
            }}
            className="min-h-[56px] md:min-h-[60px] flex-1 rounded-2xl bg-ink font-medium text-paper transition active:opacity-90 hover:bg-ink/90 flex items-center justify-center cursor-pointer shadow-sm"
          >
            わかった
          </button>
        </div>
      </div>
    </div>
  );
}
