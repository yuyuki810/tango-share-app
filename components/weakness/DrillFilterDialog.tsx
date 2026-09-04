'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Clock, Layers, X, Play } from 'lucide-react';

interface DrillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  originAssignmentId?: string; // チャンク指定の場合
}

export function DrillFilterDialog({
  isOpen,
  onClose,
  title,
  originAssignmentId,
}: DrillFilterDialogProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<'all' | 'mistakes' | 'recent'>('all');
  const [limit, setLimit] = useState<number>(10);
  const [days, setDays] = useState<number>(7);

  if (!isOpen) return null;

  const handleStart = () => {
    let url = '/test?mode=normal';
    if (originAssignmentId) {
      url += `&originAssignmentId=${encodeURIComponent(originAssignmentId)}`;
    } else {
      url += '&weak=true';
    }

    url += `&filter=${filterMode}`;
    if (filterMode !== 'all') {
      url += `&limit=${limit}`;
    }
    if (filterMode === 'recent') {
      url += `&days=${days}`;
    }

    onClose();
    router.push(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-5 text-left animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between border-b border-line/60 pb-3">
          <div>
            <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
              WEAKNESS DRILL
            </span>
            <h3 className="font-mincho text-lg font-bold text-ink">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. モード選択 */}
        <div className="space-y-2">
          <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
            絞り込みモードを選択
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === 'all'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span className="font-maru text-xs">すべて</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('mistakes')}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === 'mistakes'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }`}
            >
              <Flame className="h-4 w-4 text-akashiito" />
              <span className="font-maru text-xs">ミス多順</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('recent')}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === 'recent'
                  ? 'border-ink bg-ink text-paper font-bold shadow-sm'
                  : 'border-line bg-white text-ink/70 hover:bg-white/80'
              }`}
            >
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-maru text-xs">直近ミス</span>
            </button>
          </div>
        </div>

        {/* 2. 出題数選択 (ミス多順 または 直近ミス選択時) */}
        {filterMode !== 'all' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              出題する単語数
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setLimit(count)}
                  className={`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 ${
                    limit === count
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }`}
                >
                  {count} 語
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. 期間選択 (直近ミス選択時のみ) */}
        {filterMode === 'recent' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              間違えた対象期間
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '直近 3 日以内', value: 3 },
                { label: '直近 7 日以内', value: 7 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDays(item.value)}
                  className={`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 ${
                    days === item.value
                      ? 'border-ink bg-white text-ink ring-2 ring-ink shadow-2xs'
                      : 'border-line bg-white/70 text-ink/60 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 開始ボタン */}
        <button
          type="button"
          onClick={handleStart}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-98 hover:bg-ink/90 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-paper" />
          <span>
            {filterMode === 'all'
              ? 'すべての苦手単語でスタート'
              : `${filterMode === 'mistakes' ? 'ミスが多い順に' : '直近で間違えた単語を'} ${limit}語 特訓する`}
          </span>
        </button>
      </div>
    </div>
  );
}
