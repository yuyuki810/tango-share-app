'use client';

import React from 'react';
import { Layers } from 'lucide-react';

export interface MemberContribution {
  userId: string;
  name: string;
  answerCount: number;
}

interface GroupContributionBarProps {
  contributions: MemberContribution[];
  periodLabel: string;
}

const PALETTE = [
  '#378ADD',
  '#639922',
  '#EF9F27',
  '#7F77DD',
  '#E24B4A',
  '#136C56',
  '#D4537E',
  '#8D95A5',
];

export function GroupContributionBar({ contributions, periodLabel }: GroupContributionBarProps) {
  const totalAnswers = contributions.reduce((sum, c) => sum + c.answerCount, 0);

  return (
    <div className="rounded-3xl border border-line bg-white p-5 md:p-6 shadow-xs space-y-3.5 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-ink/60" />
          <h3 className="font-mincho text-sm md:text-base font-bold text-ink">
            グループ共同演習ゲージ ({periodLabel})
          </h3>
        </div>
        <span className="font-maru text-xs md:text-sm font-bold text-ink">
          合計 <strong className="font-mono text-base">{totalAnswers}</strong> 語解答
        </span>
      </div>

      <div className="h-3 md:h-3.5 w-full overflow-hidden rounded-full bg-line/30 flex shadow-inner">
        {totalAnswers > 0 ? (
          contributions.map((c, i) => {
            if (c.answerCount === 0) return null;
            const pct = (c.answerCount / totalAnswers) * 100;
            const color = PALETTE[i % PALETTE.length];

            return (
              <div
                key={c.userId}
                style={{ width: `${pct}%`, backgroundColor: color }}
                className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                title={`${c.name}: ${c.answerCount}語 (${Math.round(pct)}%)`}
              />
            );
          })
        ) : (
          <div className="h-full w-full bg-line/20 rounded-full" />
        )}
      </div>

      {totalAnswers > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
          {contributions.map((c, i) => {
            const pct = totalAnswers > 0 ? Math.round((c.answerCount / totalAnswers) * 100) : 0;
            const color = PALETTE[i % PALETTE.length];

            return (
              <div key={c.userId} className="flex items-center gap-1.5 font-maru text-xs">
                <span
                  style={{ backgroundColor: color }}
                  className="h-2.5 w-2.5 rounded-full inline-block shrink-0 shadow-2xs"
                />
                <span className="font-bold text-ink">{c.name}</span>
                <span className="text-ink/50 font-mono text-[11px]">
                  {c.answerCount}語 ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="font-maru text-[11px] text-ink/40">
          まだこの期間のテスト解答データがありません。テストを進めるとゲージが伸びていきます！
        </p>
      )}
    </div>
  );
}
