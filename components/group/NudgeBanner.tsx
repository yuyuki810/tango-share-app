'use client';

import React, { useState } from 'react';
import { Heart, X } from 'lucide-react';

interface NudgeBannerProps {
  senderNames: string[];
}

export function NudgeBanner({ senderNames }: NudgeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || senderNames.length === 0) return null;

  const namesLabel =
    senderNames.length === 1
      ? `${senderNames[0]}さん`
      : `${senderNames[0]}さん、${senderNames[1]}さん${senderNames.length > 2 ? `たち${senderNames.length}人` : ''}`;

  return (
    <div className="flex items-center justify-between rounded-2xl border border-akashiito-border bg-[#FDF2F1] p-3.5 shadow-2xs animate-in fade-in duration-200 text-left">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-akashiito text-white shadow-2xs">
          <Heart className="h-4 w-4 fill-white" />
        </div>
        <div>
          <p className="font-mincho text-xs md:text-sm font-bold text-ink">
            {namesLabel} から応援が届いています！
          </p>
          <p className="font-maru text-[11px] text-ink/60 mt-0.5">
            「今日もいっしょに頑張ろう！」
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer"
        aria-label="閉じる"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
