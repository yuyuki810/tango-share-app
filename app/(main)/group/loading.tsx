export default function GroupLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダースケルトン */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-line/30" />
          <div className="h-7 w-40 rounded-xl bg-line/40" />
        </div>
        <div className="h-7 w-20 rounded-full bg-line/30" />
      </div>

      {/* デイリーサマリーカード スケルトン */}
      <div className="rounded-3xl border border-line/60 bg-white/80 p-5 md:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 rounded-lg bg-line/40" />
          <div className="h-4 w-24 rounded bg-line/30" />
        </div>
        <div className="h-2.5 w-full rounded-full bg-line/30" />
        <div className="h-3.5 w-64 rounded bg-line/25" />
      </div>

      {/* ランキング一覧 スケルトン */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="h-4 w-32 rounded bg-line/30" />
          <div className="h-3 w-24 rounded bg-line/25" />
        </div>
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-line/60 bg-white/80 p-4 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-line/30" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-line/40" />
                  <div className="h-3 w-36 rounded bg-line/25" />
                </div>
              </div>
              <div className="h-7 w-16 rounded-lg bg-line/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
