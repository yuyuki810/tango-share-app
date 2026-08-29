import React from 'react';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak <= 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-line text-xs font-sans text-stone-600">
      <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
      <span>
        <strong className="font-semibold text-ink">{streak}</strong> 日連続
      </span>
    </div>
  );
}
