'use client';

import Link from 'next/link';

interface TodayRangeCardProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
}

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
}: TodayRangeCardProps) {
  const hasRange = rangeStart !== null && rangeEnd !== null;
  const wordCount = hasRange ? rangeEnd - rangeStart + 1 : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-maru text-xs font-medium text-ink/50">
            {wordbookName || '単語帳'}
          </span>
          <h2 className="mt-1 font-mincho text-xl font-bold text-ink">今日の学習ノルマ</h2>
        </div>
        {hasRange && (
          <span
            className={`rounded-full border px-3 py-1 font-maru text-xs font-bold shadow-xs ${
              isReviewDay
                ? 'border-highlighter bg-highlighter/50 text-ink'
                : 'border-line bg-paper text-ink/80'
            }`}
          >
            {isReviewDay ? '総復習の日' : '新規進捗'}
          </span>
        )}
      </div>

      <div className="my-5 flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-paper py-5 text-center">
        {hasRange ? (
          <>
            <p className="font-mincho text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              No.{rangeStart} <span className="text-xl font-normal text-ink/40">〜</span> No.{rangeEnd}
            </p>
            <p className="mt-1.5 font-maru text-xs font-medium text-ink/60">
              本日 {wordCount} 語 {isReviewDay ? '（今週の範囲を総点検）' : '（新規インプット）'}
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
        <Link
          href="/review-preview"
          className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98"
        >
          今日の学習をはじめる
        </Link>
      )}
    </div>
  );
}
