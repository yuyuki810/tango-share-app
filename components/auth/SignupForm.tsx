"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const SignupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "サインアップに失敗しました");
        return;
      }

      router.push("/join-group");
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
        <Input label="表示名 (ニックネーム)" type="text" required placeholder="例: たろう" value={name} onChange={(e) => setName(e.target.value)} helperText="グループメンバーに表示されます" />
        <Input label="メールアドレス" type="email" required autoComplete="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="パスワード" type="password" required autoComplete="new-password" placeholder="6文字以上" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          アカウントを作成
        </Button>
      </form>
      <div className="mt-5 text-center text-xs text-ink-muted">
        すでにアカウントをお持ちですか？{" "}
        <Link href="/login" className="font-semibold text-akashiito underline underline-offset-2 hover:opacity-80">
          ログインする
        </Link>
      </div>
    </Card>
  );
};
