// setup_assignments.js
/**
 * 週間範囲設定のServer Component分離 ＆ 500エラー根本修正スクリプト
 * 実行方法: node setup_assignments.js
 */

const fs = require('fs');
const path = require('path');

// .env.local 自動読み込み
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      const val = values.join('=').replace(/(^["']|["']$)/g, '');
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val.trim();
      }
    }
  });
  console.log('✓ .env.local を読み込みました');
}

const files = {
  // 1. 日付＆割当計算ロジック
  'lib/assignment/weekDates.ts': `import { getTodayJST } from '@/lib/srs/dates';

export { getTodayJST };

export interface SaturdayCycle {
  startDate: string; // YYYY-MM-DD (Sat)
  endDate: string;   // YYYY-MM-DD (Fri)
  cycleDates: string[];
}

export interface DailyAssignmentPlan {
  date: string;
  dayOfWeek: number;
  dayLabel: string;
  isReviewDay: boolean;
  startNumber: number | null;
  endNumber: number | null;
  count: number;
}

export interface CalculationResult {
  startNumber: number;
  endNumber: number;
  totalNewWords: number;
  previewPlans: DailyAssignmentPlan[];
}

export function getSaturdayCycleJST(targetDateStr: string = getTodayJST()): SaturdayCycle {
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  const day = target.getUTCDay();
  const daysSinceSat = (day + 1) % 7;
  const satTime = target.getTime() - daysSinceSat * 86400000;
  const satDate = new Date(satTime);

  const cycleDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(satDate.getTime() + i * 86400000);
    const cy = cur.getUTCFullYear();
    const cm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const cd = String(cur.getUTCDate()).padStart(2, '0');
    cycleDates.push(\`\${cy}-\${cm}-\${cd}\`);
  }

  return {
    startDate: cycleDates[0],
    endDate: cycleDates[6],
    cycleDates,
  };
}

export function calculateDailyAssignmentsFromWordsPerDay(
  startNumber: number,
  wordsPerDay: number,
  cycleType: '5_advance_2_review' | '4_advance_3_review',
  cycleDates: string[]
): CalculationResult {
  const advanceDays = cycleType === '4_advance_3_review' ? 4 : 5;
  const validWordsPerDay = Math.max(1, wordsPerDay);
  const totalNewWords = validWordsPerDay * advanceDays;
  const endNumber = startNumber + totalNewWords - 1;

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const plans: DailyAssignmentPlan[] = [];
  let curr = startNumber;

  for (let i = 0; i < 7; i++) {
    const dateStr = cycleDates[i];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    if (i < advanceDays) {
      const dayStart = curr;
      const dayEnd = curr + validWordsPerDay - 1;
      curr = dayEnd + 1;

      plans.push({
        date: dateStr,
        dayOfWeek,
        dayLabel: dayNames[dayOfWeek],
        isReviewDay: false,
        startNumber: dayStart,
        endNumber: dayEnd,
        count: validWordsPerDay,
      });
    } else {
      plans.push({
        date: dateStr,
        dayOfWeek,
        dayLabel: dayNames[dayOfWeek],
        isReviewDay: true,
        startNumber: startNumber,
        endNumber: endNumber,
        count: 0,
      });
    }
  }

  return {
    startNumber,
    endNumber,
    totalNewWords,
    previewPlans: plans,
  };
}
`,

  // 2. 週間設定保存 API (エラー耐性を強化した SELECT -> UPDATE / INSERT 分岐)
  'app/api/assignments/weekly/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSaturdayCycleJST, calculateDailyAssignmentsFromWordsPerDay } from '@/lib/assignment/weekDates';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { wordbookId, startNumber, wordsPerDay, cycleType } = body;

    if (!wordbookId || !startNumber || !wordsPerDay) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { startDate, endDate, cycleDates } = getSaturdayCycleJST();
    const { endNumber, previewPlans } = calculateDailyAssignmentsFromWordsPerDay(
      Number(startNumber),
      Number(wordsPerDay),
      cycleType || '5_advance_2_review',
      cycleDates
    );

    // 1. 同週の weekly_ranges の存在確認
    const { data: existingRange } = await supabase
      .from('weekly_ranges')
      .select('id')
      .eq('user_id', user.id)
      .eq('start_date', startDate)
      .maybeSingle();

    let targetRangeId: string;

    if (existingRange) {
      targetRangeId = existingRange.id;
      const { error: updateErr } = await supabase
        .from('weekly_ranges')
        .update({
          wordbook_id: wordbookId,
          end_date: endDate,
          start_number: Number(startNumber),
          end_number: Number(endNumber),
          cycle_type: cycleType || '5_advance_2_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetRangeId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { data: newRange, error: insertErr } = await supabase
        .from('weekly_ranges')
        .insert({
          user_id: user.id,
          wordbook_id: wordbookId,
          start_date: startDate,
          end_date: endDate,
          start_number: Number(startNumber),
          end_number: Number(endNumber),
          cycle_type: cycleType || '5_advance_2_review',
        })
        .select('id')
        .single();

      if (insertErr || !newRange) {
        return NextResponse.json({ error: insertErr?.message || 'Failed to create range' }, { status: 500 });
      }
      targetRangeId = newRange.id;
    }

    // 2. 該当期間の既存 daily_assignments をクリア
    await supabase
      .from('daily_assignments')
      .delete()
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);

    // 3. 7日分を一括作成
    const assignmentRows = previewPlans.map((plan) => ({
      user_id: user.id,
      weekly_range_id: targetRangeId,
      date: plan.date,
      day_of_week: plan.dayOfWeek,
      start_number: plan.startNumber,
      end_number: plan.endNumber,
      is_review_day: plan.isReviewDay,
    }));

    const { error: assignError } = await supabase
      .from('daily_assignments')
      .insert(assignmentRows);

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, weeklyRangeId: targetRangeId });
  } catch (err: any) {
    console.error('Assignment save error:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
`,

  // 3. クライアントフォーム (useEffect 全廃、完全同期の純粋コンポーネント)
  'components/assignment/AssignmentSetupForm.tsx': `"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  SaturdayCycle,
  calculateDailyAssignmentsFromWordsPerDay,
} from '@/lib/assignment/weekDates';

interface WordbookItem {
  id: string;
  title: string;
  total_words?: number | null;
}

interface AssignmentSetupFormProps {
  wordbooks: WordbookItem[];
  cycleInfo: SaturdayCycle;
  initialRange?: {
    wordbook_id: string;
    start_number: number;
    cycle_type: '5_advance_2_review' | '4_advance_3_review';
  } | null;
}

const PRESET_WORDS_PER_DAY = [10, 15, 20, 25, 30];

export function AssignmentSetupForm({
  wordbooks,
  cycleInfo,
  initialRange,
}: AssignmentSetupFormProps) {
  const router = useRouter();

  const [selectedWordbookId, setSelectedWordbookId] = useState<string>(
    initialRange?.wordbook_id || wordbooks[0]?.id || ''
  );
  const [startNumber, setStartNumber] = useState<number>(initialRange?.start_number || 1);
  const [wordsPerDay, setWordsPerDay] = useState<number>(20);
  const [cycleType, setCycleType] = useState<'5_advance_2_review' | '4_advance_3_review'>(
    initialRange?.cycle_type || '5_advance_2_review'
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1日何単語の入力から終了番号とプレビューを完全同期計算 (useEffectなし)
  const { endNumber, totalNewWords, previewPlans } = useMemo(() => {
    return calculateDailyAssignmentsFromWordsPerDay(
      startNumber,
      wordsPerDay,
      cycleType,
      cycleInfo.cycleDates
    );
  }, [startNumber, wordsPerDay, cycleType, cycleInfo.cycleDates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWordbookId || startNumber <= 0 || wordsPerDay <= 0) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/assignments/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordbookId: selectedWordbookId,
          startNumber,
          wordsPerDay,
          cycleType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setErrorMessage(data.error || '保存に失敗しました');
      }
    } catch {
      setErrorMessage('通信エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-sans">
          {errorMessage}
        </div>
      )}

      {/* 単語帳選択 */}
      <div className="p-5 rounded-2xl bg-white border border-line shadow-xs space-y-3">
        <label className="block text-xs font-sans font-semibold text-stone-600 uppercase tracking-wide">
          使用する単語帳
        </label>
        <select
          value={selectedWordbookId}
          onChange={(e) => setSelectedWordbookId(e.target.value)}
          className="w-full min-h-[48px] px-3.5 rounded-xl border border-line bg-stone-50 text-sm font-sans text-ink focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          {wordbooks.map((wb) => (
            <option key={wb.id} value={wb.id}>
              {wb.title} {wb.total_words ? \`(\${wb.total_words}語)\` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 目標ペース設定 */}
      <div className="p-5 rounded-2xl bg-white border border-line shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-sans font-semibold text-stone-600 mb-1">
              開始単語番号
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-stone-400">
                No.
              </span>
              <input
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))}
                className="w-full min-h-[48px] pl-10 pr-3 rounded-xl border border-line bg-stone-50 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-sans font-semibold text-stone-600 mb-1">
              1日の新規単語数
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={200}
                value={wordsPerDay}
                onChange={(e) => setWordsPerDay(Math.max(1, Number(e.target.value)))}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-line bg-stone-50 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-sans text-stone-400">
                語 / 日
              </span>
            </div>
          </div>
        </div>

        {/* クイック選択 */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[11px] font-sans text-stone-400 self-center mr-1">目安:</span>
          {PRESET_WORDS_PER_DAY.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setWordsPerDay(count)}
              className={\`px-3 py-1 rounded-full text-xs font-mono transition-all \${
                wordsPerDay === count
                  ? 'bg-ink text-paper font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }\`}
            >
              {count}語
            </button>
          ))}
        </div>

        {/* 自動計算サマリー */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs font-sans">
          <span className="text-amber-900">今週の学習範囲（自動算出）</span>
          <span className="font-mono font-bold text-ink text-sm">
            No.{startNumber} 〜 No.{endNumber}{' '}
            <span className="text-xs font-sans font-normal text-stone-500">
              (計 {totalNewWords}語)
            </span>
          </span>
        </div>
      </div>

      {/* サイクル選択 */}
      <div className="p-5 rounded-2xl bg-white border border-line shadow-xs space-y-3">
        <label className="block text-xs font-sans font-semibold text-stone-600 uppercase tracking-wide">
          週間サイクル配分
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCycleType('5_advance_2_review')}
            className={\`p-4 rounded-xl border text-left transition-all min-h-[56px] cursor-pointer \${
              cycleType === '5_advance_2_review'
                ? 'bg-amber-50/60 border-amber-400 ring-1 ring-amber-300 text-ink'
                : 'bg-stone-50 border-line text-stone-500 hover:bg-stone-100'
            }\`}
          >
            <span className="font-serif font-bold text-sm block text-ink">5進2戻（推奨）</span>
            <span className="text-[11px] text-stone-500 block mt-0.5">5日新規 + 2日復習</span>
          </button>
          <button
            type="button"
            onClick={() => setCycleType('4_advance_3_review')}
            className={\`p-4 rounded-xl border text-left transition-all min-h-[56px] cursor-pointer \${
              cycleType === '4_advance_3_review'
                ? 'bg-amber-50/60 border-amber-400 ring-1 ring-amber-300 text-ink'
                : 'bg-stone-50 border-line text-stone-500 hover:bg-stone-100'
            }\`}
          >
            <span className="font-serif font-bold text-sm block text-ink">4進3戻</span>
            <span className="text-[11px] text-stone-500 block mt-0.5">4日新規 + 3日復習</span>
          </button>
        </div>
      </div>

      {/* プレビュー */}
      <div className="p-5 rounded-2xl bg-white border border-line shadow-xs space-y-3">
        <h2 className="text-xs font-sans font-semibold text-stone-600 uppercase tracking-wide">
          今週のスケジュールプレビュー
        </h2>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {previewPlans.map((p) => {
            const [, , d] = p.date.split('-').map(Number);
            return (
              <div
                key={p.date}
                className="p-2 rounded-xl bg-stone-50 border border-line flex flex-col items-center justify-between min-h-[84px]"
              >
                <div className="text-center">
                  <span className="text-[10px] text-stone-400 block">{p.dayLabel}</span>
                  <span className="text-xs font-mono font-semibold text-ink">{d}</span>
                </div>
                <div className="text-center my-1">
                  {p.isReviewDay ? (
                    <span className="px-1.5 py-0.5 text-[9px] rounded bg-stone-200 text-stone-600 font-sans">
                      復習
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-stone-600">
                      {p.startNumber}-{p.endNumber}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[56px] flex items-center justify-center rounded-xl bg-amber-300 text-ink font-semibold text-base hover:bg-amber-400 active:scale-[0.99] transition-all shadow-xs cursor-pointer disabled:opacity-50"
      >
        {submitting ? '保存中...' : '今週のスケジュールを確定する'}
      </button>
    </form>
  );
}
`,

  // 4. Server Component ページ (サーバー側で初期取得しループを完全に防止)
  'app/(main)/assignments/setup/page.tsx': `import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { getSaturdayCycleJST } from '@/lib/assignment/weekDates';
import { AssignmentSetupForm } from '@/components/assignment/AssignmentSetupForm';

export default async function AssignmentSetupPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. 単語帳の取得 (空なら自動生成してFKエラーを予防)
  let { data: wordbooks } = await supabase
    .from('wordbooks')
    .select('id, title, total_words')
    .order('title');

  if (!wordbooks || wordbooks.length === 0) {
    const { data: newWb } = await supabase
      .from('wordbooks')
      .insert({
        title: 'ターゲット1900',
        total_words: 1900,
      })
      .select('id, title, total_words')
      .single();

    wordbooks = newWb ? [newWb] : [];
  }

  const cycleInfo = getSaturdayCycleJST();

  // 2. 既存の週間範囲を取得
  const { data: existingRange } = await supabase
    .from('weekly_ranges')
    .select('wordbook_id, start_number, cycle_type')
    .eq('user_id', user.id)
    .eq('start_date', cycleInfo.startDate)
    .maybeSingle();

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">今週の学習範囲を設定</h1>
        <p className="text-xs font-sans text-stone-500 mt-1">
          期間: {cycleInfo.startDate}（土）〜 {cycleInfo.endDate}（金）
        </p>
      </div>

      <AssignmentSetupForm
        wordbooks={wordbooks}
        cycleInfo={cycleInfo}
        initialRange={existingRange}
      />
    </div>
  );
}
`,
};

// ファイル書き出し
let count = 0;
Object.entries(files).forEach(([relPath, content]) => {
  const absPath = path.resolve(process.cwd(), relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
  console.log(`✓ 修正適用: ${relPath}`);
  count++;
});

console.log(`\n========================================`);
console.log(`🎉 週間範囲設定の修正が完了しました (${count} 件)`);
console.log(`========================================\n`);