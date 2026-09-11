'use client';

import React, { useState, useEffect } from 'react';
import { Share, X, PlusSquare, Bell } from 'lucide-react';

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    const isDismissed = localStorage.getItem('pwa_ios_prompt_dismissed') === '1';

    if (isIOS && !isStandalone && !isDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_ios_prompt_dismissed', '1');
  };

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="ホーム画面に追加の案内"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-line bg-white/95 p-4 shadow-sheet backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-akashiito text-white shadow-2xs">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mincho text-sm font-bold text-ink">
              仲間からの通知を受け取る準備
            </h2>
            <p className="mt-0.5 font-maru text-[11px] text-ink/60 leading-tight">
              応援通知を受け取るには、Safari下部の共有ボタン <Share className="inline h-3 w-3 mx-0.5 text-ink/70 -mt-0.5" /> から
              <strong>「ホーム画面に追加」</strong>してください。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer transition"
          aria-label="案内を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
