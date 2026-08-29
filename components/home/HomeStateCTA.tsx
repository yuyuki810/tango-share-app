import React from 'react';
import Link from 'next/link';
import { HomeStateMachine } from '@/lib/srs/types';

interface HomeStateCTAProps {
  state: HomeStateMachine;
  onSetRangeClick?: () => void;
}

export function HomeStateCTA({ state, onSetRangeClick }: HomeStateCTAProps) {
  if (state.state === 'no_range') {
    return (
      <div className="p-6 rounded-2xl bg-white border border-line shadow-xs">
        <h3 className="font-serif text-lg text-ink font-semibold mb-2">今週の学習範囲が未設定です</h3>
        <p className="text-sm text-stone-500 mb-5 leading-relaxed">
          土曜日を起点とする週間サイクルで、今週進める単語帳の範囲を設定しましょう。
        </p>
        <Link
          href="/assignments/setup"
          onClick={onSetRangeClick}
          className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-ink text-paper font-medium text-base hover:opacity-90 active:scale-[0.99] transition-all"
        >
          今週の範囲を設定する
        </Link>
      </div>
    );
  }

  if (state.state === 'review_due') {
    return (
      <div className="p-6 rounded-2xl bg-white border border-line shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-sans tracking-wide text-stone-500 uppercase">Today&apos;s Review</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200">
            {state.sessionCount} 件
          </span>
        </div>
        <h3 className="font-serif text-xl text-ink font-bold mb-1">
          今日の復習をはじめましょう
        </h3>
        <p className="text-xs text-stone-500 mb-5">
          新出語と復習語が自動で配分されます（約5分）
        </p>
        <Link
          href="/review"
          className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-amber-300 text-ink font-semibold text-lg hover:bg-amber-400 active:scale-[0.99] transition-all shadow-xs"
        >
          今日の復習 {state.sessionCount}件
        </Link>
      </div>
    );
  }

  if (state.state === 'daily_check_due') {
    return (
      <div className="p-6 rounded-2xl bg-white border border-amber-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-sans tracking-wide text-amber-700 uppercase">Retention Check</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            {state.count} 語
          </span>
        </div>
        <h3 className="font-serif text-xl text-ink font-bold mb-1">
          デイリーチェック
        </h3>
        <p className="text-xs text-stone-500 mb-5">
          今日新しく導入した単語の定着確認（約2分）
        </p>
        <Link
          href="/daily-check"
          className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-ink text-paper font-semibold text-base hover:opacity-90 active:scale-[0.99] transition-all"
        >
          デイリーチェック({state.count}語・約2分)
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-white border border-line shadow-xs text-center">
      <div className="w-12 h-12 rounded-full bg-stone-100 border border-line flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-stone-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="font-serif text-lg text-ink font-bold mb-1">今日の分は完了しました！</h3>
      <p className="text-xs text-stone-500 mb-5">
        本日の学習と確認はすべて終了しています。
      </p>

      {state.hasAheadContent && (
        <div className="pt-3 border-t border-line/60">
          <Link
            href="/review?mode=ahead"
            className="text-xs text-stone-500 hover:text-ink underline underline-offset-4 font-sans inline-block py-2 min-h-[44px]"
          >
            先取りして学習する（任意）
          </Link>
        </div>
      )}
    </div>
  );
}
