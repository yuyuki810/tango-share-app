import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import type { Wordbook } from "@/types";

export default async function SelectWordbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, group_id, wordbook_id")
    .eq("id", user.id)
    .single();

  if (!profile?.group_id) {
    redirect("/join-group");
  }

  const { data: wordbooks } = await supabase
    .from("wordbooks")
    .select("id, name, total_words, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="w-full">
      <Header userName={profile.name} showNav={false} />
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">使用する単語帳を選択</h1>
        <p className="mt-2 text-xs text-ink-muted">各自が使う単語帳を選んでください</p>
      </div>
      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}
