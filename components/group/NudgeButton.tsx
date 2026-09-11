'use client';

import React, { useState } from 'react';
import { Heart, Check } from 'lucide-react';

interface NudgeButtonProps {
  targetUserId: string;
  isAlreadyNudged: boolean;
  canNudge: boolean;
}

export function NudgeButton({
  targetUserId,
  isAlreadyNudged: initialNudged,
  canNudge,
}: NudgeButtonProps) {
  const [isNudged, setIsNudged] = useState(initialNudged);
  const [isLoading, setIsLoading] = useState(false);

  if (!canNudge) return null;

  const handleSendNudge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNudged || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/nudges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: targetUserId }),
      });

      if (res.ok || res.status === 409) {
        setIsNudged(true);
      }
    } catch (err) {
      console.error('Failed to send nudge:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isNudged) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-line/30 px-2.5 py-1 font-maru text-[10px] font-bold text-ink/40 select-none">
        <Check className="h-3 w-3" />
        <span>応援済み</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSendNudge}
      disabled={isLoading}
      className="inline-flex items-center gap-1 rounded-full border border-akashiito-border bg-akashiito/10 hover:bg-akashiito/20 px-2.5 py-1 font-maru text-[10px] font-bold text-akashiito transition active:scale-95 cursor-pointer disabled:opacity-50"
    >
      <Heart className={`h-3 w-3 ${isLoading ? 'animate-pulse' : 'fill-akashiito'}`} />
      <span>{isLoading ? '送信中…' : '応援する'}</span>
    </button>
  );
}
