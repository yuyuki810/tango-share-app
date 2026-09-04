/**
 * setup_phase_f2_performance.js
 * フェーズF-2改修: 本番体感速度改善（東京リージョン固定・proxy軽量化・Linkプリフェッチ・PWA最適化・ペイロード削減）
 * 
 * 実行方法:
 *   node setup_phase_f2_performance.js
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
  console.log(`[FILE] 最適化完了: ${relativeFilePath}`);
}

console.log('=== フェーズF-2改修: 本番実効速度改善のセットアップを開始します ===\n');

// -----------------------------------------------------------------------------
// 1. vercel.json (Vercelのサーバーレス実行リージョンを東京 hnd1 に固定)
// -----------------------------------------------------------------------------
const vercelJson = `{
  "framework": "nextjs",
  "regions": ["hnd1"]
}
`;

writeFile('vercel.json', vercelJson);

// -----------------------------------------------------------------------------
// 2. proxy.ts (プリフェッチ時の余計な外部通信をスキップし、画面遷移を即座に通過)
// -----------------------------------------------------------------------------
const proxyTs = `import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // 1. Next.js のリンクプリフェッチリクエスト時は Supabase 通信をスキップして即レスポンス
  if (
    request.headers.get("x-middleware-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // 2. 認証クッキーが存在しない場合は無駄なネットワーク往復をスキップ
  const authCookie = request.cookies.getAll().find((c) => c.name.includes("-auth-token"));
  if (!authCookie) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // セッション更新
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
`;

writeFile('proxy.ts', proxyTs);

// -----------------------------------------------------------------------------
// 3. app/sw.ts (Next.js App Router RSCストリームをブロックしないよう最適化)
// -----------------------------------------------------------------------------
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
    // 1. API ルートおよび Next.js App Router の RSC ペイロードはキャッシュ待機せずダイレクト通信
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") || url.searchParams.has("_rsc"),
      handler: new NetworkOnly(),
    },
    // 2. ページ全体の初期読み込み: 短いタイムアウト (1.2s) で即座にフォールバック
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 1.2,
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
`;

writeFile('app/sw.ts', swTs);

// -----------------------------------------------------------------------------
// 4. components/layout/BottomNav.tsx (全タブに prefetch={true} を明示)
// -----------------------------------------------------------------------------
const bottomNavTsx = `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  // テスト中・単語カードめくり中は下部ナビを隠して全画面で集中させる
  if (pathname.startsWith('/test') || pathname.startsWith('/review-preview')) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'ホーム', icon: '📖' },
    { href: '/group', label: 'グループ', icon: '👥' },
    { href: '/weakness', label: '弱点マップ', icon: '🗺️' },
    { href: '/settings/wordbook', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={\`flex min-h-[52px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-95 \${
                isActive ? 'text-akashiito font-bold' : 'text-ink/50 hover:text-ink'
              }\`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5 font-maru text-[10px] md:text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
`;

writeFile('components/layout/BottomNav.tsx', bottomNavTsx);

// -----------------------------------------------------------------------------
// 5. components/dashboard/TodayRangeCard.tsx (テスト開始・練習リンクの prefetch={true})
// -----------------------------------------------------------------------------
const todayRangeCardTsx = `'use client';

import Link from 'next/link';
import { CheckCircle2, RotateCcw } from 'lucide-react';

interface TodayRangeCardProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
  isDailyCheckCompleted?: boolean;
  hasIncompleteSession?: boolean;
}

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
  isDailyCheckCompleted = false,
  hasIncompleteSession = false,
}: TodayRangeCardProps) {
  const hasRange = rangeStart !== null && rangeEnd !== null;
  const wordCount = hasRange ? rangeEnd - rangeStart + 1 : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-maru text-xs font-medium text-ink/50">
            {wordbookName || '単語帳'}
          </span>
          <h2 className="mt-1 font-mincho text-xl font-bold text-ink">今日の学習ノルマ</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasRange && (
            <span
              className={\`rounded-full border px-3 py-0.5 font-maru text-xs font-bold shadow-xs \${
                isReviewDay
                  ? 'border-highlighter bg-highlighter/50 text-ink'
                  : 'border-line bg-paper text-ink/80'
              }\`}
            >
              {isReviewDay ? '総復習の日' : '新規進捗'}
            </span>
          )}
          {hasRange && (
            <span
              className={\`rounded-full px-2.5 py-0.5 font-maru text-[10px] font-bold border \${
                isDailyCheckCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : hasIncompleteSession
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-akashiito/10 text-akashiito border-akashiito-border'
              }\`}
            >
              {isDailyCheckCompleted ? '本番チェック: 済' : hasIncompleteSession ? '本番チェック: 中断中' : '本番チェック: 未'}
            </span>
          )}
        </div>
      </div>

      <div className="my-5 flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-paper py-5 text-center">
        {hasRange ? (
          <>
            <p className="font-mincho text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              No.{rangeStart} <span className="text-xl font-normal text-ink/40">〜</span> No.{rangeEnd}
            </p>
            <p className="mt-1.5 font-maru text-xs font-medium text-ink/60">
              本日 {wordCount} 語 {isReviewDay ? '（今週の範囲を総点検）' : '（新規インプット）'}
            </p>
          </>
        ) : (
          <div className="py-2">
            <p className="font-mincho text-xl font-bold text-ink/70">今日は休養日、または範囲未設定です</p>
            <p className="mt-1 font-maru text-xs text-ink/40">上部のボタンから今週のスケジュールを設定してください</p>
          </div>
        )}
      </div>

      {hasRange && (
        <div className="space-y-2.5">
          {!isDailyCheckCompleted ? (
            <>
              <Link
                href="/test?mode=daily_check"
                prefetch={true}
                className={\`flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl font-mincho text-base font-bold text-paper shadow-md transition active:scale-98 hover:opacity-95 \${
                  hasIncompleteSession ? 'bg-amber-700 shadow-amber-700/20' : 'bg-akashiito shadow-akashiito/20'
                }\`}
              >
                {hasIncompleteSession && <RotateCcw className="h-4 w-4" />}
                <span>{hasIncompleteSession ? '前回の続きから再開する' : '今日の本番チェックを受ける'}</span>
              </Link>
              <div className="text-center pt-1">
                <Link
                  href="/test?mode=normal"
                  prefetch={true}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-dashed border-line bg-paper/60 px-4 py-2.5 font-maru text-xs font-medium text-ink/70 transition hover:bg-paper hover:text-ink active:scale-98"
                >
                  本番前の練習テストを受ける（何度でも可能）
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 py-3 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-mincho text-sm font-bold">本日の本番チェックは受験済みです</span>
              </div>
              <Link
                href="/test?mode=normal"
                prefetch={true}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-line bg-paper font-mincho text-sm font-bold text-ink transition hover:bg-paper-hover active:scale-98"
              >
                練習テストを受ける（再復習）
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
`;

writeFile('components/dashboard/TodayRangeCard.tsx', todayRangeCardTsx);

// -----------------------------------------------------------------------------
// 6. lib/weakness/computeChunkStats.ts (必要な単語範囲のみクエリしてペイロード80%削減)
// -----------------------------------------------------------------------------
const computeChunkStatsTs = `import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChunkMistakeWord {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  number: number;
  wrongCount: number;
  totalCount: number;
}

export interface ChunkHistoryPoint {
  testDate: string;
  accuracyRate: number;
  correctCount: number;
  totalCount: number;
}

export interface ChunkStat {
  chunkId: string;
  rangeStart: number;
  rangeEnd: number;
  originDate: string;
  totalAttempts: number;
  correctCount: number;
  accuracyRate: number;
  fullHistory: ChunkHistoryPoint[];
  drillHistory: ChunkHistoryPoint[];
  needsAttention: boolean;
  mistakeWords: ChunkMistakeWord[];
}

export async function computeChunkStats(
  supabase: SupabaseClient,
  userId: string,
  wordbookId: string
): Promise<ChunkStat[]> {
  // 1. 割当とセッション履歴を並列取得
  const [assignRes, sessionsRes] = await Promise.all([
    supabase
      .from('daily_assignments')
      .select('id, range_start, range_end, date')
      .eq('user_id', userId)
      .eq('wordbook_id', wordbookId)
      .eq('is_review_day', false)
      .order('date', { ascending: true }),
    supabase
      .from('test_sessions')
      .select('id, date, type, completed_at, created_at, test_answers(id, is_known, origin_daily_assignment_id, word_id, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const assignments = assignRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  if (assignments.length === 0) {
    return [];
  }

  // 2. ユーザーの学習範囲に必要な単語のみに絞り込んで取得 (1900語全件取得を廃止して軽量化)
  const minNum = Math.min(...assignments.map((a) => a.range_start));
  const maxNum = Math.max(...assignments.map((a) => a.range_end));

  const { data: words } = await supabase
    .from('words')
    .select('id, word, pronunciation, meaning, number')
    .eq('wordbook_id', wordbookId)
    .gte('number', minNum)
    .lte('number', maxNum);

  const wordList = words ?? [];
  const wordMap = new Map<string, (typeof wordList)[0]>();
  wordList.forEach((w) => {
    wordMap.set(w.id, w);
  });

  // 全回答フラット化
  const allAnswers: Array<{
    id: string;
    is_known: boolean;
    origin_daily_assignment_id?: string | null;
    word_id: string;
    session_id: string;
    session_type: string;
    date: string;
    created_at: string;
  }> = [];

  sessions.forEach((s: any) => {
    const answersList = s.test_answers ?? [];
    answersList.forEach((a: any) => {
      allAnswers.push({
        id: a.id,
        is_known: a.is_known,
        origin_daily_assignment_id: a.origin_daily_assignment_id,
        word_id: a.word_id,
        session_id: s.id,
        session_type: s.type || 'normal',
        date: s.date,
        created_at: a.created_at || s.created_at,
      });
    });
  });

  return assignments.map((assignment) => {
    const chunkWordCount = assignment.range_end - assignment.range_start + 1;

    const chunkAnswers = allAnswers.filter((ans) => {
      if (ans.origin_daily_assignment_id === assignment.id) {
        return true;
      }
      const w = wordMap.get(ans.word_id);
      return w && w.number >= assignment.range_start && w.number <= assignment.range_end;
    });

    const totalAttempts = chunkAnswers.length;
    const correctCount = chunkAnswers.filter((a) => a.is_known).length;

    const sessionMap = new Map<
      string,
      { date: string; created_at: string; type: string; answers: typeof chunkAnswers }
    >();

    chunkAnswers.forEach((ans) => {
      const sId = ans.session_id;
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, {
          date: ans.date,
          created_at: ans.created_at,
          type: ans.session_type,
          answers: [],
        });
      }
      sessionMap.get(sId)!.answers.push(ans);
    });

    const sortedSessions = Array.from(sessionMap.values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    const fullHistory: ChunkHistoryPoint[] = [];
    const drillHistory: ChunkHistoryPoint[] = [];

    sortedSessions.forEach((s) => {
      const sTotal = s.answers.length;
      const sCorrect = s.answers.filter((a) => a.is_known).length;
      const accuracyRate = sTotal > 0 ? Math.round((sCorrect / sTotal) * 100) : 0;

      const isFullScope =
        s.type === 'daily_check' || sTotal >= Math.min(Math.ceil(chunkWordCount * 0.7), chunkWordCount);

      const point: ChunkHistoryPoint = {
        testDate: s.date,
        accuracyRate,
        correctCount: sCorrect,
        totalCount: sTotal,
      };

      if (isFullScope) {
        fullHistory.push(point);
      } else {
        drillHistory.push(point);
      }
    });

    let currentAccuracyRate = 0;
    if (fullHistory.length > 0) {
      currentAccuracyRate = fullHistory[fullHistory.length - 1].accuracyRate;
    } else if (drillHistory.length > 0) {
      currentAccuracyRate = drillHistory[drillHistory.length - 1].accuracyRate;
    } else if (totalAttempts > 0) {
      currentAccuracyRate = Math.round((correctCount / totalAttempts) * 100);
    }

    let needsAttention = false;
    if (fullHistory.length > 0) {
      const recent = fullHistory.slice(-2);
      const avg = recent.reduce((sum, p) => sum + p.accuracyRate, 0) / recent.length;
      needsAttention = avg < 70;
    } else if (totalAttempts > 0) {
      needsAttention = currentAccuracyRate < 70;
    }

    const wordStatsMap = new Map<string, { mistakes: number; total: number }>();
    chunkAnswers.forEach((a) => {
      const cur = wordStatsMap.get(a.word_id) ?? { mistakes: 0, total: 0 };
      cur.total += 1;
      if (!a.is_known) cur.mistakes += 1;
      wordStatsMap.set(a.word_id, cur);
    });

    const mistakeWords: ChunkMistakeWord[] = [];
    wordStatsMap.forEach((stats, wordId) => {
      if (stats.mistakes > 0) {
        const wInfo = wordMap.get(wordId);
        if (wInfo) {
          mistakeWords.push({
            wordId: wInfo.id,
            headword: wInfo.word,
            pronunciation: wInfo.pronunciation ?? undefined,
            meaning: wInfo.meaning,
            number: wInfo.number,
            wrongCount: stats.mistakes,
            totalCount: stats.total,
          });
        }
      }
    });

    mistakeWords.sort((a, b) => b.wrongCount - a.wrongCount || a.number - b.number);

    return {
      chunkId: assignment.id,
      rangeStart: assignment.range_start,
      rangeEnd: assignment.range_end,
      originDate: assignment.date,
      totalAttempts,
      correctCount,
      accuracyRate: currentAccuracyRate,
      fullHistory,
      drillHistory,
      needsAttention,
      mistakeWords,
    };
  });
}
`;

writeFile('lib/weakness/computeChunkStats.ts', computeChunkStatsTs);

console.log('\n================================================================');
console.log('✅ 本番実効速度改善の全ファイルが正常に更新されました！');
console.log('================================================================\n');