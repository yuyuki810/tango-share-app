/**
 * setup_phase_d1.js
 * フェーズD-1: 週間カレンダーの完了状態反映とグループ人数上限表記の整理 一括セットアップスクリプト
 * 
 * 実行方法:
 *   node setup_phase_d1.js
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
console.log('フェーズD-1: 週間カレンダー完了状態反映と人数表記整理のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. components/dashboard/WeeklySchedule.tsx (完了日表示・チェックマーク対応)
// -----------------------------------------------------------------------------
const weeklyScheduleTsx = `'use client';

import { Check } from 'lucide-react';

export interface ScheduleDay {
  date: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  isCompleted?: boolean;
}

interface WeeklyScheduleProps {
  days: ScheduleDay[];
  todayDate: string;
}

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];

function formatDateShort(dateStr: string): string {
  const [, , d] = dateStr.split('-').map(Number);
  return \`\${d}\`;
}

export function WeeklySchedule({ days, todayDate }: WeeklyScheduleProps) {
  return (
    <div className="rounded-3xl border border-line bg-white p-4 shadow-xs">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isToday = day.date === todayDate;
          const isOff = day.rangeStart === null;
          const isCompleted = !!day.isCompleted;

          // スタイル判定:
          // 1. 完了日 (今日・過去日): エメラルドグリーン + チェックマーク
          // 2. 今日の未完了: 赤枠 (要対応)
          // 3. 復習日 (未完了): ゴールド/ハイライター
          // 4. 休み: 薄いグレー
          // 5. 新規進捗日 (未完了): ペーパー/ライン
          let dayStyle = 'border-line/80 bg-paper text-ink';
          if (isCompleted) {
            dayStyle = isToday
              ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-300 shadow-2xs'
              : 'border-emerald-200 bg-emerald-50/60 shadow-2xs';
          } else if (isToday) {
            dayStyle = 'border-akashiito bg-akashiito/5 ring-2 ring-akashiito/30';
          } else if (day.isReviewDay) {
            dayStyle = 'border-highlighter bg-highlighter/30';
          } else if (isOff) {
            dayStyle = 'border-line/40 bg-line/20 text-ink/30';
          }

          const labelColor = isCompleted
            ? 'text-emerald-800'
            : isToday
            ? 'text-akashiito'
            : 'text-ink/60';

          const dateColor = isCompleted
            ? 'text-emerald-900 font-bold'
            : isToday
            ? 'text-akashiito font-bold'
            : 'text-ink font-bold';

          return (
            <div
              key={day.date}
              className={\`relative flex min-h-[82px] flex-col items-center justify-between rounded-2xl border p-1.5 text-center transition \${dayStyle}\`}
            >
              {/* 日付ヘッダー */}
              <div>
                <span className={\`block font-maru text-[11px] font-bold \${labelColor}\`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={\`block font-maru text-xs \${dateColor}\`}>
                  {formatDateShort(day.date)}
                </span>
              </div>

              {/* 中央コンテンツ */}
              <div className="my-1 flex flex-col items-center justify-center">
                {isCompleted ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                ) : day.isReviewDay ? (
                  <span className="rounded-sm bg-highlighter/60 px-1 py-0.5 text-[9px] font-bold text-ink">
                    復習
                  </span>
                ) : isOff ? (
                  <span className="text-[10px] text-ink/30 font-maru">休</span>
                ) : (
                  <span className="font-maru text-[10px] font-bold text-ink/80">
                    {day.rangeEnd !== null && day.rangeStart !== null
                      ? day.rangeEnd - day.rangeStart + 1
                      : 0}語
                  </span>
                )}
              </div>

              {/* 下部インジケータ */}
              <div className="flex h-1.5 items-center justify-center">
                {isToday ? (
                  <div
                    className={\`h-1.5 w-1.5 rounded-full \${
                      isCompleted ? 'bg-emerald-600' : 'bg-akashiito'
                    }\`}
                  />
                ) : (
                  <div className="h-1.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

writeFile('components/dashboard/WeeklySchedule.tsx', weeklyScheduleTsx);

// -----------------------------------------------------------------------------
// 2. app/(main)/dashboard/page.tsx (週内全日の完了状態を取得してカレンダーに伝搬)
// -----------------------------------------------------------------------------
const dashboardPage = `import Link from 'next/link';
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

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name, total_words)')
    .eq('id', user.id)
    .single();

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST();
  const prevWeekStartDate = getPreviousSaturday(weekStartDate);
  const weekDates = getWeekDates(weekStartDate);

  // 週内（土〜金）の daily_check 完了日を取得
  const { data: weekDailyCheckSessions } = await supabase
    .from('test_sessions')
    .select('date')
    .eq('user_id', user.id)
    .eq('type', 'daily_check')
    .in('date', weekDates);

  const completedDates = new Set((weekDailyCheckSessions ?? []).map((s) => s.date));
  const isDailyCheckCompleted = completedDates.has(today);

  // ストリーク情報取得
  const { data: streakRow } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', user.id)
    .maybeSingle();

  const currentStreak = streakRow?.current_streak ?? 0;

  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  const { data: prevWeeklyRange } = await supabase
    .from('weekly_ranges')
    .select('range_start, range_end, per_day_count, cycle_type, custom_day_types')
    .eq('user_id', user.id)
    .eq('week_start_date', prevWeekStartDate)
    .maybeSingle();

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

  const { data: assignments } = await supabase
    .from('daily_assignments')
    .select('date, range_start, range_end, is_review_day')
    .eq('user_id', user.id)
    .in('date', weekDates);

  const assignmentByDate = new Map((assignments ?? []).map((a) => [a.date, a]));

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
    <main className="mx-auto max-w-md space-y-6 px-4 pb-24 pt-6">
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-mincho text-2xl font-bold text-ink">単語帳</h1>
          <p className="font-maru text-xs text-ink/50">毎日コツコツ、記憶を定着</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/debug"
            className="rounded-full border border-line bg-white px-2.5 py-1 font-maru text-[10px] text-ink/60 hover:text-ink transition"
          >
            🔍 自己診断
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-maru text-xs font-bold text-amber-900 shadow-2xs">
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
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs font-bold text-ink/60">今週のスケジュール (土〜金)</h2>
          <Link
            href="/weakness"
            className="inline-flex min-h-[44px] items-center gap-1 px-2 font-maru text-xs font-bold text-ink/70 transition hover:text-ink underline decoration-line underline-offset-4"
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

writeFile('app/(main)/dashboard/page.tsx', dashboardPage);

// -----------------------------------------------------------------------------
// 3. app/(main)/group/page.tsx (人数表記を「〇人参加中」に統一)
// -----------------------------------------------------------------------------
const groupPage = `export const dynamic = 'force-dynamic';
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
      <main className="mx-auto max-w-md px-4 py-8 text-center space-y-4">
        <h1 className="font-mincho text-xl font-bold text-ink">グループに参加していません</h1>
        <p className="font-maru text-xs text-ink/60">
          グループを作成するか、招待コードを入力して参加してください。
        </p>
        <Link
          href="/join-group"
          className="inline-block rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-paper font-maru"
        >
          グループに参加・作成
        </Link>
      </main>
    );
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', me.group_id)
    .single();

  const { data: members } = await supabase
    .from('users')
    .select('id, name, wordbook_id, wordbooks(name)')
    .eq('group_id', me.group_id);

  const today = getTodayJST();
  const memberList = members ?? [];
  const memberIds = memberList.map((m) => m.id);

  // 1. 本日の daily_check セッションを取得
  const { data: todaySessions } = await supabase
    .from('test_sessions')
    .select('user_id')
    .eq('type', 'daily_check')
    .eq('date', today)
    .in('user_id', memberIds);

  const doneUserIds = new Set((todaySessions ?? []).map((s) => s.user_id));

  // 2. 本日のスコアエントリーを取得
  const { data: scoreRows } = await supabase
    .from('daily_score_entries')
    .select('user_id, date, raw_score, normalized_score, word_count, accuracy_rate, avg_difficulty_weight, avg_diminishing_factor')
    .eq('date', today)
    .in('user_id', memberIds);

  const allGroupEntries = (scoreRows ?? []) as DailyScoreEntryData[];
  const scoreMap = new Map(allGroupEntries.map((s) => [s.user_id, s]));

  // 3. 各メンバーのストリークを取得
  const { data: streaks } = await supabase
    .from('streaks')
    .select('user_id, current_streak')
    .in('user_id', memberIds);

  const streakMap = new Map((streaks ?? []).map((s) => [s.user_id, s.current_streak ?? 0]));

  // 4. 受験済みメンバーをランキング順にソート (normalized_score 降順 -> raw_score 降順)
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

  // 5. 各受験メンバーのアーキタイプを判定
  const archetypeMap = new Map<string, ArchetypeResult | null>();
  for (const m of doneMembers) {
    const arch = await determineArchetype(supabase, m.id, today, allGroupEntries);
    archetypeMap.set(m.id, arch);
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-24 pt-6">
      {/* ヘッダー: 「3/4人」等の固定上限を排し実人数表記に統一 */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50">
            GROUP DAILY RANKING
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">{group?.name || 'グループ'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs font-bold text-ink">
          <Users className="h-3.5 w-3.5 text-ink/60" />
          <span>{totalCount}人参加中</span>
        </div>
      </div>

      {/* 今日のデイリーチェック進捗サマリー */}
      <div className="rounded-3xl border border-line bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="font-mincho text-sm font-bold text-ink">本日のデイリーランキング</span>
          </div>
          <span className="font-maru text-xs font-bold text-ink">
            {doneCount} / {totalCount} 人 受験済み
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
          <div
            className="h-full rounded-full bg-ink transition-all duration-300"
            style={{ width: \`\${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%\` }}
          />
        </div>
        <p className="font-maru text-[11px] text-ink/50">
          {doneCount === totalCount
            ? '🎉 本日はグループ全員が本番チェックを完了しました！'
            : isMeDone
            ? 'あなたのスコアが反映されています。他のメンバーの結果を待ちましょう。'
            : '本番チェックを受験すると、あなたのスコアと順位が表示されます。'}
        </p>

        {!isMeDone && (
          <Link
            href="/test?mode=daily_check"
            className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-sm font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98"
          >
            今日の本番チェックを受ける
          </Link>
        )}
      </div>

      {/* ランキング一覧 (受験済みメンバー) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-mincho text-xs font-bold text-ink/60">今日のランキング ({doneMembers.length}人)</h2>
          <span className="font-maru text-[10px] text-ink/40">毎日JST 0:00リセット</span>
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
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-900 border border-amber-300 shadow-2xs">
                  🥇
                </span>
              ) : isSecond ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 border border-slate-300">
                  🥈
                </span>
              ) : isThird ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-sm font-bold text-amber-800 border border-amber-200">
                  🥉
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-xs font-bold text-ink/60 border border-line">
                  {rank}
                </span>
              );

              return (
                <div
                  key={m.id}
                  className={\`flex items-start justify-between rounded-2xl border p-4 shadow-xs transition \${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }\`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">{rankBadge}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mincho text-sm font-bold text-ink">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-ink text-paper px-1.5 py-0.2 font-maru text-[10px] font-bold">
                            あなた
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {wbName && <span className="font-maru text-[10px] text-ink/40">{wbName}</span>}
                        {accuracy !== null && (
                          <span className="font-maru text-[10px] text-ink/50">正答率 {accuracy}%</span>
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
                    <span className="font-maru text-[10px] font-medium text-ink/50 block">獲得スコア</span>
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="font-mincho text-2xl font-bold tracking-tight text-ink">
                        {score}
                      </span>
                      <span className="font-maru text-xs font-bold text-ink/60">点</span>
                    </div>
                    {scoreEntry?.word_count && (
                      <span className="font-maru text-[10px] text-ink/40 block mt-0.5">
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
          <h2 className="font-mincho text-xs font-bold text-ink/50 px-1">
            未受験メンバー ({notDoneMembers.length}人)
          </h2>
          <div className="space-y-2">
            {notDoneMembers.map((m) => {
              const isMe = m.id === user.id;
              const wbName = (m.wordbooks as { name?: string } | null)?.name;
              return (
                <div
                  key={m.id}
                  className={\`flex items-center justify-between rounded-2xl border p-3.5 transition \${
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
                        <span className="font-mincho text-sm font-bold text-ink/80">{m.name}</span>
                        {isMe && (
                          <span className="rounded-full bg-akashiito/10 px-1.5 py-0.2 font-maru text-[10px] font-bold text-akashiito">
                            あなた
                          </span>
                        )}
                      </div>
                      {wbName && <span className="font-maru text-[10px] text-ink/40">{wbName}</span>}
                    </div>
                  </div>
                  <span className="rounded-full bg-stone-100 border border-line px-2.5 py-0.5 font-maru text-xs font-medium text-stone-500">
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

writeFile('app/(main)/group/page.tsx', groupPage);

// -----------------------------------------------------------------------------
// 4. components/group/GroupMembersList.tsx (人数表記の統一)
// -----------------------------------------------------------------------------
const groupMembersListTsx = `'use client';

import React from 'react';
import { Card } from '@/components/common/Card';
import { Users, User, Copy } from 'lucide-react';
import type { GroupMember } from '@/types';

interface GroupMembersListProps {
  groupName: string;
  inviteCode: string;
  members: GroupMember[];
  currentUserId: string;
}

export const GroupMembersList: React.FC<GroupMembersListProps> = ({
  groupName,
  inviteCode,
  members,
  currentUserId,
}) => {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            参加中グループ
          </span>
          <h2 className="font-mincho text-lg font-bold text-ink">
            {groupName}
          </h2>
        </div>
        {/* 固定上限「/ 4人」を廃し実人数表記に統一 */}
        <div className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 border border-line">
          <Users className="h-3.5 w-3.5 text-ink-muted" />
          <span className="font-number text-xs font-bold text-ink">
            {members.length}人参加中
          </span>
        </div>
      </div>

      {/* 招待コード表示エリア */}
      <div className="flex items-center justify-between rounded-lg bg-highlighter/15 p-3 border border-highlighter/40">
        <div>
          <span className="block text-[10px] font-bold text-ink-muted uppercase">
            招待コード (仲間を招待)
          </span>
          <span className="font-number text-lg font-bold tracking-widest text-ink">
            {inviteCode}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteCode);
            alert('招待コードをコピーしました！');
          }}
          className="inline-flex items-center gap-1 rounded-md bg-paper-card px-2.5 py-1.5 text-xs font-semibold text-ink border border-line shadow-sm hover:bg-paper-hover active:scale-95 transition-all cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5 text-ink-muted" />
          コピー
        </button>
      </div>

      {/* メンバー一覧 */}
      <div>
        <span className="text-xs font-semibold text-ink-muted mb-2 block">
          メンバー一覧
        </span>
        <ul className="space-y-2">
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            return (
              <li
                key={member.id}
                className={\`flex items-center justify-between rounded-lg p-2.5 border transition-all \${
                  isMe
                    ? 'bg-akashiito-subtle/50 border-akashiito-border'
                    : 'bg-paper/50 border-line/60'
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={\`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold \${
                      isMe
                        ? 'bg-akashiito text-white'
                        : 'bg-line text-ink-muted'
                    }\`}
                  >
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-ink">
                      {member.name}
                    </span>
                    {isMe && (
                      <span className="ml-1.5 text-[10px] font-bold text-akashiito">
                        (あなた)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded px-2 py-0.5 text-[11px] bg-paper-card border border-line text-ink-muted font-medium">
                    {member.wordbooks?.name || '単語帳未設定'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
};
`;

writeFile('components/group/GroupMembersList.tsx', groupMembersListTsx);

// -----------------------------------------------------------------------------
// 5. app/(auth)/signup/page.tsx (人数固定文言の修正)
// -----------------------------------------------------------------------------
const signupPageTsx = `import React from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">新しい仲間と始める</h1>
        <p className="mt-2 text-xs text-ink-muted">グループで合格までの暗記を習慣化</p>
      </div>
      <SignupForm />
    </main>
  );
}
`;

writeFile('app/(auth)/signup/page.tsx', signupPageTsx);

// -----------------------------------------------------------------------------
// 6. components/group/CreateGroupForm.tsx (プレースホルダーの修正)
// -----------------------------------------------------------------------------
const createGroupFormTsx = `'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const CreateGroupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループ作成に失敗しました");
        return;
      }

      router.push("/select-wordbook");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-mincho text-base font-bold text-ink mb-3">新しいグループを作る</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input placeholder="例: 東大志望グループ" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          グループを作成して招待コードを発行
        </Button>
      </form>
    </Card>
  );
};
`;

writeFile('components/group/CreateGroupForm.tsx', createGroupFormTsx);

console.log('\n================================================================');
console.log('✅ フェーズD-1: 全ファイルの更新・生成が正常に完了しました！');
console.log('================================================================\n');