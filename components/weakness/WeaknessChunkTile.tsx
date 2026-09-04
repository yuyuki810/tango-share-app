'use client';

import React from 'react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessChunkTileProps {
  chunk: ChunkStat;
  onClick: (chunk: ChunkStat) => void;
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

export const WeaknessChunkTile: React.FC<WeaknessChunkTileProps> = ({ chunk, onClick }) => {
  const hasAttempts = chunk.totalAttempts > 0;
  const accuracy = chunk.accuracyRate;

  let styleClass = 'border-line bg-paper text-ink';
  let badgeText = '良好';
  let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';

  if (!hasAttempts) {
    styleClass = 'border-line/60 bg-white text-ink/40';
    badgeText = '未受検';
    badgeStyle = 'bg-line/20 text-ink/40 border-line/40';
  } else if (accuracy < 60) {
    styleClass = 'border-akashiito-border bg-akashiito/10 text-ink shadow-2xs';
    badgeText = '要注意';
    badgeStyle = 'bg-akashiito/20 text-akashiito border-akashiito-border font-bold';
  } else if (accuracy < 80) {
    styleClass = 'border-amber-300/80 bg-amber-50/50 text-ink';
    badgeText = 'やや注意';
    badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
  }

  const totalSessionsCount = chunk.fullHistory.length + chunk.drillHistory.length;

  return (
    <button
      type="button"
      onClick={() => onClick(chunk)}
      className={`relative flex min-h-[120px] min-w-[130px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] hover:shadow-xs cursor-pointer ${styleClass}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="font-maru text-[11px] font-bold text-ink/60">
            {formatDateLabel(chunk.originDate)}
          </span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${badgeStyle}`}>
            {badgeText}
          </span>
        </div>
        <p className="mt-1.5 font-mincho text-sm font-bold tracking-tight text-ink">
          No.{chunk.rangeStart}〜{chunk.rangeEnd}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-line/40 pt-2">
        <div>
          <span className="block font-maru text-[10px] text-ink/50">正答率</span>
          <span className="font-mincho text-lg font-bold text-ink">
            {hasAttempts ? `${accuracy}%` : '—'}
          </span>
        </div>
        <span className="font-maru text-[10px] text-ink/50">
          {hasAttempts ? `${totalSessionsCount}回受検` : '未受検'}
        </span>
      </div>
    </button>
  );
};
