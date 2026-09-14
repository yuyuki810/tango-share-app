'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  label?: string;
  className?: string;
}

export function RefreshButton({ label = '更新', className = '' }: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = () => {
    if (isPending || isSpinning) return;
    setIsSpinning(true);
    startTransition(() => {
      router.refresh();
    });
    setTimeout(() => {
      setIsSpinning(false);
    }, 800);
  };

  const active = isPending || isSpinning;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={active}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs font-semibold text-ink/70 shadow-2xs transition active:scale-95 hover:bg-paper hover:text-ink cursor-pointer disabled:opacity-60 ${className}`}
      aria-label="ページを最新に更新"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${active ? 'animate-spin text-ink' : 'text-ink/50'}`} />
      <span>{active ? '更新中…' : label}</span>
    </button>
  );
}
