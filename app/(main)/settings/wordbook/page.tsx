import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import { ChevronLeft, BookOpen } from "lucide-react";
import type { Wordbook } from "@/types";

export default async function SettingsWordbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, wordbook_id")
    .eq("id", user.id)
    .single();

  const { data: wordbooks } = await supabase
    .from("wordbooks")
    .select("id, name, total_words, created_at")
    .order("created_at", { ascending: true });

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
        <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-ink bg-ink text-paper font-mincho text-xs font-bold shadow-xs">
          単語帳の変更
        </div>
        <Link
          href="/settings/theme"
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-paper-card font-maru text-xs font-medium text-ink-muted transition hover:bg-paper-hover"
        >
          テーマカラー
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-akashiito" />
          <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">単語帳の変更</h1>
        </div>
        <p className="font-maru text-xs text-ink-muted">テスト対象となる単語帳を変更します</p>
      </div>

      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile?.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}
