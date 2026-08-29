"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const JoinGroupForm = () => {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
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
        body: JSON.stringify({ action: "join", inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループへの参加に失敗しました");
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
      <h2 className="font-mincho text-base font-bold text-ink mb-3">招待コードで参加する</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input
          placeholder="6桁のコード (例: 7K9X2P)"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-number tracking-widest uppercase text-center font-bold text-base"
          required
        />
        <Button type="submit" variant="secondary" size="lg" isLoading={loading}>
          グループに参加
        </Button>
      </form>
    </Card>
  );
};
