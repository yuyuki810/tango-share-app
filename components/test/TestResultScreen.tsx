'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { WordCardData } from '@/components/review/WordJudgeCard';
import type { LearningPatternBadgeResult } from '@/lib/scoring/diagnoseLearningPattern';
import { Info, X, Sparkles } from 'lucide-react';

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
  dailyScore?: {
    normalizedScore?: number;
    rawScore?: number;
    referenceMaxScore?: number;
    randomBonusApplied?: boolean;
  } | null;
  learningPatternBadge?: LearningPatternBadgeResult | null;
}

export function TestResultScreen({
  correctCount,
  totalCount,
  wrongCards,
  sessionType,
  saveStatus,
  backUrl = '/dashboard',
  backLabel = 'ダッシュボードへ戻る',
  dailyScore,
  learningPatternBadge,
}: TestResultScreenProps) {
  const [showScoreInfo, setShowScoreInfo] = useState(false);
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

          <div className="mt-5 rounded-3xl border border-line bg-white p-5 shadow-sm text-center space-y-4">
            <div>
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

            {isDailyCheck && (
              <div className="pt-3 border-t border-line/60 space-y-3">
                {dailyScore?.normalizedScore !== undefined && (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-maru text-xs font-bold text-ink/70">獲得スコア</span>
                      {dailyScore.randomBonusApplied && (
                        <span className="rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.2 font-maru text-[9px] font-bold text-amber-900">
                          🔀 +5点
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mincho text-2xl font-bold text-ink">
                        {dailyScore.normalizedScore}
                      </span>
                      <span className="font-maru text-xs font-bold text-ink/60">点</span>
                    </div>
                  </div>
                )}

                {learningPatternBadge ? (
                  <div className={`rounded-2xl border p-3.5 text-left transition ${learningPatternBadge.colorClass}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="font-maru text-xs font-bold">{learningPatternBadge.name}</span>
                      </div>
                      <span className="font-maru text-[10px] font-bold opacity-70">本日の学習診断</span>
                    </div>
                    <p className="font-maru text-xs leading-relaxed opacity-90">
                      {learningPatternBadge.message}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowScoreInfo(true)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-line bg-paper/70 p-2.5 font-maru text-xs font-medium text-ink/70 hover:bg-paper cursor-pointer transition"
                  >
                    <Info className="h-3.5 w-3.5 text-ink/40" />
                    <span>獲得スコアの計算の仕組みを見る</span>
                  </button>
                )}
              </div>
            )}
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
                <span>{isDailyCheck ? '本番チェック記録完了' : '練習結果を記録完了'}</span>
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

      {showScoreInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowScoreInfo(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-line bg-white p-5 shadow-xl space-y-3 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-mincho text-base font-bold text-ink">獲得スコアの仕組み</h3>
              <button
                type="button"
                onClick={() => setShowScoreInfo(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="font-maru text-xs text-ink/80 leading-relaxed bg-paper/60 p-3.5 rounded-2xl border border-line/60">
              スコアはその日の目標語数（基準値）と単語の習熟度によって計算されます。まだ自信のない単語に正解するほど配点が高く、定着済みの単語は配点が控えめになります。
            </p>
            <button
              type="button"
              onClick={() => setShowScoreInfo(false)}
              className="flex min-h-[42px] w-full items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
