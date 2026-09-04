export default function WordbookLoading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      <div className="h-3.5 w-28 rounded bg-line/30" />
      <div className="space-y-1.5">
        <div className="h-6 w-36 rounded-lg bg-line/40" />
        <div className="h-3.5 w-52 rounded bg-line/25" />
      </div>

      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-line/60 bg-white/80 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-line/30" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-line/40" />
                <div className="h-3 w-20 rounded bg-line/25" />
              </div>
            </div>
            <div className="h-5 w-5 rounded-full bg-line/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
