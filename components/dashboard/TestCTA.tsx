import Link from 'next/link';

interface TestCTAProps {
  wordCount: number;
  isReviewDay: boolean;
}

export function TestCTA({ wordCount, isReviewDay }: TestCTAProps) {
  return (
    <Link
      href="/test"
      className="group relative block min-h-[56px] w-full overflow-hidden rounded-2xl bg-akashiito px-4 py-3.5 text-center font-mincho text-base font-bold text-paper shadow-md transition hover:opacity-95 active:scale-[0.99]"
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        <span>{isReviewDay ? '復習テストを始める' : '今日の確認テストを始める'}</span>
        <span className="rounded-full bg-paper/20 px-2 py-0.5 font-maru text-xs font-normal">
          {wordCount}語
        </span>
      </span>
    </Link>
  );
}
