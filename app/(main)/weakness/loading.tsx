export default function WeaknessLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      {/* ヘッダー */}
      <div className="space-y-2">
        <div className="h-3.5 w-28 rounded bg-line/30" />
        <div className="h-7 w-36 rounded-xl bg-line/40" />
        <div className="h-3.5 w-48 rounded bg-line/25" />
      </div>

      {/* 3つの統計カード スケルトン */}
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-line/60 bg-white/80 p-3 flex flex-col items-center justify-center gap-1.5">
            <div className="h-2.5 w-14 rounded bg-line/30" />
            <div className="h-6 w-8 rounded-lg bg-line/40" />
          </div>
        ))}
      </div>

      {/* タイル一覧 スケルトン */}
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-line/30 px-1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-line/60 bg-white/80 p-3.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-8 rounded bg-line/30" />
                  <div className="h-3 w-10 rounded-full bg-line/30" />
                </div>
                <div className="h-4 w-20 rounded bg-line/40" />
              </div>
              <div className="h-4 w-12 rounded bg-line/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
