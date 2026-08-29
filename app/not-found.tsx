import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-mincho text-2xl font-bold text-ink">ページが見つかりません</h1>
      <p className="font-maru text-xs text-ink/60">
        指定されたURLは現在存在しません。
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-ink px-5 py-3 text-xs font-bold text-paper transition hover:opacity-90 font-maru shadow-sm"
      >
        ダッシュボードへ戻る
      </Link>
    </main>
  );
}
