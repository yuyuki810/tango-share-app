/**
 * setup_phase_d2.js
 * フェーズD-2: スコア・アーキタイプ演出とUI細部修正 一括セットアップスクリプト
 * 
 * 実行方法:
 *   node setup_phase_d2.js
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
console.log('フェーズD-2: スコア・アーキタイプ演出とUI細部修正のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. lib/scoring/determineArchetype.ts (アーキタイプ判定ロジック)
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
 * メンバーのスコア系アーキタイプを判定する (優先順位順に評価)
 * 1. ゾンビ・グリット型 (物量突破)
 * 2. レジェンド・コレクター型 (高難度制覇)
 * 3. パーフェクト・スナイパー型 (精密無比)
 * 4. タイブレーク・チャンピオン型 (僅差の覇者)
 * 5. 急成長型 (自己ベスト更新)
 */
export async function determineArchetype(
  supabase: SupabaseClient,
  targetUserId: string,
  date: string,
  allGroupEntriesForDate: DailyScoreEntryData[]
): Promise<ArchetypeResult | null> {
  const self = allGroupEntriesForDate.find((e) => e.user_id === targetUserId);
  if (!self) return null;

  // 1. ゾンビ・グリット型 (物量突破)
  // normalized_score >= 85 かつ accuracy_rate < 0.65
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
  // accuracy_rate >= 0.9 かつ avg_difficulty_weight >= 1.2 かつ word_count >= 15
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
  // accuracy_rate >= 0.95 かつ normalized_score < 55 かつ word_count >= 5
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
  // 同日・同groupで normalized_score が同点の他メンバーが存在し、そのメンバー達の raw_score の最大値より自分の raw_score が厳密に大きい
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
  // 対象日より前の直近5件の daily_score_entries の normalized_score 平均と比べ、今日が +20 以上 (直近データ3件以上の場合のみ判定)
  const { data: recentScores } = await supabase
    .from('daily_score_entries')
    .select('normalized_score')
    .eq('user_id', targetUserId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(5);

  if (recentScores && recentScores.length >= 3) {
    const sum = recentScores.reduce((acc, r) => acc + (r.normalized_score ?? 0), 0);
    const avg = sum / recentScores.length;
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
// 2. components/group/ArchetypeBadge.tsx (アーキタイプバッジ & 詳細ポップアップ)
// -----------------------------------------------------------------------------
const archetypeBadgeTsx = `'use client';

import React, { useState } from 'react';
import { Info, X, Flame } from 'lucide-react';
import type { ArchetypeResult } from '@/lib/scoring/determineArchetype';

interface ArchetypeBadgeProps {
  archetype: ArchetypeResult | null;
  attendanceStreak: number | null;
}

export function ArchetypeBadge({ archetype, attendanceStreak }: ArchetypeBadgeProps) {
  const [activeModal, setActiveModal] = useState<{
    title: string;
    description: string;
    subtitle?: string;
  } | null>(null);

  const showAttendance =
    attendanceStreak !== null && attendanceStreak > 0 && attendanceStreak % 7 === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {/* 1. スコア系アーキタイプバッジ */}
        {archetype ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: archetype.title,
                subtitle: archetype.badgeLabel,
                description: archetype.message,
              });
            }}
            className={\`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-maru text-[10px] font-bold transition active:scale-95 cursor-pointer shadow-2xs hover:opacity-90 \${archetype.colorClass}\`}
          >
            <span>{archetype.badgeLabel}</span>
            <span className="text-[9px] opacity-70">?</span>
          </button>
        ) : (
          /* 2. フォールバック表示 (アーキタイプ非該当時は ⓘ アイコン) */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: '獲得スコアについて',
                description:
                  'スコアは正答率とは少し違う指標です。まだ自信のない単語に正解するほど配点が高く、よく知っている単語は配点が低くなります。解いた数が多いほど積み上がりますが、1日20問を超えると増分はゆるやかになります。',
              });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/80 px-2 py-0.5 font-maru text-[10px] font-medium text-ink/60 transition active:scale-95 cursor-pointer hover:bg-paper hover:text-ink"
            aria-label="スコアの仕組みを見る"
          >
            <Info className="h-3 w-3 text-ink/40" />
            <span>スコアの仕組み</span>
          </button>
        )}

        {/* 3. 皆勤賞バッジ (スコア系とは独立) */}
        {showAttendance && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal({
                title: \`\${attendanceStreak}日連続 皆勤賞\`,
                subtitle: 'DAILY ATTENDANCE',
                description: \`\${attendanceStreak}日連続で本番チェックを継続中！日々の積み重ねが確実に力になっています。\`,
              });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-maru text-[10px] font-bold text-amber-900 shadow-2xs transition active:scale-95 cursor-pointer hover:opacity-90"
          >
            <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span>{attendanceStreak}日皆勤</span>
          </button>
        )}
      </div>

      {/* ポップアップモーダル */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-line bg-white p-5 shadow-xl animate-in zoom-in-95 duration-150 space-y-3 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                {activeModal.subtitle && (
                  <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50 block">
                    {activeModal.subtitle}
                  </span>
                )}
                <h3 className="font-mincho text-base font-bold text-ink">
                  {activeModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/80 leading-relaxed bg-paper/60 p-3.5 rounded-2xl border border-line/60">
              {activeModal.description}
            </p>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="flex min-h-[42px] w-full items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
`;

writeFile('components/group/ArchetypeBadge.tsx', archetypeBadgeTsx);

// -----------------------------------------------------------------------------
// 3. app/(main)/group/page.tsx (アーキタイプ判定 & 表示組み込み)
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-maru text-[10px] font-bold uppercase tracking-wider text-ink/50">
            GROUP DAILY RANKING
          </span>
          <h1 className="font-mincho text-2xl font-bold text-ink">{group?.name || 'グループ'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-maru text-xs font-bold text-ink">
          <Users className="h-3.5 w-3.5 text-ink/60" />
          <span>{totalCount} / 4人</span>
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
// 4. app/(main)/dashboard/page.tsx (ストリークバッジ色分離 & タップ領域拡大)
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

  // 本日の daily_check 受験状況確認
  const { data: todayDailyCheckSession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .eq('type', 'daily_check')
    .maybeSingle();

  const isDailyCheckCompleted = !!todayDailyCheckSession;

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
          {/* ストリークバッジ: CTAの赤とは別系統のゴールド/アンバー色に分離 */}
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
          {/* テキストリンクのタップ領域を44px相当に拡大 */}
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
// 5. components/dashboard/StreakBadge.tsx (色分離)
// -----------------------------------------------------------------------------
const streakBadgeTsx = `interface StreakBadgeProps {
  currentStreak: number;
}

export function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900 shadow-2xs">
      <span className="text-sm">🔥</span>
      <span>{currentStreak}日連続達成中</span>
    </span>
  );
}
`;

writeFile('components/dashboard/StreakBadge.tsx', streakBadgeTsx);

// -----------------------------------------------------------------------------
// 6. components/dashboard/SetRangeCTA.tsx (タップ領域拡大)
// -----------------------------------------------------------------------------
const setRangeCtaTsx = `'use client';

import { useState } from 'react';
import { WeeklyRangeModal } from '@/components/weekly-range/WeeklyRangeModal';
import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';
import type { LastWeekData } from '@/components/weekly-range/CycleSettingsPanel';

interface SetRangeCTAProps {
  wordbookId: string;
  wordbookTotalWords: number;
  weekStartDate: string;
  hasExistingRange: boolean;
  initialCycleType?: CycleType;
  initialCustomDayTypes?: DayType[];
  initialRangeStart?: number;
  initialPerDayCount?: number;
  lastWeek?: LastWeekData;
}

export function SetRangeCTA({
  wordbookId,
  wordbookTotalWords,
  weekStartDate,
  hasExistingRange,
  initialCycleType,
  initialCustomDayTypes,
  initialRangeStart,
  initialPerDayCount,
  lastWeek,
}: SetRangeCTAProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {hasExistingRange ? (
        <div className="flex items-center justify-between px-1">
          <span className="font-maru text-xs font-medium text-ink/60">今週の学習サイクル (土〜金)</span>
          {/* タップ領域を min-h-[44px] で確保 */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex min-h-[44px] items-center px-2 text-xs font-bold text-ink/80 underline decoration-line underline-offset-4 transition hover:text-ink active:opacity-70 cursor-pointer"
          >
            範囲・ペースを変更する
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full min-h-[56px] rounded-3xl bg-akashiito px-5 py-4 text-center font-mincho text-base font-bold text-paper shadow-lg shadow-akashiito/20 transition active:scale-98"
        >
          今週の学習範囲を設定しよう（土〜金）
        </button>
      )}

      <WeeklyRangeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        wordbookId={wordbookId}
        wordbookTotalWords={wordbookTotalWords}
        weekStartDate={weekStartDate}
        initialCycleType={initialCycleType}
        initialCustomDayTypes={initialCustomDayTypes}
        initialRangeStart={initialRangeStart}
        initialPerDayCount={initialPerDayCount}
        lastWeek={lastWeek}
      />
    </>
  );
}
`;

writeFile('components/dashboard/SetRangeCTA.tsx', setRangeCtaTsx);

// -----------------------------------------------------------------------------
// 7. components/dashboard/TodayRangeCard.tsx (練習リンクのタップ領域拡大)
// -----------------------------------------------------------------------------
const todayRangeCardTsx = `'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

interface TodayRangeCardProps {
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  wordbookName: string;
  isDailyCheckCompleted?: boolean;
}

export function TodayRangeCard({
  rangeStart,
  rangeEnd,
  isReviewDay,
  wordbookName,
  isDailyCheckCompleted = false,
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
                  : 'bg-akashiito/10 text-akashiito border-akashiito-border'
              }\`}
            >
              本番チェック: {isDailyCheckCompleted ? '済' : '未'}
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
                className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98 hover:opacity-95"
              >
                今日の本番チェックを受ける
              </Link>
              {/* タップ領域を 44px 相当の快適なチップ化 */}
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
// 8. components/weakness/WeaknessChunkTile.tsx (二重の赤ドットを削除)
// -----------------------------------------------------------------------------
const weaknessChunkTileTsx = `'use client';

import React from 'react';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessChunkTileProps {
  chunk: ChunkStat;
  onClick: (chunk: ChunkStat) => void;
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

export const WeaknessChunkTile: React.FC<WeaknessChunkTileProps> = ({ chunk, onClick }) => {
  const hasAttempts = chunk.totalAttempts > 0;
  const mistakePct = Math.round(chunk.mistakeRate * 100);

  let styleClass = 'border-line bg-paper text-ink';
  let badgeText = '良好';
  let badgeStyle = 'bg-line/30 text-ink/70 border-line/60';

  if (!hasAttempts) {
    styleClass = 'border-line/60 bg-white text-ink/40';
    badgeText = '未実施';
    badgeStyle = 'bg-line/20 text-ink/40 border-line/40';
  } else if (chunk.mistakeRate >= 0.4) {
    styleClass = 'border-akashiito-border bg-akashiito/15 text-ink shadow-xs';
    badgeText = '要注意';
    badgeStyle = 'bg-akashiito/20 text-akashiito border-akashiito/30 font-bold';
  } else if (chunk.mistakeRate >= 0.15) {
    styleClass = 'border-highlighter/60 bg-highlighter/20 text-ink';
    badgeText = 'やや注意';
    badgeStyle = 'bg-highlighter/40 text-ink border-highlighter/60 font-semibold';
  }

  return (
    <button
      type="button"
      onClick={() => onClick(chunk)}
      className={\`relative flex min-h-[120px] min-w-[130px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] hover:shadow-xs cursor-pointer \${styleClass}\`}
    >
      {/* ※ 右上の重複した赤ドットは削除し、「要注意」バッジに一本化 */}

      <div>
        <div className="flex items-center justify-between">
          <span className="font-maru text-[11px] font-bold text-ink/60">
            {formatDateLabel(chunk.originDate)}
          </span>
          <span className={\`rounded-full border px-1.5 py-0.5 text-[9px] \${badgeStyle}\`}>
            {badgeText}
          </span>
        </div>
        <p className="mt-1.5 font-mincho text-sm font-bold tracking-tight text-ink">
          No.{chunk.rangeStart}〜{chunk.rangeEnd}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-line/40 pt-2">
        <div>
          <span className="block font-maru text-[10px] text-ink/50">ミス率</span>
          <span className="font-mincho text-lg font-bold text-ink">
            {hasAttempts ? \`\${mistakePct}%\` : '—'}
          </span>
        </div>
        <span className="font-maru text-[10px] text-ink/50">
          {hasAttempts ? \`\${chunk.history.length}回テスト\` : '未受検'}
        </span>
      </div>
    </button>
  );
};
`;

writeFile('components/weakness/WeaknessChunkTile.tsx', weaknessChunkTileTsx);

// -----------------------------------------------------------------------------
// 9. components/weakness/WeaknessBottomSheet.tsx (同日複数テストのx軸ラベル重複解消)
// -----------------------------------------------------------------------------
const weaknessBottomSheetTsx = `'use client';

import React, { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import type { ChunkStat } from '@/lib/weakness/computeChunkStats';

interface WeaknessBottomSheetProps {
  chunk: ChunkStat | null;
  onClose: () => void;
}

const DRAG_CLOSE_THRESHOLD = 80;

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return \`\${m}/\${d}\`;
}

export function WeaknessBottomSheet({ chunk, onClose }: WeaknessBottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  const handlePointerDown = (e: ReactPointerEvent) => {
    dragStartY.current = e.clientY;
  };
  const handlePointerMove = (e: ReactPointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const handlePointerUp = () => {
    if (dragY > DRAG_CLOSE_THRESHOLD) {
      onClose();
    }
    setDragY(0);
    dragStartY.current = null;
  };

  if (!chunk) return null;

  const hasAttempts = chunk.history.length > 0;
  const mistakePct = Math.round(chunk.mistakeRate * 100);

  // 折れ線グラフ用座標計算
  const chartWidth = 320;
  const chartHeight = 70;
  const paddingX = 40;
  const paddingY = 16;

  // 同一日付の複数テストを「9/1(1)」「9/1(2)」のように識別
  const dateCounts = new Map<string, number>();
  chunk.history.forEach((h) => {
    dateCounts.set(h.testDate, (dateCounts.get(h.testDate) ?? 0) + 1);
  });

  const dateOccurrences = new Map<string, number>();
  const historyPoints = chunk.history.map((h, i) => {
    const x =
      chunk.history.length === 1
        ? chartWidth / 2
        : paddingX + (i / (chunk.history.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - h.mistakeRate * (chartHeight - paddingY * 2);

    const baseDate = formatDateLabel(h.testDate);
    const totalOnDate = dateCounts.get(h.testDate) ?? 1;
    let label = baseDate;
    if (totalOnDate > 1) {
      const currentOccur = (dateOccurrences.get(h.testDate) ?? 0) + 1;
      dateOccurrences.set(h.testDate, currentOccur);
      label = \`\${baseDate}(\${currentOccur})\`;
    }

    return {
      x,
      y,
      rate: Math.round(h.mistakeRate * 100),
      date: label,
    };
  });

  const pathD =
    historyPoints.length > 1
      ? historyPoints.reduce(
          (acc, p, idx) => \`\${acc} \${idx === 0 ? 'M' : 'L'} \${p.x} \${p.y}\`,
          ''
        )
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: \`translateY(\${dragY}px)\` }}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper shadow-2xl transition-transform duration-200 motion-reduce:transition-none"
      >
        {/* ドラッグハンドル & ヘッダー */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="sticky top-0 z-10 flex touch-none flex-col items-center bg-paper/95 px-4 pb-2 pt-3 backdrop-blur-xs border-b border-line/40"
        >
          <div className="h-1.5 w-12 rounded-full bg-line" />
          <div className="mt-2 flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-mincho text-lg font-bold text-ink">
                No.{chunk.rangeStart}〜{chunk.rangeEnd}
              </h2>
              <span className="font-maru text-xs text-ink/50">
                ({formatDateLabel(chunk.originDate)} 学習)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="flex min-h-[40px] min-w-[40px] items-center justify-center font-bold text-ink/40 hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4 pb-6">
          {/* サマリー統計 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs">
              <span className="block font-maru text-[11px] text-ink/50">現在のミス率</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mincho text-2xl font-bold text-ink">
                  {hasAttempts ? \`\${mistakePct}%\` : '—'}
                </span>
                {chunk.needsAttention && (
                  <span className="rounded-full bg-akashiito/15 px-2 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                    要注意
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs">
              <span className="block font-maru text-[11px] text-ink/50">テスト回数</span>
              <p className="mt-1 font-mincho text-2xl font-bold text-ink">
                {chunk.history.length}{' '}
                <span className="font-maru text-xs font-normal text-ink/50">回</span>
              </p>
            </div>
          </div>

          {/* ミニ折れ線グラフ */}
          <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mincho text-xs font-bold text-ink/70">ミス率の推移</span>
              <span className="font-maru text-[10px] text-ink/40">古い順 → 最新</span>
            </div>

            {chunk.history.length === 0 ? (
              <p className="py-4 text-center font-maru text-xs text-ink/40">
                まだテスト履歴がありません
              </p>
            ) : (
              <div className="py-1">
                <svg viewBox={\`0 0 \${chartWidth} \${chartHeight}\`} className="h-20 w-full overflow-visible">
                  <line
                    x1={paddingX}
                    y1={chartHeight - paddingY}
                    x2={chartWidth - paddingX}
                    y2={chartHeight - paddingY}
                    stroke="#EBE8DF"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />
                  <line
                    x1={paddingX}
                    y1={chartHeight / 2}
                    x2={chartWidth - paddingX}
                    y2={chartHeight / 2}
                    stroke="#EBE8DF"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />

                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#232A3B"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {historyPoints.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#232A3B" stroke="#FFFFFF" strokeWidth="2" />
                      <text x={p.x} y={p.y - 7} textAnchor="middle" className="fill-ink text-[10px] font-bold font-number">
                        {p.rate}%
                      </text>
                      <text x={p.x} y={chartHeight + 1} textAnchor="middle" className="fill-ink/40 text-[9px] font-maru">
                        {p.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* 間違えた単語一覧 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="font-mincho text-xs font-bold text-ink/70">
                間違えた単語 ({chunk.mistakeWords.length}語)
              </span>
            </div>

            {chunk.mistakeWords.length === 0 ? (
              <div className="rounded-2xl border border-line/60 bg-white p-4 text-center">
                <p className="font-mincho text-sm font-bold text-ink/70">間違えた単語はありません 🎉</p>
                <p className="mt-1 font-maru text-xs text-ink/40">この範囲はしっかり定着しています</p>
              </div>
            ) : (
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-0.5">
                {chunk.mistakeWords.map((w) => (
                  <div
                    key={w.wordId}
                    className="flex items-center justify-between rounded-xl border border-line bg-white p-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mincho text-base font-bold text-ink">{w.headword}</span>
                        {w.pronunciation && (
                          <span className="font-maru text-xs text-ink/40">{w.pronunciation}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-maru text-xs text-ink/70">{w.meaning}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-akashiito-border bg-akashiito/10 px-2 py-0.5 font-maru text-[10px] font-bold text-akashiito">
                      {w.wrongCount}回ミス
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 下部アクションボタン */}
        <div className="sticky bottom-0 border-t border-line/80 bg-paper/95 p-4 backdrop-blur-xs">
          <Link
            href={\`/test?mode=normal&originAssignmentId=\${chunk.chunkId}\`}
            className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
          >
            この範囲だけミニテストを行う
          </Link>
        </div>
      </div>
    </div>
  );
}
`;

writeFile('components/weakness/WeaknessBottomSheet.tsx', weaknessBottomSheetTsx);

console.log('\n================================================================');
console.log('✅ フェーズD-2: 全ファイルの更新・生成が正常に完了しました！');
console.log('================================================================\n');