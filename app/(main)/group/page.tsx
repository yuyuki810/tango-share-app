export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST, getThisWeekSaturdayJST, getWeekDates } from '@/lib/assignment/weekDates';
import { Users, User, Trophy, Shuffle, Calendar, Award } from 'lucide-react';
import {
  determineArchetype,
  type DailyScoreEntryData,
  type ArchetypeResult,
} from '@/lib/scoring/determineArchetype';
import { computeWeeklyRanking } from '@/lib/scoring/computeWeeklyRanking';
import { ArchetypeBadge } from '@/components/group/ArchetypeBadge';
import { CopyButton } from '@/components/common/CopyButton';
import { LeaveGroupDialog } from '@/components/group/LeaveGroupDialog';
import { CreateGroupForm } from '@/components/group/CreateGroupForm';
import { JoinGroupForm } from '@/components/group/JoinGroupForm';
import { NudgeButton } from '@/components/group/NudgeButton';
import { NudgeBanner } from '@/components/group/NudgeBanner';

interface ScoreEntryWithBonus extends DailyScoreEntryData {
  random_bonus_applied?: boolean;
}

interface GroupPageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function GroupPage({ searchParams }: GroupPageProps) {
  const params = await searchParams;
  const currentTab = params.tab === 'weekly' ? 'weekly' : 'daily';

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
      <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="inline-block rounded-full bg-amber-100/70 border border-amber-300/80 px-3 py-1 font-maru text-[10px] font-bold text-amber-900 mb-1">
            仲間と切磋琢磨
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">グループに参加しよう</h1>
          <p className="font-maru text-xs text-ink/60">
            仲間と一緒に毎日の単語テストスコアを共有・競争しましょう
          </p>
        </div>

        <div className="space-y-4">
          <CreateGroupForm />
          <div className="relative flex items-center justify-center py-2">
            <div className="w-full border-t border-line/60" />
            <span className="absolute bg-paper px-3 font-maru text-xs font-semibold text-ink/40">または</span>
          </div>
          <JoinGroupForm />
        </div>
      </main>
    );
  }

  const today = getTodayJST();
  const weekStartDate = getThisWeekSaturdayJST();
  const weekDates = getWeekDates(weekStartDate);

  const [groupRes, membersRes] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', me.group_id).single(),
    supabase.from('users').select('id, name, wordbook_id, wordbooks(name)').eq('group_id', me.group_id),
  ]);

  const group = groupRes.data;
  const memberList = membersRes.data ?? [];
  const memberIds = memberList.map((m) => m.id);

  const [
    todaySessionsRes,
    scoreRowsRes,
    streaksRes,
    recentScoresRes,
    weekScoresRes,
    sentNudgesRes,
    receivedNudgesRes,
  ] = await Promise.all([
    supabase
      .from('test_sessions')
      .select('user_id')
      .eq('type', 'daily_check')
      .eq('date', today)
      .not('completed_at', 'is', null)
      .in('user_id', memberIds),
    supabase
      .from('daily_score_entries')
      .select('user_id, date, raw_score, normalized_score, word_count, accuracy_rate, avg_difficulty_weight, avg_diminishing_factor, random_bonus_applied')
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
    supabase
      .from('daily_score_entries')
      .select('user_id, date, normalized_score, raw_score, accuracy_rate, word_count')
      .in('user_id', memberIds)
      .in('date', weekDates),
    supabase
      .from('daily_nudges')
      .select('target_id')
      .eq('sender_id', user.id)
      .eq('date', today),
    supabase
      .from('daily_nudges')
      .select('sender_id')
      .eq('target_id', user.id)
      .eq('date', today),
  ]);

  const doneUserIds = new Set((todaySessionsRes.data ?? []).map((s) => s.user_id));
  const allGroupEntries = (scoreRowsRes.data ?? []) as ScoreEntryWithBonus[];
  const scoreMap = new Map(allGroupEntries.map((s) => [s.user_id, s]));
  const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.user_id, s.current_streak ?? 0]));

  const recentScoresByUser = new Map<string, number[]>();
  (recentScoresRes.data ?? []).forEach((r) => {
    const list = recentScoresByUser.get(r.user_id) ?? [];
    if (list.length < 5) {
      list.push(r.normalized_score ?? 0);
      recentScoresByUser.set(r.user_id, list);
    }
  });

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

  const archetypeMap = new Map<string, ArchetypeResult | null>();
  for (const m of doneMembers) {
    const arch = determineArchetype(
      m.id,
      allGroupEntries,
      recentScoresByUser.get(m.id) ?? []
    );
    archetypeMap.set(m.id, arch);
  }

  // 週間ランキング集計
  const weeklyRanking = computeWeeklyRanking({
    members: memberList,
    weekDates,
    scoreEntries: (weekScoresRes.data ?? []) as any,
  });

  // 催促(応援)関連データ
  const sentNudgeTargetIds = new Set((sentNudgesRes.data ?? []).map((n) => n.target_id));
  const receivedSenderIds = (receivedNudgesRes.data ?? []).map((n: any) => n.sender_id);
  let receivedSenderNames: string[] = [];
  if (receivedSenderIds.length > 0) {
    const { data: senderUsers } = await supabase
      .from('users')
      .select('name')
      .in('id', receivedSenderIds);
    receivedSenderNames = (senderUsers ?? []).map((u) => u.name).filter(Boolean);
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-5 px-4 sm:px-0 pb-28 pt-6">
      {/* 応援バナー (自分宛てに届いている場合) */}
      <NudgeBanner senderNames={receivedSenderNames} />

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-maru text-[10px] md:text-xs font-bold uppercase tracking-wider text-ink/50">
            GROUP RANKING
          </span>
          <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">{group?.name || 'グループ'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs md:text-sm font-bold text-ink">
          <Users className="h-3.5 w-3.5 text-ink/60" />
          <span>{totalCount}人参加中</span>
        </div>
      </div>

      {/* 招待コード確認エリア */}
      <div className="flex items-center justify-between rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 shadow-2xs">
        <div>
          <span className="block font-maru text-[10px] font-bold text-amber-900/60 uppercase">
            グループ招待コード (仲間を招待)
          </span>
          <span className="font-mono text-base md:text-lg font-bold tracking-widest text-ink">
            {group?.invite_code || '------'}
          </span>
        </div>
        <CopyButton text={group?.invite_code || ''} />
      </div>

      {/* 「今日」 / 「今週」 切替セグメントタブ */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-paper/80 border border-line p-1.5 shadow-2xs">
        <Link
          href="/group?tab=daily"
          prefetch={true}
          className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl font-mincho text-xs md:text-sm font-bold transition ${
            currentTab === 'daily'
              ? 'bg-ink text-paper shadow-sm'
              : 'text-ink/60 hover:text-ink hover:bg-white/50'
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span>今日 (デイリー)</span>
        </Link>

        <Link
          href="/group?tab=weekly"
          prefetch={true}
          className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl font-mincho text-xs md:text-sm font-bold transition ${
            currentTab === 'weekly'
              ? 'bg-ink text-paper shadow-sm'
              : 'text-ink/60 hover:text-ink hover:bg-white/50'
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>今週 (週間ランキング)</span>
        </Link>
      </div>

      {/* ========================================================
          1. デイリーランキング表示
          ======================================================== */}
      {currentTab === 'daily' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* 今日の進捗サマリー */}
          <div className="rounded-3xl border border-line bg-white p-5 md:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                <span className="font-mincho text-sm md:text-base font-bold text-ink">本日のデイリー進捗</span>
              </div>
              <span className="font-maru text-xs md:text-sm font-bold text-ink">
                {doneCount} / {totalCount} 人 受験済み
              </span>
            </div>
            <div className="h-2 md:h-2.5 w-full overflow-hidden rounded-full bg-line/40">
              <div
                className="h-full rounded-full bg-ink transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
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
                prefetch={true}
                className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#E24B4A] font-mincho text-sm md:text-base font-bold text-white shadow-md shadow-[#E24B4A]/25 transition active:scale-98 hover:opacity-95"
              >
                今日の本番チェックを受ける
              </Link>
            )}
          </div>

          {/* 今日のランキング一覧 */}
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
                  const hasBonus = !!scoreEntry?.random_bonus_applied;

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
                      className={`flex items-start justify-between rounded-2xl border p-4 md:p-5 shadow-xs transition ${
                        isFirst
                          ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                          : isMe
                          ? 'border-line bg-akashiito/5'
                          : 'border-line bg-white'
                      }`}
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
                            {hasBonus && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-300 px-1.5 py-0.2 font-maru text-[9px] font-bold text-amber-900">
                                <Shuffle className="h-2.5 w-2.5 text-amber-700" />
                                <span>+5</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                            {accuracy !== null && (
                              <span className="font-maru text-[10px] md:text-xs text-ink/50">正答率 {accuracy}%</span>
                            )}
                          </div>

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

          {/* 未受験メンバー一覧 & 応援するボタン */}
          {notDoneMembers.length > 0 && (
            <section className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/50">
                  未受験メンバー ({notDoneMembers.length}人)
                </h2>
                {isMeDone && (
                  <span className="font-maru text-[10px] text-ink/40">
                    ボタンを押して仲間を応援できます
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {notDoneMembers.map((m) => {
                  const isMe = m.id === user.id;
                  const wbName = (m.wordbooks as { name?: string } | null)?.name;
                  const isAlreadyNudged = sentNudgeTargetIds.has(m.id);

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between rounded-2xl border p-3.5 md:p-4 transition ${
                        isMe
                          ? 'border-[#EF9F27] bg-[#FEF3E2]'
                          : 'border-dashed border-line bg-white/60 text-ink/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mincho text-sm md:text-base font-bold text-ink/80">{m.name}</span>
                            {isMe && (
                              <span className="rounded-full bg-[#EF9F27] text-white px-1.5 py-0.2 font-maru text-[10px] md:text-xs font-bold">
                                あなた
                              </span>
                            )}
                          </div>
                          {wbName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{wbName}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isMe && (
                          <NudgeButton
                            targetUserId={m.id}
                            isAlreadyNudged={isAlreadyNudged}
                            canNudge={isMeDone}
                          />
                        )}
                        <span className="rounded-full bg-[#FEF3E2] text-[#9A5B00] border border-[#EF9F27] px-2.5 py-0.5 font-maru text-xs md:text-sm font-bold">
                          未受験
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ========================================================
          2. 週間ランキング表示 (新規)
          ======================================================== */}
      {currentTab === 'weekly' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* 週間ランキングサマリー説明 */}
          <div className="rounded-3xl border border-line bg-white p-5 md:p-6 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-ink/60" />
                <h2 className="font-mincho text-sm md:text-base font-bold text-ink">今週の総合ランキング</h2>
              </div>
              <span className="font-maru text-xs text-ink/50">土〜金 (7日間集計)</span>
            </div>
            <p className="font-maru text-xs text-ink/60 leading-relaxed">
              今週7日間のスコア平均（未受験の日は0点扱い）で順位付けされます。毎日の継続がそのまま順位に直結します。
            </p>
          </div>

          {/* 週間ランキング一覧 */}
          <section className="space-y-2.5">
            {weeklyRanking.map((m, index) => {
              const isMe = m.userId === user.id;
              const rank = index + 1;
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
                  key={m.userId}
                  className={`flex items-start justify-between rounded-2xl border p-4 md:p-5 shadow-xs transition ${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }`}
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
                        {m.wordbookName && <span className="font-maru text-[10px] md:text-xs text-ink/40">{m.wordbookName}</span>}
                        {m.avgAccuracyRate !== null && (
                          <span className="font-maru text-[10px] md:text-xs text-ink/50">平均正答率 {m.avgAccuracyRate}%</span>
                        )}
                      </div>

                      {/* 7日間の達成状況インジケータ */}
                      <div className="flex items-center gap-1 mt-2">
                        <span className="font-maru text-[9px] text-ink/40 mr-0.5">進捗:</span>
                        {m.dailyScores.map((ds, dIdx) => (
                          <span
                            key={ds.date}
                            className={`h-2 w-3.5 rounded-xs inline-block ${
                              ds.attended
                                ? 'bg-emerald-600 shadow-2xs'
                                : 'bg-line/40'
                            }`}
                            title={`${ds.date}: ${ds.attended ? `${ds.score}点` : '未受験(0点)'}`}
                          />
                        ))}
                        <span className="font-maru text-[10px] font-bold text-ink/60 ml-1">
                          {m.daysAttended}/7日
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-maru text-[10px] md:text-xs font-medium text-ink/50 block">週間平均</span>
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="font-mincho text-2xl md:text-3xl font-bold tracking-tight text-ink">
                        {m.weeklyScore}
                      </span>
                      <span className="font-maru text-xs md:text-sm font-bold text-ink/60">点</span>
                    </div>
                    <span className="font-maru text-[9px] text-ink/40 block mt-0.5">
                      raw計 {m.totalRawScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* グループ脱退ダイアログ */}
      <div className="pt-4 border-t border-line/40 flex justify-center">
        <LeaveGroupDialog />
      </div>
    </main>
  );
}
