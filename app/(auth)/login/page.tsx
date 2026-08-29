import React from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">毎日を積み重ねる</h1>
        <p className="mt-2 text-xs text-ink-muted">グループ英単語共有テストにログイン</p>
      </div>
      <LoginForm />
    </main>
  );
}
