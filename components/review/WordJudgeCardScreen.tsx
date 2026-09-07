'use client';

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

  // 中断確認ダイアログ表示ステート
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  // 直前1問の修正ステート
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

  // 通常進行時 vs 修正モード時
  const effectiveIndex = isRevising && revisionIndex !== null ? revisionIndex : currentIndex;
  const remaining = isRevising && revisionIndex !== null
    ? [cards[revisionIndex]]
    : cards.slice(currentIndex, currentIndex + MAX_STACK_VISIBLE);

  // 通常判定
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

  // 修正判定の確定
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

  // 「前の回答を修正」ボタンの押下処理
  const handleStartRevision = () => {
    if (isRevising || currentIndex <= 0) return;
    const targetIdx = currentIndex - 1;
    setRevisionIndex(targetIdx);
    setIsRevising(true);
  };

  // 全問終了時は結果画面を表示
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
            href="/dashboard"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
          >
            ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const canRevise = currentIndex > 0 && !isRevising;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col justify-between overflow-hidden max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full select-none">
      {/* 上部ヘッダー操作部: [中断ボタン] [修正中バッジ/前の回答を修正] [プログレス] */}
      <div className="px-4 pb-2 pt-3 shrink-0 space-y-2 select-none" style={{ touchAction: 'manipulation' }}>
        <div className="flex items-center justify-between">
          {/* 1. 中断ボタン */}
          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line/80 bg-white/90 px-3 py-1 font-maru text-xs text-ink/60 transition active:scale-95 hover:text-ink cursor-pointer shadow-2xs"
            aria-label="テストを中断する"
          >
            <LogOut className="h-3 w-3 text-ink/40" />
            <span>中断</span>
          </button>

          {/* 2. 前の回答を修正ボタン / 修正中表示 */}
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
              aria-label="直前の1問の回答を修正する"
            >
              <RotateCcw className="h-3 w-3 text-ink/40" />
              <span>前の回答を修正</span>
            </button>
          )}

          {/* 3. 進捗カウンター */}
          <span className="font-mono text-xs text-ink/60 font-bold select-none pointer-events-none">
            {effectiveIndex + 1}/{total}
          </span>
        </div>

        {/* プログレスバー */}
        <div className="h-1.5 md:h-2 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((effectiveIndex) / total) * 100}%` }}
          />
        </div>

        {/* デスクトップ用キー操作ガイド (HUD) */}
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

      {/* カードスタック領域 */}
      <div className="relative flex-1 px-4 pb-6 pt-2">
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

      {/* 中断確認モーダル (誤タップ完全防止) */}
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
              ここまでの回答は<strong>すべて保存されています</strong>。ダッシュボードからいつでも続きを再開できます。
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
                onClick={() => router.push('/dashboard')}
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
