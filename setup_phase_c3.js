/**
 * setup_phase_c3.js
 * フェーズC-3: スコア計算式の実装とデイリーランキング表示 一括セットアップスクリプト
 * 
 * 実行方法:
 *   node setup_phase_c3.js
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
console.log('フェーズC-3: スコア計算・ランキング機能のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. マイグレーションSQL: daily_score_entries テーブル作成
// -----------------------------------------------------------------------------
const migrationSql = `-- =============================================================================
-- Migration: フェーズC-3 デイリースコア永続化テーブル (daily_score_entries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_score_entries (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  raw_score NUMERIC NOT NULL,
  normalized_score INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  accuracy_rate NUMERIC,
  avg_difficulty_weight NUMERIC,
  avg_diminishing_factor NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- Enable RLS
ALTER TABLE daily_score_entries ENABLE ROW LEVEL SECURITY;

-- Policies for users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_score_entries' AND policyname = 'Authenticated users can view daily scores'
  ) THEN
    CREATE POLICY "Authenticated users can view daily scores"
      ON daily_score_entries FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_score_entries' AND policyname = 'Users can insert or update their own daily scores'
  ) THEN
    CREATE POLICY "Users can insert or update their own daily scores"
      ON daily_score_entries FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Index for date & user ranking lookup
CREATE INDEX IF NOT EXISTS idx_daily_score_entries_date_user 
ON daily_score_entries (date, user_id);
`;

writeFile('supabase/migrations/20260831_phase_c3_daily_score_entries.sql', migrationSql);

// -----------------------------------------------------------------------------
// 2. lib/scoring/computeDailyScore.ts
// -----------------------------------------------------------------------------
const computeDailyScoreTs = `import type { SupabaseClient } from '@supabase/supabase-js';
import { getDifficultyStages } from '@/lib/streak/updateWordCorrectStreaks';

const FULL_VALUE_THRESHOLD = 20;
const REFERENCE_MAX_SCORE = 20;
const MAX_WEIGHT = 1.5;
const MIN_WEIGHT = 0.5;

/**
 * 単語の習熟度ステージ (0〜6) に応じた難易度重みを計算する
 * ステージ0 (未習熟/新出) ほど重く (1.5), ステージ6 (定着済み) ほど軽く (0.5) する
 */
export function difficultyWeight(stage: number): number {
  const clamped = Math.min(Math.max(0, stage), 6);
  return MAX_WEIGHT - (MAX_WEIGHT - MIN_WEIGHT) * (clamped / 6);
}

/**
 * 逓減係数を計算する (20語までは満額 1.0、それ以降は平方根で緩やかに逓減)
 */
export function diminishingReturnFactor(
  orderIndexToday: number,
  fullValueThreshold = FULL_VALUE_THRESHOLD
): number {
  if (orderIndexToday <= fullValueThreshold) return 1.0;
  return Math.sqrt(fullValueThreshold / orderIndexToday);
}

/**
 * 単一単語の獲得スコアを計算する
 */
export function scoreForWord(
  isCorrect: boolean,
  stage: number,
  orderIndexToday: number
): number {
  if (!isCorrect) return 0;
  return difficultyWeight(stage) * diminishingReturnFactor(orderIndexToday);
}

export interface ComputeScoreParams {
  supabase: SupabaseClient;
  userId: string;
  date: string;
  answers: Array<{ wordId: string; isKnown: boolean }>;
}

export interface ComputedDailyScoreResult {
  userId: string;
  date: string;
  rawScore: number;
  normalizedScore: number;
  wordCount: number;
  accuracyRate: number;
  avgDifficultyWeight: number;
  avgDiminishingFactor: number;
}

/**
 * 本番デイリーチェックのスコアを算出して daily_score_entries に永続化する
 */
export async function computeAndSaveDailyScore(
  params: ComputeScoreParams
): Promise<ComputedDailyScoreResult | null> {
  const { supabase, userId, date, answers } = params;
  if (!answers || answers.length === 0) return null;

  // 1. word_id の重複を除き、初回出現順を対象にする
  const uniqueAnswers: Array<{ wordId: string; isKnown: boolean }> = [];
  const seenWordIds = new Set<string>();

  for (const ans of answers) {
    if (!seenWordIds.has(ans.wordId)) {
      seenWordIds.add(ans.wordId);
      uniqueAnswers.push({ wordId: ans.wordId, isKnown: ans.isKnown });
    }
  }

  const wordIds = uniqueAnswers.map((a) => a.wordId);
  const wordCount = wordIds.length;
  if (wordCount === 0) return null;

  // 2. getDifficultyStages で対象 word_id のステージを一括取得 (0〜6)
  const stagesMap = await getDifficultyStages(supabase, userId, wordIds);

  let rawScore = 0;
  let correctCount = 0;
  let totalDifficultyWeight = 0;
  let totalDiminishingFactor = 0;

  uniqueAnswers.forEach((item, index) => {
    const orderIndex = index + 1; // 1-based index
    const stage = stagesMap.get(item.wordId) ?? 0;
    const dWeight = difficultyWeight(stage);
    const dFactor = diminishingReturnFactor(orderIndex);

    totalDifficultyWeight += dWeight;
    totalDiminishingFactor += dFactor;

    if (item.isKnown) {
      correctCount += 1;
      rawScore += dWeight * dFactor;
    }
  });

  // 3. 正規化スコア (0〜100) の算出 (REFERENCE_MAX_SCORE = 20 を基準値とする)
  const normalizedScore = Math.min(
    100,
    Math.round((rawScore / REFERENCE_MAX_SCORE) * 100)
  );

  const accuracyRate =
    wordCount > 0 ? Math.round((correctCount / wordCount) * 10000) / 10000 : 0;
  const avgDifficultyWeight =
    wordCount > 0
      ? Math.round((totalDifficultyWeight / wordCount) * 10000) / 10000
      : 1.0;
  const avgDiminishingFactor =
    wordCount > 0
      ? Math.round((totalDiminishingFactor / wordCount) * 10000) / 10000
      : 1.0;
  const rawScoreRounded = Math.round(rawScore * 10000) / 10000;

  // 4. daily_score_entries に upsert
  const { error: upsertError } = await supabase
    .from('daily_score_entries')
    .upsert(
      {
        user_id: userId,
        date: date,
        raw_score: rawScoreRounded,
        normalized_score: normalizedScore,
        word_count: wordCount,
        accuracy_rate: accuracyRate,
        avg_difficulty_weight: avgDifficultyWeight,
        avg_diminishing_factor: avgDiminishingFactor,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

  if (upsertError) {
    console.error('Failed to upsert daily_score_entries:', upsertError);
  }

  return {
    userId,
    date,
    rawScore: rawScoreRounded,
    normalizedScore,
    wordCount,
    accuracyRate,
    avgDifficultyWeight,
    avgDiminishingFactor,
  };
}
`;

writeFile('lib/scoring/computeDailyScore.ts', computeDailyScoreTs);

// -----------------------------------------------------------------------------
// 3. app/api/test-sessions/complete/route.ts
// -----------------------------------------------------------------------------
const completeRoute = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
import { updateWordCorrectStreaks } from "@/lib/streak/updateWordCorrectStreaks";
import { computeAndSaveDailyScore } from "@/lib/scoring/computeDailyScore";
import { resolveOriginAssignment } from "@/lib/test/resolveOriginAssignment";

interface CompletePayload {
  dailyAssignmentId?: string | null;
  type: "daily_check" | "normal";
  results: Array<{
    wordId: string;
    isKnown: boolean;
    originDailyAssignmentId?: string;
  }>;
}

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

    const body: CompletePayload = await req.json();
    const { dailyAssignmentId, results } = body;
    const targetType = body.type || "normal";

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "Invalid results payload", detail: "解答データが空です" },
        { status: 400 }
      );
    }

    const today = getTodayJST();

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("wordbook_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wordbook_id) {
      return NextResponse.json(
        { error: "User wordbook not found", detail: profileError?.message || "単語帳が設定されていません" },
        { status: 400 }
      );
    }

    // 本番デイリーチェックの重複登録ガード (409 Conflict)
    if (targetType === "daily_check") {
      const { data: existingDailyCheck } = await supabase
        .from("test_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("type", "daily_check")
        .maybeSingle();

      if (existingDailyCheck) {
        return NextResponse.json(
          {
            error: "Conflict",
            detail: "本日の本番デイリーチェックは既に受験済みです。1日1回のみ記録可能です。",
          },
          { status: 409 }
        );
      }
    }

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;

    // 1. test_sessions への挿入
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: targetType,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Failed to insert test_sessions:", sessionError);

      if (sessionError?.code === "23505" || sessionError?.message?.includes("uq_daily_check")) {
        return NextResponse.json(
          {
            error: "Conflict",
            detail: "本日の本番デイリーチェックは既に記録されています。",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to create test session",
          detail: \`test_sessions 登録エラー: \${sessionError?.message} (\${sessionError?.code})\`,
        },
        { status: 500 }
      );
    }

    // 2. test_answers への挿入
    const wordIds = results.map((r) => r.wordId);
    const originMap = await resolveOriginAssignment(
      user.id,
      profile.wordbook_id,
      wordIds
    );

    const { data: validAssignments } = await supabase
      .from("daily_assignments")
      .select("id")
      .eq("user_id", user.id);

    const validAssignmentIdSet = new Set((validAssignments ?? []).map((a) => a.id));

    const answerRows = results.map((r) => {
      let targetAssignmentId =
        r.originDailyAssignmentId ||
        originMap.get(r.wordId) ||
        (dailyAssignmentId ?? null);

      if (targetAssignmentId && !validAssignmentIdSet.has(targetAssignmentId)) {
        targetAssignmentId = null;
      }

      return {
        session_id: session.id,
        word_id: r.wordId,
        is_known: r.isKnown,
        origin_daily_assignment_id: targetAssignmentId,
      };
    });

    const { error: answersError } = await supabase
      .from("test_answers")
      .insert(answerRows);

    if (answersError) {
      console.error("Failed to insert test_answers:", answersError);
      return NextResponse.json(
        {
          error: "Failed to insert test_answers",
          detail: \`test_answers 登録エラー: \${answersError?.message} (\${answersError?.code})\`,
          sessionId: session.id,
        },
        { status: 500 }
      );
    }

    // 3. 全体連続ログイン/学習ストリーク更新
    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", streakErr);
    }

    // 4. 単語ごとの連続正解カウント更新 (normal / daily_check 共通)
    try {
      await updateWordCorrectStreaks(
        supabase,
        user.id,
        results.map((r) => ({ wordId: r.wordId, isKnown: r.isKnown })),
        today
      );
    } catch (wordStreakErr: any) {
      console.error("Failed to update word correct streaks:", wordStreakErr);
    }

    // 5. デイリースコア計算 & 永続化 (フェーズC-3: daily_check のみ対象)
    let computedScore: any = null;
    if (targetType === "daily_check") {
      try {
        computedScore = await computeAndSaveDailyScore({
          supabase,
          userId: user.id,
          date: today,
          answers: results.map((r) => ({ wordId: r.wordId, isKnown: r.isKnown })),
        });
      } catch (scoreErr: any) {
        console.error("Failed to compute daily score:", scoreErr);
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      savedAnswersCount: answerRows.length,
      correctCount,
      totalCount,
      type: targetType,
      dailyScore: computedScore,
    });
  } catch (err: any) {
    console.error("Complete API fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/test-sessions/complete/route.ts', completeRoute);

// -----------------------------------------------------------------------------
// 4. app/(main)/group/page.tsx (デイリーランキング表示)
// -----------------------------------------------------------------------------
const groupPage = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { Users, User, Trophy, CheckCircle2 } from 'lucide-react';

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
    .select('user_id, raw_score, normalized_score, word_count, accuracy_rate')
    .eq('date', today)
    .in('user_id', memberIds);

  const scoreMap = new Map(
    (scoreRows ?? []).map((s) => [s.user_id, s])
  );

  // 3. 受験済みメンバーをランキング順にソート (normalized_score 降順 -> raw_score 降順)
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
            <Trophy className="h-4 w-4 text-highlighter" />
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
              const accuracy = scoreEntry?.accuracy_rate ? Math.round(scoreEntry.accuracy_rate * 100) : null;
              const wbName = (m.wordbooks as { name?: string } | null)?.name;

              // 順位ごとのバッジ
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              const rankBadge = isFirst ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-900 border border-amber-300 shadow-xs">
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
                  className={\`flex items-center justify-between rounded-2xl border p-4 shadow-xs transition \${
                    isFirst
                      ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-300/50'
                      : isMe
                      ? 'border-line bg-akashiito/5'
                      : 'border-line bg-white'
                  }\`}
                >
                  <div className="flex items-center gap-3">
                    {rankBadge}
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
                    </div>
                  </div>

                  <div className="text-right">
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
// 5. app/api/debug/diagnose/route.ts (自己診断に daily_score_entries 追加)
// -----------------------------------------------------------------------------
const diagnoseRoute = `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const diagnostics: Array<{
    step: string;
    status: "ok" | "error" | "warning";
    message: string;
    data?: any;
  }> = [];

  try {
    const supabase = await createClient();

    // 1. 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      diagnostics.push({
        step: "1. ログイン認証",
        status: "error",
        message: "ユーザーがログインしていません",
        data: authError?.message,
      });
      return NextResponse.json({ diagnostics });
    }

    diagnostics.push({
      step: "1. ログイン認証",
      status: "ok",
      message: \`ログイン中: \${user.email} (ID: \${user.id})\`,
    });

    // 2. 単語帳設定チェック
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name, wordbook_id, wordbooks(name, total_words)")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wordbook_id) {
      diagnostics.push({
        step: "2. 単語帳設定",
        status: "error",
        message: "単語帳が設定されていません",
        data: profileError?.message,
      });
    } else {
      const wb = profile.wordbooks as any;
      diagnostics.push({
        step: "2. 単語帳設定",
        status: "ok",
        message: \`選択中: \${wb?.name || "ID: " + profile.wordbook_id} (総語数: \${wb?.total_words ?? 0}語)\`,
      });
    }

    // 3. 日次割当チェック
    const { data: assignments, error: assignError } = await supabase
      .from("daily_assignments")
      .select("id, date, range_start, range_end, is_review_day")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (assignError) {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "error",
        message: "割当データの取得に失敗しました (RLS等の可能性)",
        data: assignError.message,
      });
    } else if (!assignments || assignments.length === 0) {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "warning",
        message: "割当が0件です。ダッシュボードで範囲を設定してください。",
      });
    } else {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "ok",
        message: \`現在 \${assignments.length} 日分の割当が設定されています\`,
        data: assignments.map((a) => \`\${a.date}: No.\${a.range_start}〜\${a.range_end} (\${a.is_review_day ? "復習" : "進める"})\`),
      });
    }

    // 4. テストセッションチェック
    const { data: sessions, error: sessionsError } = await supabase
      .from("test_sessions")
      .select("id, date, type, correct_count, total_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (sessionsError) {
      diagnostics.push({
        step: "4. テストセッション (test_sessions)",
        status: "error",
        message: "test_sessions の取得に失敗しました",
        data: sessionsError.message,
      });
    } else {
      diagnostics.push({
        step: "4. テストセッション (test_sessions)",
        status: "ok",
        message: \`通算 \${sessions.length} 件のテスト履歴が見つかりました (最新5件取得)\`,
        data: sessions.map((s) => \`\${s.date} [\${s.type}]: \${s.correct_count}/\${s.total_count}語 (\${s.created_at})\`),
      });
    }

    // 5. テスト回答チェック
    const { data: answers, error: answersError } = await supabase
      .from("test_answers")
      .select("id, is_known, origin_daily_assignment_id, word_id, session_id, created_at, test_sessions!inner(user_id)")
      .eq("test_sessions.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (answersError) {
      diagnostics.push({
        step: "5. テスト回答 (test_answers)",
        status: "error",
        message: "test_answers の取得に失敗しました",
        data: answersError.message,
      });
    } else {
      diagnostics.push({
        step: "5. テスト回答 (test_answers)",
        status: "ok",
        message: \`test_answers の取得成功 (最新10件)\`,
        data: {
          totalFetched: answers.length,
          sample: answers.slice(0, 3),
        },
      });
    }

    // 6. 単語ごとの連続正解カウント (word_correct_streaks) チェック
    const { data: wordStreaks, error: wordStreaksError } = await supabase
      .from("word_correct_streaks")
      .select("word_id, streak_count, last_updated_date, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (wordStreaksError) {
      diagnostics.push({
        step: "6. 連続正解カウント (word_correct_streaks)",
        status: "error",
        message: "word_correct_streaks の取得に失敗しました",
        data: wordStreaksError.message,
      });
    } else {
      diagnostics.push({
        step: "6. 連続正解カウント (word_correct_streaks)",
        status: "ok",
        message: \`記録済み単語数: \${wordStreaks.length} 件 (最新10件取得)\`,
        data: wordStreaks.map((s) => \`WordID: \${s.word_id} => 連続正解 \${s.streak_count}回 (最終更新: \${s.last_updated_date})\`),
      });
    }

    // 7. デイリースコアエントリー (daily_score_entries) チェック (フェーズC-3新設)
    const { data: scoreEntries, error: scoreError } = await supabase
      .from("daily_score_entries")
      .select("date, normalized_score, raw_score, word_count, accuracy_rate, computed_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5);

    if (scoreError) {
      diagnostics.push({
        step: "7. デイリースコア (daily_score_entries)",
        status: "error",
        message: "daily_score_entries の取得に失敗しました (マイグレーション未適用の可能性)",
        data: scoreError.message,
      });
    } else {
      diagnostics.push({
        step: "7. デイリースコア (daily_score_entries)",
        status: "ok",
        message: \`スコア記録数: \${scoreEntries.length} 件 (最新5件取得)\`,
        data: scoreEntries.map((e) => \`\${e.date}: \${e.normalized_score}点 (raw: \${e.raw_score}, 正答率: \${Math.round((e.accuracy_rate || 0) * 100)}%, \${e.word_count}語)\`),
      });
    }

    return NextResponse.json({ diagnostics });
  } catch (err: any) {
    return NextResponse.json(
      { 
        diagnostics: [
          { 
            step: "致命的エラー", 
            status: "error", 
            message: err?.message || String(err) 
          } 
        ] 
      },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/debug/diagnose/route.ts', diagnoseRoute);

console.log('\n================================================================');
console.log('✅ フェーズC-3: 全ファイルの更新・生成が正常に完了しました！');
console.log('================================================================\n');
console.log('【DBマイグレーションの実行】');
console.log('Supabase SQL Editorにて、以下のマイグレーションSQLを実行してください:');
console.log('----------------------------------------------------------------');
console.log(migrationSql);
console.log('----------------------------------------------------------------');