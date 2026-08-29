"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const CreateGroupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループ作成に失敗しました");
        return;
      }

      router.push("/select-wordbook");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-mincho text-base font-bold text-ink mb-3">新しいグループを作る</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input placeholder="例: 東大志望4人組" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          グループを作成して招待コードを発行
        </Button>
      </form>
    </Card>
  );
};
