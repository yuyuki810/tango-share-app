import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import { ChevronLeft } from "lucide-react";
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
    <main className="w-full">
      <Header userName={profile?.name} />
      <div className="mb-4">
        <Link href="/dashboard" className="inline-flex items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors">
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>
      <div className="mb-6 text-left">
        <h1 className="font-mincho text-xl font-bold tracking-tight text-ink">単語帳の変更</h1>
        <p className="mt-1 text-xs text-ink-muted">テスト対象となる単語帳を変更します</p>
      </div>
      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile?.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}
