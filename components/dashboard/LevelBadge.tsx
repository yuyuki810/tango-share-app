'use client';

import React from 'react';
import { calculateLevel } from '@/lib/level/levelSystem';
import { Zap } from 'lucide-react';

interface LevelBadgeProps {
  totalExp: number;
}

export function LevelBadge({ totalExp }: LevelBadgeProps) {
  const info = calculateLevel(totalExp);

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white border border-line p-2.5 shadow-2xs text-left">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-mincho text-xs font-bold shadow-2xs shrink-0">
        Lv.{info.level}
      </div>
      <div className="flex-1 space-y-1 min-w-[100px]">
        <div className="flex justify-between items-center font-maru text-[10px]">
          <span className="font-bold text-ink/70 flex items-center gap-0.5">
            <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span>累積EXP: {info.currentExp}</span>
          </span>
          <span className="text-ink/40">次まで {info.nextLevelExp - info.currentLevelExp} EXP</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/30">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-300"
            style={{ width: `${info.progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
