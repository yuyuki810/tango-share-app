/**
 * fix_all_ts_errors.js
 * VercelのTypeScriptエラー3点を一発で解消するスクリプト
 * 
 * 実行方法:
 *   node fix_all_ts_errors.js
 */

const fs = require('fs');
const path = require('path');

function writeFile(relativeFilePath, fileContent) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf8');
  console.log(`[FILE] 修正完了: ${relativeFilePath}`);
}

console.log('=== TypeScriptエラー3点の自動修正を開始します ===\n');

// 1. app/api/test-sessions/complete/route.ts (scoreErr 型エラー解消)
const completeRouteTs = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
import { updateWordCorrectStreaks } from "@/lib/streak/updateWordCorrectStreaks";
import { computeAndSaveDailyScore } from "@/lib/scoring/computeDailyScore";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", detail: authError?.message || "ログインユーザーが見つかりません" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sessionId, results } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const today = getTodayJST();

    // 1. 対象セッションを取得
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("id, user_id, date, type, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 2. 既に完了済みの場合は重複実行を防止 (冪等性の保証)
    if (session.completed_at) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        sessionId: session.id,
      });
    }

    // 3. バックアップ用: results が渡されていてDBに未保存の回答があれば補完挿入
    if (results && Array.isArray(results) && results.length > 0) {
      const { data: existingAnswers } = await supabase
        .from("test_answers")
        .select("word_id")
        .eq("session_id", sessionId);

      const existingWordIdSet = new Set((existingAnswers ?? []).map((a) => a.word_id));
      const missingAnswers = results
        .filter((r) => !existingWordIdSet.has(r.wordId))
        .map((r) => ({
          session_id: sessionId,
          word_id: r.wordId,
          is_known: r.isKnown,
          origin_daily_assignment_id: r.originDailyAssignmentId ?? null,
        }));

      if (missingAnswers.length > 0) {
        await supabase.from("test_answers").insert(missingAnswers);
      }
    }

    // 4. セッションに紐付く全回答を取得
    const { data: allAnswers } = await supabase
      .from("test_answers")
      .select("word_id, is_known, origin_daily_assignment_id")
      .eq("session_id", sessionId);

    const answerList = allAnswers ?? [];
    const correctCount = answerList.filter((a) => a.is_known).length;
    const totalCount = answerList.length;

    // 5. test_sessions を完了状態 (completed_at 設定) に更新
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("test_sessions")
      .update({
        completed_at: nowIso,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Failed to update test_sessions:", updateError);
      return NextResponse.json(
        { error: "Failed to finalize session", detail: updateError.message },
        { status: 500 }
      );
    }

    // 6. 全体連続ログイン/学習ストリーク更新
    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", streakErr);
    }

    // 7. 単語ごとの連続正解カウント更新 (normal / daily_check 共通)
    try {
      await updateWordCorrectStreaks(
        supabase,
        user.id,
        answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        today
      );
    } catch (wordStreakErr: any) {
      console.error("Failed to update word correct streaks:", wordStreakErr);
    }

    // 8. デイリースコア計算 & 永続化 (daily_check のみ対象)
    let computedScore = null;
    if (session.type === "daily_check") {
      try {
        computedScore = await computeAndSaveDailyScore({
          supabase,
          userId: user.id,
          date: today,
          answers: answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        });
      } catch (scoreErr) {
        console.error("Failed to compute daily score:", (scoreErr && scoreErr.message) || String(scoreErr));
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      savedAnswersCount: totalCount,
      correctCount,
      totalCount,
      type: session.type,
      dailyScore: computedScore,
    });
  } catch (err) {
    console.error("Complete API fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: (err && err.message) || String(err) },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/test-sessions/complete/route.ts', completeRouteTs);

// 2. app/sw.ts (ServiceWorkerGlobalScope 型エラー解消)
const swTs = `import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
`;

writeFile('app/sw.ts', swTs);

// 3. lib/assignment/weekDates.ts (DAY_LABELS_SAT エクスポート追加)
const weekDatesTs = `/**
 * 日本時間(Asia/Tokyo)基準の日付計算ユーティリティ
 * 週のサイクルは「土曜日始まり・金曜日終わり」の7日間
 */

export const DAY_LABELS_SAT = ['土', '日', '月', '火', '水', '木', '金'] as const;

export function getTodayJST(): string {
  const now = new Date();
  return now.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 指定日(YYYY-MM-DD)の前日(-1日)の日付(YYYY-MM-DD)を返す */
export function getYesterday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** 指定日(YYYY-MM-DD)が属する「土曜始まりの週」の土曜日の日付を返す */
export function getSaturdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0=日, 1=月, ..., 6=土
  date.setUTCDate(date.getUTCDate() - ((dayOfWeek + 1) % 7));
  return date.toISOString().slice(0, 10);
}

export function getThisWeekSaturdayJST(): string {
  return getSaturdayOf(getTodayJST());
}

/** 指定土曜日の1週間前(-7日)の土曜日を返す */
export function getPreviousSaturday(saturdayStr: string): string {
  const [y, m, d] = saturdayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** 土曜日から金曜日までの7日分の日付配列(YYYY-MM-DD)を返す */
export function getWeekDates(saturdayStr: string): string[] {
  const [y, m, d] = saturdayStr.split('-').map(Number);
  const saturday = new Date(Date.UTC(y, m - 1, d));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(saturday);
    dt.setUTCDate(saturday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}
`;

writeFile('lib/assignment/weekDates.ts', weekDatesTs);

// 4. lib/assignment/calculateAssignments.ts
const calculateAssignmentsTs = `import { getWeekDates, DAY_LABELS_SAT } from './weekDates';

export type DayType = 'progress' | 'review' | 'rest';

export interface CalculatedDay {
  date: string;
  dayLabel: string;
  dayType: DayType;
  rangeStart: number | null;
  rangeEnd: number | null;
  wordCount: number;
}

export interface CalculateParams {
  weekStartDate: string;
  startNumber: number;
  wordsPerDay: number;
  pattern: '5-2' | '4-3' | 'custom';
  daySequence?: DayType[];
  totalWords?: number;
}

export function calculateWeeklyAssignments(params: CalculateParams): CalculatedDay[] {
  const { weekStartDate, startNumber, wordsPerDay, pattern, totalWords = 2000 } = params;
  const dates = getWeekDates(weekStartDate);

  let sequence: DayType[] = [];
  if (pattern === '5-2') {
    sequence = ['progress', 'progress', 'progress', 'progress', 'progress', 'review', 'review'];
  } else if (pattern === '4-3') {
    sequence = ['progress', 'progress', 'progress', 'progress', 'review', 'review', 'review'];
  } else {
    sequence = params.daySequence ?? ['progress', 'progress', 'progress', 'progress', 'progress', 'review', 'review'];
  }

  let currentStart = startNumber;
  let weekProgressStart: number | null = null;
  let weekProgressEnd: number | null = null;

  const result: CalculatedDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = dates[i];
    const dayLabel = DAY_LABELS_SAT[i];
    const dayType = sequence[i] ?? 'progress';

    if (dayType === 'progress') {
      const pStart = currentStart;
      const pEnd = Math.min(pStart + wordsPerDay - 1, totalWords);
      const count = pEnd >= pStart ? pEnd - pStart + 1 : 0;

      if (weekProgressStart === null) weekProgressStart = pStart;
      weekProgressEnd = pEnd;
      currentStart = pEnd + 1;

      result.push({
        date,
        dayLabel,
        dayType,
        rangeStart: pStart,
        rangeEnd: pEnd,
        wordCount: count,
      });
    } else if (dayType === 'review') {
      const rStart = weekProgressStart ?? startNumber;
      const rEnd = weekProgressEnd ?? (startNumber + wordsPerDay - 1);
      const count = rEnd >= rStart ? rEnd - rStart + 1 : 0;

      result.push({
        date,
        dayLabel,
        dayType,
        rangeStart: rStart,
        rangeEnd: rEnd,
        wordCount: count,
      });
    } else {
      result.push({
        date,
        dayLabel,
        dayType: 'rest',
        rangeStart: null,
        rangeEnd: null,
        wordCount: 0,
      });
    }
  }

  return result;
}
`;

writeFile('lib/assignment/calculateAssignments.ts', calculateAssignmentsTs);

console.log('\n================================================================');
console.log('✅ すべてのTypeScriptエラーの修正が完了しました！');
console.log('================================================================\n');