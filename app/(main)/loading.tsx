export default function Loading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-xl bg-line/40" />
          <div className="h-3.5 w-44 rounded-md bg-line/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-line/30" />
          <div className="h-7 w-24 rounded-full bg-amber-100/60" />
        </div>
      </div>

      {/* 今週のペース設定バー スケルトン */}
      <div className="flex items-center justify-between px-1">
        <div className="h-4 w-36 rounded-md bg-line/30" />
        <div className="h-4 w-28 rounded-md bg-line/30" />
      </div>

      {/* 今日の学習ノルマカード スケルトン */}
      <div className="rounded-3xl border border-line/60 bg-white/80 p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-3.5 w-20 rounded bg-line/30" />
            <div className="h-6 w-36 rounded-lg bg-line/40" />
          </div>
          <div className="h-5 w-16 rounded-full bg-line/30" />
        </div>
        <div className="h-28 w-full rounded-2xl border border-line/40 bg-paper/60 flex flex-col items-center justify-center gap-2">
          <div className="h-8 w-48 rounded-lg bg-line/40" />
          <div className="h-3.5 w-32 rounded bg-line/30" />
        </div>
        <div className="h-14 w-full rounded-2xl bg-line/40" />
      </div>

      {/* 週間スケジュール スケルトン */}
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-line/30 px-1" />
        <div className="rounded-3xl border border-line/60 bg-white/80 p-4 shadow-xs">
          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-line/25 border border-line/30" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
