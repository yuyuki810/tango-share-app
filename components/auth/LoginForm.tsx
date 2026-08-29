"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
            {error}
          </div>
        )}
        <Input label="メールアドレス" type="email" required autoComplete="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="パスワード" type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          ログインして学習を再開
        </Button>
      </form>
      <div className="mt-5 text-center text-xs text-ink-muted">
        アカウントをお持ちでないですか？{" "}
        <Link href="/signup" className="font-semibold text-akashiito underline underline-offset-2 hover:opacity-80">
          新規登録する
        </Link>
      </div>
    </Card>
  );
};
