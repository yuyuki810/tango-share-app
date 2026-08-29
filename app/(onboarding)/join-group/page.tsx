import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { CreateGroupForm } from "@/components/group/CreateGroupForm";
import { JoinGroupForm } from "@/components/group/JoinGroupForm";

export default async function JoinGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("group_id, wordbook_id, name")
    .eq("id", user.id)
    .single();

  if (profile?.group_id) {
    if (!profile.wordbook_id) {
      redirect("/select-wordbook");
    }
    redirect("/dashboard");
  }

  return (
    <main className="w-full">
      <Header userName={profile?.name} showNav={false} />
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">グループに参加しよう</h1>
        <p className="mt-2 text-xs text-ink-muted">仲間と一緒に単語テストを始める準備をします</p>
      </div>
      <div className="space-y-6">
        <CreateGroupForm />
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-line" />
          <span className="absolute bg-paper px-3 text-xs font-semibold text-ink-subtle">または</span>
        </div>
        <JoinGroupForm />
      </div>
    </main>
  );
}
