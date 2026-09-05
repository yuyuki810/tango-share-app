'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, X, AlertTriangle } from 'lucide-react';

export function LeaveGroupDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '脱退処理に失敗しました');
        setIsLoading(false);
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError('通信エラーが発生しました');
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 px-3 font-maru text-xs text-ink/40 hover:text-akashiito transition active:opacity-70 cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>グループを脱退する</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isLoading && setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-akashiito">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-mincho text-base font-bold text-ink">
                  グループから脱退しますか？
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isLoading && setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/70 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-line/60">
              これまでの単語の学習履歴・連続記録・スコアは個人データとして<strong>そのまま保持</strong>されますが、このグループのランキングからは外れます。
            </p>

            {error && <p className="font-maru text-xs text-akashiito">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsOpen(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line bg-white font-maru text-xs font-medium text-ink/70 transition active:scale-98 cursor-pointer hover:bg-white"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleLeave}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-akashiito font-mincho text-xs font-bold text-white shadow-sm transition active:scale-98 cursor-pointer hover:bg-akashiito/90 disabled:opacity-50"
              >
                {isLoading ? '処理中...' : '脱退する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
