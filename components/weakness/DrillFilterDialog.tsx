'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Clock, Layers, X, Play, Shuffle } from "lucide-react";

interface DrillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  originAssignmentId?: string;
}

export function DrillFilterDialog({
  isOpen,
  onClose,
  title,
  originAssignmentId,
}: DrillFilterDialogProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<"all" | "mistakes" | "recent">("all");
  const [limit, setLimit] = useState<number>(10);
  const [days, setDays] = useState<number>(7);
  const [isRandom, setIsRandom] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleStart = () => {
    let url = `/test?mode=normal&t=${Date.now()}`;
    if (originAssignmentId) {
      url += `&originAssignmentId=${encodeURIComponent(originAssignmentId)}`;
    } else {
      url += "&weak=true";
    }

    url += `&filter=${filterMode}`;
    if (filterMode !== "all") {
      url += `&limit=${limit}`;
    }
    if (filterMode === "recent") {
      url += `&days=${days}`;
    }
    if (isRandom) {
      url += "&random=true";
    }

    onClose();
    router.push(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-5 text-left animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line/60 pb-3">
          <div>
            <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
              WEAKNESS DRILL
            </span>
            <h3 className="font-mincho text-lg font-bold text-ink">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
            絞り込みモードを選択
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === "all"
                  ? "border-ink bg-ink text-paper font-bold shadow-sm"
                  : "border-line bg-white text-ink/70 hover:bg-white/80"
              }`}
            >
              <Layers className="h-4 w-4" />
              <span className="font-maru text-xs">すべて</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode("mistakes")}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === "mistakes"
                  ? "border-ink bg-ink text-paper font-bold shadow-sm"
                  : "border-line bg-white text-ink/70 hover:bg-white/80"
              }`}
            >
              <Flame className="h-4 w-4 text-akashiito" />
              <span className="font-maru text-xs">ミス多順</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode("recent")}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer active:scale-95 ${
                filterMode === "recent"
                  ? "border-ink bg-ink text-paper font-bold shadow-sm"
                  : "border-line bg-white text-ink/70 hover:bg-white/80"
              }`}
            >
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-maru text-xs">直近ミス</span>
            </button>
          </div>
        </div>

        {filterMode !== "all" && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              出題する単語数
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setLimit(count)}
                  className={`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 ${
                    limit === count
                      ? "border-ink bg-white text-ink ring-2 ring-ink shadow-2xs"
                      : "border-line bg-white/70 text-ink/60 hover:bg-white"
                  }`}
                >
                  {count} 語
                </button>
              ))}
            </div>
          </div>
        )}

        {filterMode === "recent" && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <label className="font-mincho text-xs font-bold text-ink/70 block px-0.5">
              間違えた対象期間
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "直近 3 日以内", value: 3 },
                { label: "直近 7 日以内", value: 7 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDays(item.value)}
                  className={`min-h-[42px] rounded-xl border font-maru text-xs font-bold transition cursor-pointer active:scale-95 ${
                    days === item.value
                      ? "border-ink bg-white text-ink ring-2 ring-ink shadow-2xs"
                      : "border-line bg-white/70 text-ink/60 hover:bg-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-white border border-line/80 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Shuffle className={`h-4 w-4 ${isRandom ? "text-akashiito" : "text-ink/40"}`} />
            <span className="font-maru text-xs font-bold text-ink">出題順をシャッフルする</span>
          </div>
          <button
            type="button"
            onClick={() => setIsRandom(!isRandom)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isRandom ? "bg-akashiito" : "bg-line"
            }`}
            aria-label="ランダム出題の切り替え"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                isRandom ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-98 hover:bg-ink/90 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-paper" />
          <span>
            {filterMode === "all"
              ? "すべての苦手単語でスタート"
              : `${filterMode === "mistakes" ? "ミスが多い順に" : "直近で間違えた単語を"} ${limit}語 特訓する`}
          </span>
        </button>
      </div>
    </div>
  );
}
