"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Book, CheckCircle2 } from "lucide-react";
import type { Wordbook } from "@/types";

interface WordbookSelectorProps {
  wordbooks: Wordbook[];
  currentWordbookId?: string | null;
  redirectPath?: string;
}

export const WordbookSelector: React.FC<WordbookSelectorProps> = ({
  wordbooks,
  currentWordbookId = null,
  redirectPath = "/dashboard",
}) => {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    currentWordbookId || (wordbooks[0]?.id ?? null)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/users/wordbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordbookId: selectedId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "設定に失敗しました");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {wordbooks.map((wb) => {
          const isSelected = selectedId === wb.id;
          return (
            <div
              key={wb.id}
              onClick={() => setSelectedId(wb.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                isSelected
                  ? "border-akashiito bg-akashiito-subtle/40 ring-1 ring-akashiito"
                  : "border-line bg-paper-card hover:bg-paper-hover"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      isSelected
                        ? "bg-akashiito text-white"
                        : "bg-paper text-ink-muted border border-line"
                    }`}
                  >
                    <Book className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-mincho text-base font-bold text-ink">{wb.name}</h3>
                    <p className="font-number text-xs text-ink-muted">収録語数: {wb.total_words} 語</p>
                  </div>
                </div>

                {isSelected && <CheckCircle2 className="h-5 w-5 text-akashiito" />}
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="primary" size="lg" onClick={handleSave} disabled={!selectedId} isLoading={loading}>
        この単語帳で決定する
      </Button>
    </div>
  );
};
