'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Shuffle } from "lucide-react";

interface TodayRangeCardProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
  isDailyCheckCompleted?: boolean;
  hasIncompleteSession?: boolean;
}

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
  isDailyCheckCompleted = false,
  hasIncompleteSession = false,
}: TodayRangeCardProps) {
  const router = useRouter();
  const hasRange = rangeStart !== null && rangeEnd !== null;
  const wordCount = hasRange ? rangeEnd - rangeStart + 1 : 0;

  const [isRandom, setIsRandom] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tango_random_order");
      if (saved === "true") {
        setIsRandom(true);
      }
    } catch {}
  }, []);

  const toggleRandom = () => {
    const next = !isRandom;
    setIsRandom(next);
    try {
      localStorage.setItem("tango_random_order", String(next));
    } catch {}
  };

  const handleNavigate = (mode: "daily_check" | "normal") => {
    // 毎回新しいシャッフル順を強制するためにタイムスタンプ(t)を付与
    let url = `/test?mode=${mode}&t=${Date.now()}`;
    if (isRandom) {
      url += "&random=true";
    }
    router.push(url);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-maru text-xs font-medium text-ink/50">
            {wordbookName || "単語帳"}
          </span>
          <h2 className="mt-1 font-mincho text-xl font-bold text-ink">今日の学習ノルマ</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasRange && (
            <span
              className={`rounded-full border px-3 py-0.5 font-maru text-xs font-bold shadow-xs ${
                isReviewDay
                  ? "border-[#9FE1CB] bg-[#E6F7F2] text-[#136C56]"
                  : "border-line bg-paper text-ink/80"
              }`}
            >
              {isReviewDay ? "総復習の日" : "新規進捗"}
            </span>
          )}
          {hasRange && (
            <span
              className={`rounded-full px-2.5 py-0.5 font-maru text-[10px] font-bold border ${
                isDailyCheckCompleted
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : hasIncompleteSession
                  ? "bg-[#FEF3E2] text-[#9A5B00] border-[#EF9F27]"
                  : "bg-[#FEF3E2] text-[#9A5B00] border-[#EF9F27]"
              }`}
            >
              {isDailyCheckCompleted
                ? "本番チェック: 済"
                : hasIncompleteSession
                ? "本番チェック: 中断中"
                : "本番チェック: 未"}
            </span>
          )}
        </div>
      </div>

      <div className="my-5 flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-paper py-5 text-center">
        {hasRange ? (
          <>
            <p className="font-mincho text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              No.{rangeStart} <span className="text-xl font-normal text-ink/40">〜</span> No.{rangeEnd}
            </p>
            <p className="mt-1.5 font-maru text-xs font-medium text-ink/60">
              本日 {wordCount} 語 {isReviewDay ? "（今週の範囲を総点検）" : "（新規インプット）"}
            </p>
          </>
        ) : (
          <div className="py-2">
            <p className="font-mincho text-xl font-bold text-ink/70">今日は休養日、または範囲未設定です</p>
            <p className="mt-1 font-maru text-xs text-ink/40">上部のボタンから今週のスケジュールを設定してください</p>
          </div>
        )}
      </div>

      {hasRange && (
        <div className="space-y-3">
          {/* ランダム出題トグル */}
          <div className="flex items-center justify-between rounded-xl bg-paper/60 border border-line/60 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <Shuffle className={`h-4 w-4 ${isRandom ? "text-akashiito" : "text-ink/40"}`} />
              <span className="font-maru text-xs font-bold text-ink/80">ランダム出題で受ける</span>
              {!isDailyCheckCompleted && (
                <span className="rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.2 font-maru text-[9px] font-bold text-amber-900">
                  本番+5点ボーナス
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleRandom}
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

          {!isDailyCheckCompleted ? (
            <>
              <button
                type="button"
                onClick={() => handleNavigate("daily_check")}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E24B4A] font-mincho text-base font-bold text-white shadow-md shadow-[#E24B4A]/25 transition active:scale-98 hover:opacity-95 cursor-pointer"
              >
                {hasIncompleteSession && <RotateCcw className="h-4 w-4" />}
                <span>{hasIncompleteSession ? "前回の続きから再開する" : "今日の本番チェックを受ける"}</span>
              </button>
              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => handleNavigate("normal")}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-dashed border-line bg-paper/60 px-4 py-2.5 font-maru text-xs font-medium text-ink/70 transition hover:bg-paper hover:text-ink active:scale-98 cursor-pointer"
                >
                  本番前の練習テストを受ける（何度でも可能）
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-300 py-3 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-mincho text-sm font-bold">本日の本番チェックは受験済みです</span>
              </div>
              <button
                type="button"
                onClick={() => handleNavigate("normal")}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-line bg-paper font-mincho text-sm font-bold text-ink transition hover:bg-paper-hover active:scale-98 cursor-pointer"
              >
                練習テストを受ける（再復習）
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
