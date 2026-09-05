export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ChevronLeft, Palette } from 'lucide-react';
import { ThemeSelector } from '@/components/theme/ThemeSelector';

export default async function SettingsThemePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>

      {/* 設定ナビゲーションタブ */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/settings/wordbook"
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-paper-card font-maru text-xs font-medium text-ink-muted transition hover:bg-paper-hover"
        >
          単語帳の変更
        </Link>
        <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-ink bg-ink text-paper font-mincho text-xs font-bold shadow-xs">
          テーマカラー
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-akashiito" />
          <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">テーマカラーの設定</h1>
        </div>
        <p className="font-maru text-xs text-ink-muted">
          お好みの配色にリアルタイムで切り替えます（次回起動時も保持されます）
        </p>
      </div>

      <ThemeSelector />
    </main>
  );
}
