export default function Loading() {
  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6 animate-pulse">
      <div className="flex items-center justify-between px-1">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-lg bg-line/40" />
          <div className="h-3.5 w-40 rounded-md bg-line/30" />
        </div>
        <div className="h-7 w-20 rounded-full bg-line/30" />
      </div>

      <div className="h-44 w-full rounded-3xl border border-line/60 bg-white/70 shadow-xs" />
      <div className="h-32 w-full rounded-3xl border border-line/60 bg-white/70 shadow-xs" />
    </div>
  );
}
