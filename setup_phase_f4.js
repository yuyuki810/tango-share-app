/**
 * setup_phase_f4.js
 * フェーズF-4: グループ管理機能（コード再表示・脱退・再参加）+ 下部バー「弱点マップ」削除
 * 
 * 実行方法:
 *   node setup_phase_f4.js
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
console.log('フェーズF-4: グループ管理機能 & 下部バー調整のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. app/api/groups/route.ts (脱退 action: "leave" の追加 & 孤立グループ自動削除)
// -----------------------------------------------------------------------------
const groupsRouteTs = `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, name, inviteCode } = body;

    // 1. グループ作成
    if (action === "create") {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "グループ名を入力してください" }, { status: 400 });
      }

      let code = generateInviteCode();
      let insertedGroup = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("groups")
          .insert({ name: name.trim(), invite_code: code })
          .select()
          .single();

        if (!error && data) {
          insertedGroup = data;
          break;
        }
        code = generateInviteCode();
      }

      if (!insertedGroup) {
        return NextResponse.json({ error: "グループ作成に失敗しました" }, { status: 500 });
      }

      await supabase.from("users").update({ group_id: insertedGroup.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group: insertedGroup });
    }

    // 2. 招待コードで参加
    if (action === "join") {
      if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json({ error: "招待コードを入力してください" }, { status: 400 });
      }

      const cleanCode = inviteCode.trim().toUpperCase();
      const { data: group, error: findError } = await supabase
        .from("groups")
        .select("id, name, invite_code")
        .eq("invite_code", cleanCode)
        .single();

      if (findError || !group) {
        return NextResponse.json({ error: "該当する招待コードのグループが見つかりません" }, { status: 404 });
      }

      await supabase.from("users").update({ group_id: group.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group });
    }

    // 3. グループ脱退 (ユーザーの全個人データ・学習履歴は保持)
    if (action === "leave") {
      const { data: me } = await supabase
        .from("users")
        .select("group_id")
        .eq("id", user.id)
        .single();

      if (!me?.group_id) {
        return NextResponse.json({ error: "グループに参加していません" }, { status: 400 });
      }

      const oldGroupId = me.group_id;

      // ユーザーの group_id を null に更新
      const { error: updateError } = await supabase
        .from("users")
        .update({ group_id: null })
        .eq("id", user.id);

      if (updateError) {
        return NextResponse.json({ error: "グループの脱退に失敗しました" }, { status: 500 });
      }

      // 残りメンバー数が0人になった場合は孤立グループを安全に削除
      const { count: remainingMembers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("group_id", oldGroupId);

      if (remainingMembers === 0) {
        await supabase.from("groups").delete().eq("id", oldGroupId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Group API fatal error:", err);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
`;

writeFile('app/api/groups/route.ts', groupsRouteTs);

// -----------------------------------------------------------------------------
// 2. components/common/CopyButton.tsx (ワンタップコピーボタン)
// -----------------------------------------------------------------------------
const copyButtonTsx = `'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  label?: string;
}

export function CopyButton({ text, className = '', label = 'コピー' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={\`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-maru text-xs font-semibold transition active:scale-95 cursor-pointer \${
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-line bg-white text-ink/80 hover:bg-paper hover:text-ink'
      } \${className}\`}
      aria-label="招待コードをコピー"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="h-3.5 w-3.5 text-ink/50" />}
      <span>{copied ? 'コピー完了' : label}</span>
    </button>
  );
}
`;

writeFile('components/common/CopyButton.tsx', copyButtonTsx);

// -----------------------------------------------------------------------------
// 3. components/group/LeaveGroupDialog.tsx (グループ脱退確認モーダル)
// -----------------------------------------------------------------------------
const leaveGroupDialogTsx = `'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, X, AlertTriangle } from 'lucide-react';

export function LeaveGroupDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '脱退処理に失敗しました');
        setIsLoading(false);
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError('通信エラーが発生しました');
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 px-3 font-maru text-xs text-ink/40 hover:text-akashiito transition active:opacity-70 cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>グループを脱退する</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isLoading && setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-line bg-paper p-5 md:p-6 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-akashiito">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-mincho text-base font-bold text-ink">
                  グループから脱退しますか？
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isLoading && setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-paper-hover hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="font-maru text-xs text-ink/70 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-line/60">
              これまでの単語の学習履歴・連続記録・スコアは個人データとして<strong>そのまま保持</strong>されますが、このグループのランキングからは外れます。
            </p>

            {error && <p className="font-maru text-xs text-akashiito">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsOpen(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line bg-white font-maru text-xs font-medium text-ink/70 transition active:scale-98 cursor-pointer hover:bg-white"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleLeave}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-akashiito font-mincho text-xs font-bold text-white shadow-sm transition active:scale-98 cursor-pointer hover:bg-akashiito/90 disabled:opacity-50"
              >
                {isLoading ? '処理中...' : '脱退する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
`;

writeFile('components/group/LeaveGroupDialog.tsx', leaveGroupDialogTsx);

// -----------------------------------------------------------------------------
// 4. app/(main)/group/page.tsx (招待コード再表示 & 脱退 & 未所属時UI)
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
import { CopyButton } from '@/components/common/CopyButton';
import { LeaveGroupDialog } from '@/components/group/LeaveGroupDialog';
import { CreateGroupForm } from '@/components/group/CreateGroupForm';
import { JoinGroupForm } from '@/components/group/JoinGroupForm';

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

  // 未所属の場合は、グループ作成または参加フォームを直接表示
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

  // [並列化 1] グループ情報とメンバー一覧を同時に取得
  const [groupRes, membersRes] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', me.group_id).single(),
    supabase.from('users').select('id, name, wordbook_id, wordbooks(name)').eq('group_id', me.group_id),
  ]);

  const group = groupRes.data;
  const memberList = membersRes.data ?? [];
  const memberIds = memberList.map((m) => m.id);

  // [並列化 2] 本日のセッション、スコア、ストリーク、過去履歴を一括並列取得
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

  // アーキタイプ判定
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
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-28 pt-6">
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

      {/* 招待コード確認 & コピーエリア */}
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
            prefetch={true}
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-sm md:text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98 hover:opacity-95"
          >
            今日の本番チェックを受ける
          </Link>
        )}
      </div>

      {/* ランキング一覧 */}
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

      {/* グループ管理フッター (脱退) */}
      <div className="pt-4 border-t border-line/40 flex justify-center">
        <LeaveGroupDialog />
      </div>
    </main>
  );
}
`;

writeFile('app/(main)/group/page.tsx', groupPageTsx);

// -----------------------------------------------------------------------------
// 5. components/layout/BottomNav.tsx (「弱点マップ」を削除し3項目でバランス調整)
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
    { href: '/settings/wordbook', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto grid grid-cols-3 max-w-md md:max-w-xl lg:max-w-2xl items-center px-4 py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={\`flex min-h-[52px] flex-col items-center justify-center rounded-xl py-1 transition active:scale-95 \${
                isActive ? 'text-akashiito font-bold' : 'text-ink/50 hover:text-ink'
              }\`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="mt-0.5 font-maru text-[11px] md:text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
`;

writeFile('components/layout/BottomNav.tsx', bottomNavTsx);

console.log('\n================================================================');
console.log('✅ フェーズF-4: グループ管理機能 & 下部バー調整が完了しました！');
console.log('================================================================\n');