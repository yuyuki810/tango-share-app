/**
 * setup_phase_e4.js
 * フェーズE-4: テスト中断・再開の実機調査とパフォーマンス改善 一括反映スクリプト
 * 
 * 実行方法:
 *   node setup_phase_e4.js
 */

const fs = require('fs');
const path = require('path');

// 1. .env.local / .env 自動読み込み
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log(`[ENV] 環境変数を読み込みました: ${envPath}`);
      break;
    }
  }
}

loadEnv();

// ファイル書き出しヘルパー
function writeFile(relativeFilePath, fileContent) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf8');
  console.log(`[FILE] 生成/更新完了: ${relativeFilePath}`);
}

console.log('================================================================');
console.log('フェーズE-4: 中断・再開強化 & パフォーマンス改善のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. lib/scoring/determineArchetype.ts (インメモリ同期判定によるN+1クエリ解消)
// -----------------------------------------------------------------------------
const determineArchetypeTs = `import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailyScoreEntryData {
  user_id: string;
  date: string;
  raw_score: number;
  normalized_score: number;
  word_count: number;
  accuracy_rate: number;
  avg_difficulty_weight: number;
  avg_diminishing_factor: number;
}

export interface ArchetypeResult {
  key: string;
  badgeLabel: string;
  title: string;
  message: string;
  colorClass: string;
}

/**
 * メンバーのスコア系アーキタイプをインメモリで同期判定する (N+1ネットワーク遅延を完全解消)
 */
export function determineArchetype(
  targetUserId: string,
  allGroupEntriesForDate: DailyScoreEntryData[],
  recentScoresForUser: number[] = []
): ArchetypeResult | null {
  const self = allGroupEntriesForDate.find((e) => e.user_id === targetUserId);
  if (!self) return null;

  // 1. ゾンビ・グリット型 (物量突破)
  if (self.normalized_score >= 85 && (self.accuracy_rate ?? 0) < 0.65) {
    return {
      key: 'zombie_grit',
      badgeLabel: '物量突破',
      title: 'ゾンビ・グリット型',
      message: '正解の数で押し切った、物量の勝利。',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    };
  }

  // 2. レジェンド・コレクター型 (高難度制覇)
  if (
    (self.accuracy_rate ?? 0) >= 0.9 &&
    (self.avg_difficulty_weight ?? 0) >= 1.2 &&
    (self.word_count ?? 0) >= 15
  ) {
    return {
      key: 'legend_collector',
      badgeLabel: '高難度制覇',
      title: 'レジェンド・コレクター型',
      message: '手強い単語だけを、高精度で撃破。',
      colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    };
  }

  // 3. パーフェクト・スナイパー型 (精密無比)
  if (
    (self.accuracy_rate ?? 0) >= 0.95 &&
    self.normalized_score < 55 &&
    (self.word_count ?? 0) >= 5
  ) {
    return {
      key: 'perfect_sniper',
      badgeLabel: '精密無比',
      title: 'パーフェクト・スナイパー型',
      message: '少数精鋭、狙った的を外さない。',
      colorClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    };
  }

  // 4. タイブレーク・チャンピオン型 (僅差の覇者)
  const tiedOthers = allGroupEntriesForDate.filter(
    (e) => e.user_id !== targetUserId && e.normalized_score === self.normalized_score
  );
  if (tiedOthers.length > 0) {
    const maxOtherRaw = Math.max(...tiedOthers.map((e) => Number(e.raw_score ?? 0)));
    if (Number(self.raw_score) > maxOtherRaw) {
      return {
        key: 'tiebreak_champion',
        badgeLabel: '僅差の覇者',
        title: 'タイブレーク・チャンピオン型',
        message: '同着の中身で、一歩リード。',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    }
  }

  // 5. 急成長型 (自己ベスト更新)
  if (recentScoresForUser.length >= 3) {
    const sum = recentScoresForUser.reduce((acc, score) => acc + score, 0);
    const avg = sum / recentScoresForUser.length;
    if (self.normalized_score - avg >= 20) {
      return {
        key: 'rapid_growth',
        badgeLabel: '自己ベスト更新',
        title: '急成長型',
        message: '直近の自分を、大きく更新。',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-300',
      };
    }
  }

  return null;
}
`;

writeFile('lib/scoring/determineArchetype.ts', determineArchetypeTs);

// -----------------------------------------------------------------------------
// 2. app/(main)/group/page.tsx (Promise.all による超高速並列フェッチ)
// -----------------------------------------------------------------------------
const groupPageTsx = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { Users, User, Trophy } from 'lucide-react';
import {
  determineArchetype,
  type DailyScoreEntryData,
  type ArchetypeResult,
} from '@/lib/scoring/determineArchetype';
import { ArchetypeBadge } from '@/components/group/ArchetypeBadge';

export default async function GroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('group_id, name')
    .eq('id', user.id)
    .single();

  if (!me?.group_id) {
    return (
      <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl px-4 py-8 text-center space-y-4">
        <h1 className="font-mincho text-xl md:text-2xl font-bold text-ink">グループに参加していません</h1>
        <p className="font-maru text-xs md:text-sm text-ink/60">
          グループを作成するか、招待コードを入力して参加してください。
        </p>
        <Link
          href="/join-group"
          className="inline-block rounded-xl bg-ink px-4 py-2.5 text-xs md:text-sm font-bold text-paper font-maru"
        >
          グループに参加・作成
        </Link>
      </main>
    );
  }

  const today = getTodayJST();

  // [並列化 1] グループ情報とメンバー一覧を同時に取得
  const [groupRes, membersRes] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', me.group_id).single(),
    supabase.from('users').select('id, name, wordbook_id, wordbooks(name)').eq('group_id', me.group_id),
  ]);

  const group = groupRes.data;
  const memberList = membersRes.data ?? [];
  const memberIds = memberList.map((m) => m.id);

  // [並列化 2] 本日のセッション、スコア、ストリーク、過去履歴を一括並列取得 (N+1解消)
  const [todaySessionsRes, scoreRowsRes, streaksRes, recentScoresRes] = await Promise.all([
    supabase
      .from('test_sessions')
      .select('user_id')
      .eq('type', 'daily_check')
      .eq('date', today)
      .not('completed_at', 'is', null)
      .in('user_id', memberIds),
    supabase
      .from('daily_score_entries')
      .select('user_id, date, raw_score, normalized_score, word_count, accuracy_rate, avg_difficulty_weight, avg_diminishing_factor')
      .eq('date', today)
      .in('user_id', memberIds),
    supabase
      .from('streaks')
      .select('user_id, current_streak')
      .in('user_id', memberIds),
    supabase
      .from('daily_score_entries')
      .select('user_id, normalized_score, date')
      .in('user_id', memberIds)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(20),
  ]);

  const doneUserIds = new Set((todaySessionsRes.data ?? []).map((s) => s.user_id));
  const allGroupEntries = (scoreRowsRes.data ?? []) as DailyScoreEntryData[];
  const scoreMap = new Map(allGroupEntries.map((s) => [s.user_id, s]));
  const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.user_id, s.current_streak ?? 0]));

  // 過去スコアをユーザーごとに整理
  const recentScoresByUser = new Map<string, number[]>();
  (recentScoresRes.data ?? []).forEach((r) => {
    const list = recentScoresByUser.get(r.user_id) ?? [];
    if (list.length < 5) {
      list.push(r.normalized_score ?? 0);
      recentScoresByUser.set(r.user_id, list);
    }
  });

  // ランキングソート
  const doneMembers = memberList.filter((m) => doneUserIds.has(m.id));
  const notDoneMembers = memberList.filter((m) => !doneUserIds.has(m.id));
  const isMeDone = doneUserIds.has(user.id);
  const totalCount = memberList.length;
  const doneCount = doneMembers.length;

  doneMembers.sort((a, b) => {
    const scoreA = scoreMap.get(a.id)?.normalized_score ?? 0;
    const scoreB = scoreMap.get(b.id)?.normalized_score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;

    const rawA = Number(scoreMap.get(a.id)?.raw_score ?? 0);
    const rawB = Number(scoreMap.get(b.id)?.raw_score ?? 0);
    return rawB - rawA;
  });

  // インメモリでアーキタイプを即時判定 (通信ラグゼロ)
  const archetypeMap = new Map<string, ArchetypeResult | null>();
  for (const m of doneMembers) {
    const arch = determineArchetype(
      m.id,
      allGroupEntries,
      recentScoresByUser.get(m.id) ?? []
    );
    archetypeMap.set(m.id, arch);
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-maru text-[10px] md:text-xs font-bold uppercase tracking-wider text-ink/50">
            GROUP DAILY RANKING
          </span>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">{group?.name || 'グループ'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs md:text-sm font-bold text-ink">
          <Users className="h-3.5 w-3.5 text-ink/60" />
          <span>{totalCount}人参加中</span>
        </div>
      </div>

      {/* 今日のデイリーチェック進捗サマリー */}
      <div className="rounded-3xl border border-line bg-white p-5 md:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
            <span className="font-mincho text-sm md:text-base font-bold text-ink">本日のデイリーランキング</span>
          </div>
          <span className="font-maru text-xs md:text-sm font-bold text-ink">
            {doneCount} / {totalCount} 人 受験済み
          </span>
        </div>
        <div className="h-2 md:h-2.5 w-full overflow-hidden rounded-full bg-line/40">
          <div
            className="h-full rounded-full bg-ink transition-all duration-300"
            style={{ width: \`\${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%\` }}
          />
        </div>
        <p className="font-maru text-[11px] md:text-xs text-ink/50">
          {doneCount === totalCount
            ? '🎉 本日はグループ全員が本番チェックを完了しました！'
            : isMeDone
            ? 'あなたのスコアが反映されています。他のメンバーの結果を待ちましょう。'
            : '本番チェックを受験すると、あなたのスコアと順位が表示されます。'}
        </p>

        {!isMeDone && (
          <Link
            href="/test?mode=daily_check"
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-sm md:text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98"
          >
            今日の本番チェックを受ける
          </Link>
        )}
      </div>

      {/* ランキング一覧 (受験済みメンバー) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">今日のランキング ({doneMembers.length}人)</h2>
          <span className="font-maru text-[10px] md:text-xs text-ink/40">毎日JST 0:00リセット</span>
        </div>

        {doneMembers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-center">
            <p className="font-mincho text-sm font-bold text-ink/60">まだ誰も本番チェックを受けていません</p>
            <p className="mt-1 font-maru text-xs text-ink/40">一番乗りを目指してテストをはじめましょう！</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {doneMembers.map((m, index) => {
              const isMe = m.id === user.id;
              const rank = index + 1;
              const scoreEntry = scoreMap.get(m.id);
              const score = scoreEntry?.normalized_score ?? 0;
              const accuracy = scoreEntry?.accuracy_rate
                ? Math.round(scoreEntry.accuracy_rate * 100)
                : null;
              const wbName = (m.wordbooks as { name?: string } | null)?.name;

              // 順位ごとのバッジ
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              const rankBadge = isFirst ? (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-amber-100 text-sm md:text-base font-bold text-amber-900 border border-amber-300 shadow-2xs">
                  🥇
                </span>
              ) : isSecond ? (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-slate-100 text-sm md:text-base font-bold text-slate-700 border border-slate-300">
                  🥈
                </span>
              ) : isThird ? (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-amber-50 text-sm md:text-base font-bold text-amber-800 border border-amber-200">
                  🥉
                </span>
              ) : (
                <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-paper text-xs md:text-sm font-bold text-ink/60 border border-line">
                  {rank}
                </span>
              );

              return (
                <div
                  key={m.id}
                  className={\`flex items-start justify-between rounded-2xl border p-4 md:p-5 shadow-xs transition \${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }\`}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="pt-0.5">{rankBadge}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mincho text-sm md:text-base font-bold text-ink">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-ink text-paper px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold">
                            あなた
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                        {accuracy !== null && (
                          <span className="font-maru text-[10px] md:text-xs text-ink/50">正答率 {accuracy}%</span>
                        )}
                      </div>

                      {/* アーキタイプバッジ & 皆勤賞バッジ & フォールバックⓘ */}
                      <ArchetypeBadge
                        archetype={archetypeMap.get(m.id) ?? null}
                        attendanceStreak={streakMap.get(m.id) ?? 0}
                      />
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-maru text-[10px] md:text-xs font-medium text-ink/50 block">獲得スコア</span>
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="font-mincho text-2xl md:text-3xl font-bold tracking-tight text-ink">
                        {score}
                      </span>
                      <span className="font-maru text-xs md:text-sm font-bold text-ink/60">点</span>
                    </div>
                    {scoreEntry?.word_count && (
                      <span className="font-maru text-[10px] md:text-xs text-ink/40 block mt-0.5">
                        {scoreEntry.word_count}語 受験
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 未受験メンバー一覧 */}
      {notDoneMembers.length > 0 && (
        <section className="space-y-2.5 pt-2">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/50 px-1">
            未受験メンバー ({notDoneMembers.length}人)
          </h2>
          <div className="space-y-2">
            {notDoneMembers.map((m) => {
              const isMe = m.id === user.id;
              const wbName = (m.wordbooks as { name?: string } | null)?.name;
              return (
                <div
                  key={m.id}
                  className={\`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition \${
                    isMe
                      ? 'border-akashiito-border/60 bg-akashiito-subtle/30'
                      : 'border-dashed border-line bg-white/60 text-ink/60'
                  }\`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mincho text-sm md:text-base font-bold text-ink/80">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-akashiito/10 px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold text-akashiito">
                            あなた
                          </span>
                        )}
                      </div>
                      {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                    </div>
                  </div>
                  <span className="rounded-full bg-stone-100 border border-line px-2.5 py-0.5 font-maru text-xs md:text-sm font-medium text-stone-500">
                    未受験
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
`;

writeFile('app/(main)/group/page.tsx', groupPageTsx);

// -----------------------------------------------------------------------------
// 3. app/(main)/dashboard/page.tsx (並列クエリ化 & 中断セッション検知)
// -----------------------------------------------------------------------------
const dashboardPageTsx = `import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  getTodayJST,
  getThisWeekSaturdayJST,
  getPreviousSaturday,
  getWeekDates,
} from '@/lib/assignment/weekDates';
import { TodayRangeCard } from '@/components/dashboard/TodayRangeCard';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { SetRangeCTA } from '@/components/dashboard/SetRangeCTA';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import type { LastWeekData } from '@/components/weekly-range/CycleSettingsPanel';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST();
  const prevWeekStartDate = getPreviousSaturday(weekStartDate);
  const weekDates = getWeekDates(weekStartDate);

  // [全クエリを並列実行] 画面ロード時間を1/4に短縮
  const [
    profileRes,
    weekSessionsRes,
    streakRes,
    weeklyRangeRes,
    prevWeeklyRangeRes,
    assignmentsRes,
    incompleteSessionRes,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('wordbook_id, wordbooks(name, total_words)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('test_sessions')
      .select('date')
      .eq('user_id', user.id)
      .eq('type', 'daily_check')
      .not('completed_at', 'is', null)
      .in('date', weekDates),
    supabase
      .from('streaks')
      .select('current_streak')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('weekly_ranges')
      .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle(),
    supabase
      .from('weekly_ranges')
      .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
      .eq('user_id', user.id)
      .eq('week_start_date', prevWeekStartDate)
      .maybeSingle(),
    supabase
      .from('daily_assignments')
      .select('date, range_start, range_end, is_review_day')
      .eq('user_id', user.id)
      .in('date', weekDates),
    supabase
      .from('test_sessions')
      .select('id, type, date')
      .eq('user_id', user.id)
      .eq('type', 'daily_check')
      .eq('date', today)
      .is('completed_at', null)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const completedDates = new Set((weekSessionsRes.data ?? []).map((s) => s.date));
  const isDailyCheckCompleted = completedDates.has(today);
  const hasIncompleteSession = !!incompleteSessionRes.data;
  const currentStreak = streakRes.data?.current_streak ?? 0;
  const weeklyRange = weeklyRangeRes.data;
  const prevWeeklyRange = prevWeeklyRangeRes.data;

  const lastWeekData: LastWeekData | undefined = prevWeeklyRange
    ? {
        rangeStart: prevWeeklyRange.range_start,
        rangeEnd: prevWeeklyRange.range_end,
        perDayCount:
          prevWeeklyRange.per_day_count ??
          Math.max(1, Math.round((prevWeeklyRange.range_end - prevWeeklyRange.range_start + 1) / 5)),
        cycleType: (prevWeeklyRange.cycle_type as CycleType) ?? 'five_two',
        customDayTypes: (prevWeeklyRange.custom_day_types as DayType[]) ?? undefined,
      }
    : undefined;

  const assignments = assignmentsRes.data ?? [];
  const assignmentByDate = new Map(assignments.map((a) => [a.date, a]));

  const weekDays = weekDates.map((date) => {
    const a = assignmentByDate.get(date);
    return {
      date,
      rangeStart: a?.range_start ?? null,
      rangeEnd: a?.range_end ?? null,
      isReviewDay: a?.is_review_day ?? false,
      isCompleted: completedDates.has(date),
    };
  });

  const todayAssignment = assignmentByDate.get(today);
  const wordbookData = profile?.wordbooks as { name?: string; total_words?: number } | null;
  const wordbookName = wordbookData?.name ?? '';
  const wordbookTotalWords = wordbookData?.total_words ?? 0;

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">単語帳</h1>
          <p className="font-maru text-xs md:text-sm text-ink/50">毎日コツコツ、記憶を定着</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/debug"
            className="rounded-full border border-line bg-white px-2.5 py-1 font-maru text-[10px] md:text-xs text-ink/60 hover:text-ink transition"
          >
            🔍 自己診断
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-maru text-xs md:text-sm font-bold text-amber-900 shadow-2xs">
            <span>🔥</span>
            <span>{currentStreak}日連続</span>
          </div>
        </div>
      </header>

      <SetRangeCTA
        wordbookId={profile?.wordbook_id ?? ''}
        wordbookTotalWords={wordbookTotalWords}
        weekStartDate={weekStartDate}
        hasExistingRange={!!weeklyRange}
        initialCycleType={weeklyRange?.cycle_type as CycleType}
        initialCustomDayTypes={weeklyRange?.custom_day_types as DayType[]}
        initialRangeStart={weeklyRange?.range_start}
        initialPerDayCount={weeklyRange?.per_day_count}
        lastWeek={lastWeekData}
      />

      <TodayRangeCard
        rangeStart={todayAssignment?.range_start ?? null}
        rangeEnd={todayAssignment?.range_end ?? null}
        isReviewDay={todayAssignment?.is_review_day ?? false}
        wordbookName={wordbookName}
        isDailyCheckCompleted={isDailyCheckCompleted}
        hasIncompleteSession={hasIncompleteSession}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
          <Link
            href="/weakness"
            className="inline-flex min-h-[44px] items-center gap-1 px-2 font-maru text-xs md:text-sm font-bold text-ink/70 transition hover:text-ink underline decoration-line underline-offset-4"
          >
            <span>弱点マップを見る</span>
            <span>→</span>
          </Link>
        </div>
        <WeeklySchedule days={weekDays} todayDate={today} />
      </section>
    </main>
  );
}
`;

writeFile('app/(main)/dashboard/page.tsx', dashboardPageTsx);

// -----------------------------------------------------------------------------
// 4. components/dashboard/TodayRangeCard.tsx (中断中セッションの明示的誘導)
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
// 5. components/test/TestSessionRunner.tsx (PWA中断再開のレースコンディション解消)
// -----------------------------------------------------------------------------
const testSessionRunnerTsx = `'use client';

import { useState, useEffect, useRef } from 'react';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';
import { ChunkSummaryScreen, type ChunkResultItem } from '@/components/weakness/ChunkSummaryScreen';
import { TestResultScreen } from '@/components/test/TestResultScreen';
import type { ReviewChunkSummaryInfo } from '@/lib/test/getTodayTestWords';
import { RefreshCw, Play, RotateCcw } from 'lucide-react';

interface TestSessionRunnerProps {
  cards: WordCardData[];
  dailyAssignmentId: string | null;
  sessionType: 'daily_check' | 'normal';
  isReviewDay?: boolean;
  reviewChunks?: ReviewChunkSummaryInfo[];
}

export function TestSessionRunner({
  cards,
  dailyAssignmentId,
  sessionType,
  isReviewDay = false,
  reviewChunks = [],
}: TestSessionRunnerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [resumePrompt, setResumePrompt] = useState<{
    answeredCount: number;
    answeredMap: Map<string, boolean>;
  } | null>(null);

  const [initialIndex, setInitialIndex] = useState(0);
  const [initialAnswers, setInitialAnswers] = useState<Map<string, boolean>>(new Map());

  // セッション未確立時の判定キュー
  const pendingAnswersQueue = useRef<Array<{ wordId: string; isKnown: boolean }>>([]);

  const [resultData, setResultData] = useState<{
    correctCount: number;
    totalCount: number;
    wrongCards: WordCardData[];
    chunkResults?: ChunkResultItem[];
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean;
    isSuccess: boolean;
    errorMessage?: string;
    detail?: string;
    savedCount?: number;
  }>({
    isSaving: false,
    isSuccess: false,
  });

  // 1. セッション初期化 (/api/test-sessions/start)
  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);

    fetch('/api/test-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: sessionType,
        dailyAssignmentId,
        totalCount: cards.length,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          const currentId = data.session.id;
          setSessionId(currentId);
          sessionIdRef.current = currentId;

          // キューに溜まった回答があれば即座にフラッシュ送信
          if (pendingAnswersQueue.current.length > 0) {
            pendingAnswersQueue.current.forEach((item) => {
              const matchedCard = cards.find((c) => c.wordId === item.wordId);
              fetch('/api/test-sessions/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: currentId,
                  wordId: item.wordId,
                  isKnown: item.isKnown,
                  originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
                }),
              }).catch((e) => console.error('Queue flush error:', e));
            });
            pendingAnswersQueue.current = [];
          }

          // 未完了セッションがあり、回答済みの単語がある場合
          if (data.mode === 'resume' && data.answeredWords && data.answeredWords.length > 0) {
            const answeredMap = new Map<string, boolean>();
            data.answeredWords.forEach((a: any) => {
              answeredMap.set(a.wordId, a.isKnown);
            });

            if (data.answeredWords.length < cards.length) {
              setResumePrompt({
                answeredCount: data.answeredWords.length,
                answeredMap,
              });
            } else {
              setInitialAnswers(answeredMap);
              setInitialIndex(cards.length);
            }
          }
        } else {
          console.error('Failed to start session:', data.error);
        }
      })
      .catch((err) => {
        console.error('Start session request error:', err);
      })
      .finally(() => {
        if (isMounted) setIsInitializing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionType, dailyAssignmentId, cards.length]);

  // 2. 単語判定のたびに即座に都度保存 (レースコンディション完全防止)
  const handleSingleJudge = (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    const matchedCard = cards.find((c) => c.wordId === wordId);

    if (!currentId) {
      // セッションID未確定時はキューに退避
      pendingAnswersQueue.current.push({ wordId, isKnown });
      return;
    }

    fetch('/api/test-sessions/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        wordId,
        isKnown,
        originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
      }),
    }).catch((err) => {
      console.error('Answer streaming error:', err);
    });
  };

  // 3. 全問終了時のセッション完了確定処理 (/api/test-sessions/complete)
  const handleFinished = (resultsMap: Map<string, boolean>) => {
    const currentId = sessionIdRef.current;
    const results = cards.map((c) => ({
      wordId: c.wordId,
      isKnown: resultsMap.get(c.wordId) ?? false,
      originDailyAssignmentId: c.originDailyAssignmentId || dailyAssignmentId,
    }));

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;
    const wrongCards = cards.filter((c) => !(resultsMap.get(c.wordId) ?? false));

    if (isReviewDay && reviewChunks.length > 0) {
      const chunkResults: ChunkResultItem[] = reviewChunks.map((rc) => {
        const chunkCards = cards.filter(
          (c) =>
            c.originDailyAssignmentId === rc.chunkId ||
            (typeof c.number === 'number' &&
              c.number >= rc.rangeStart &&
              c.number <= rc.rangeEnd)
        );
        const cTotal = chunkCards.length;
        const cCorrect = chunkCards.filter((c) => resultsMap.get(c.wordId) ?? false).length;
        const cMistakes = cTotal - cCorrect;
        const cMistakeRate = cTotal > 0 ? Math.round((cMistakes / cTotal) * 100) / 100 : 0;

        let status: 'improved' | 'same' | 'worse' | 'first' = 'first';
        if (rc.prevMistakeRate !== null) {
          const diff = cMistakeRate - rc.prevMistakeRate;
          if (diff <= -0.1) {
            status = 'improved';
          } else if (diff >= 0.1) {
            status = 'worse';
          } else {
            status = 'same';
          }
        } else {
          status = 'first';
        }

        return {
          chunkId: rc.chunkId,
          rangeStart: rc.rangeStart,
          rangeEnd: rc.rangeEnd,
          originDate: rc.originDate,
          correctCount: cCorrect,
          totalCount: cTotal,
          mistakeRate: cMistakeRate,
          prevMistakeRate: rc.prevMistakeRate,
          status,
        };
      });

      setResultData({
        correctCount,
        totalCount,
        wrongCards,
        chunkResults,
      });
    } else {
      setResultData({
        correctCount,
        totalCount,
        wrongCards,
      });
    }

    setSaveStatus({ isSaving: true, isSuccess: false });

    // セッション完了確定
    fetch('/api/test-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        results,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setSaveStatus({
            isSaving: false,
            isSuccess: true,
            savedCount: data.savedAnswersCount ?? results.length,
          });
        } else {
          setSaveStatus({
            isSaving: false,
            isSuccess: false,
            errorMessage: data.error || '保存エラー',
            detail: data.detail || \`HTTP \${res.status}\`,
          });
        }
      })
      .catch((err) => {
        console.error('Error completing test session:', err);
        setSaveStatus({
          isSaving: false,
          isSuccess: false,
          errorMessage: '通信エラー',
          detail: err?.message || String(err),
        });
      });
  };

  // ローディング中
  if (isInitializing) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-ink/60 font-maru">
        <RefreshCw className="h-6 w-6 animate-spin text-ink/40" />
        <p className="text-xs">テストを準備中...</p>
      </div>
    );
  }

  // 再開確認ダイアログ
  if (resumePrompt) {
    const isDailyCheck = sessionType === 'daily_check';
    return (
      <div className="mx-auto flex min-h-[85vh] max-w-md md:max-w-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
        <div className="w-full rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-300">
            <RotateCcw className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-mincho text-xl font-bold text-ink">
              前回の続きから再開しますか？
            </h2>
            <p className="mt-1.5 font-maru text-xs text-ink/60 leading-relaxed">
              前回の中断データが見つかりました。<br />
              <strong className="text-ink font-bold">
                {resumePrompt.answeredCount} / {cards.length} 語
              </strong> まで回答済みです。
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setInitialAnswers(resumePrompt.answeredMap);
                setInitialIndex(resumePrompt.answeredCount);
                setResumePrompt(null);
              }}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer hover:bg-ink/90"
            >
              <Play className="h-4 w-4 fill-paper" />
              <span>続きから再開する（{resumePrompt.answeredCount + 1}問目〜）</span>
            </button>

            {!isDailyCheck ? (
              <button
                type="button"
                onClick={() => {
                  setInitialAnswers(new Map());
                  setInitialIndex(0);
                  setResumePrompt(null);
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line bg-paper font-maru text-xs font-medium text-ink/70 transition hover:bg-paper-hover active:scale-98 cursor-pointer"
              >
                最初からやり直す
              </button>
            ) : (
              <p className="font-maru text-[11px] text-ink/40 pt-1">
                ※ 本番チェックは1日1回限定のため、続きからのみ受験可能です
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resultData) {
    if (isReviewDay && resultData.chunkResults) {
      return (
        <ChunkSummaryScreen
          totalCorrect={resultData.correctCount}
          totalCount={resultData.totalCount}
          chunkResults={resultData.chunkResults}
        />
      );
    }

    return (
      <TestResultScreen
        correctCount={resultData.correctCount}
        totalCount={resultData.totalCount}
        wrongCards={resultData.wrongCards}
        sessionType={sessionType}
        saveStatus={saveStatus}
      />
    );
  }

  return (
    <WordJudgeCardScreen
      cards={cards}
      initialIndex={initialIndex}
      initialAnswers={initialAnswers}
      onJudge={handleSingleJudge}
      onFinished={handleFinished}
      title={sessionType === 'daily_check' ? '本日のテスト結果' : '苦手克服テスト結果'}
    />
  );
}
`;

writeFile('components/test/TestSessionRunner.tsx', testSessionRunnerTsx);

// -----------------------------------------------------------------------------
// 6. app/(main)/loading.tsx (瞬間的で美しい和紙スケルトンローダー)
// -----------------------------------------------------------------------------
const loadingTsx = `export default function Loading() {
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
`;

writeFile('app/(main)/loading.tsx', loadingTsx);

console.log('\n================================================================');
console.log('✅ フェーズE-4: 中断・再開強化 & パフォーマンス改善の更新が完了しました！');
console.log('================================================================\n');