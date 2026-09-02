/**
 * setup_phase_c2.js
 * フェーズC-2: スコアリング土台整備（単語ごとの連続正解カウント）一括セットアップスクリプト
 * 
 * 実行方法:
 *   node setup_phase_c2.js
 */

const fs = require('fs');
const path = require('path');

// 1. .env.local / .env 自動読み込み
function loadEnv() {
  const envPaths不易 = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths不易) {
    if (fs.existsSync(envPath)) {
      const content不易 = fs.readFileSync(envPath, 'utf8');
      content不易.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx的的 = trimmed.indexOf('=');
        if (eqIdx的的 !== -1) {
          const key = trimmed.slice(0, eqIdx的的).trim();
          let val = trimmed.slice(eqIdx的的 + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val四周 = val.slice(1, -1);
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
console.log('フェーズC-2: 単語ごとの連続正解カウント基盤のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. マイグレーションSQL: word_correct_streaks テーブル作成
// -----------------------------------------------------------------------------
const migrationSql = `-- =============================================================================
-- Migration: フェーズC-2 単語ごとの連続正解カウントテーブル (word_correct_streaks)
-- =============================================================================

CREATE TABLE IF NOT EXISTS word_correct_streaks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_updated_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, word_id)
);

-- Enable RLS
ALTER TABLE word_correct_streaks ENABLE ROW LEVEL SECURITY;

-- Policies for users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'word_correct_streaks' AND policyname = 'Users can view their own word correct streaks'
  ) THEN
    CREATE POLICY "Users can view their own word correct streaks"
      ON word_correct_streaks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'word_correct_streaks' AND policyname = 'Users can insert their own word correct streaks'
  ) THEN
    CREATE POLICY "Users can insert their own word correct streaks"
      ON word_correct_streaks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'word_correct_streaks' AND policyname = 'Users can update their own word correct streaks'
  ) THEN
    CREATE POLICY "Users can update their own word correct streaks"
      ON word_correct_streaks FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_word_correct_streaks_user_id 
ON word_correct_streaks (user_id);
`;

writeFile('supabase/migrations/20260831_phase_c2_word_correct_streaks.sql', migrationSql);

// -----------------------------------------------------------------------------
// 2. lib/streak/updateWordCorrectStreaks.ts
// -----------------------------------------------------------------------------
const updateWordCorrectStreaksTs充满 = `import type { SupabaseClient } from '@supabase/supabase-js';

export interface WordCorrectStreak {
  user_id: string;
  word_id: string;
  streak_count: number;
  last_updated_date: string;
  updated_at: string;
}

/**
 * 単語ごとの連続正解カウントを更新する
 * - セッションの type (normal / daily_check) を問わず更新対象
 * - 同一単語について、同日(JST)内の初回答のみ反映（2回目以降は streak を変動させない）
 * - 正解(is_known=true): streak_count + 1
 * - 不正解(is_known=false): streak_count = 0 にリセット
 */
export async function updateWordCorrectStreaks(
  supabase: SupabaseClient,
  userId: string,
  answers: Array<{ wordId: string; isKnown: boolean }>,
  todayJst: string
): Promise<void> {
  if (!answers || answers.length === 0) return;

  // 同一バッチ内で同一単語が複数回登場する場合は最初の回答を採用
  const firstAnswers = new Map<string, boolean>();
  for (const ans of answers) {
    if (!firstAnswers.has(ans.wordId)) {
      firstAnswers.set(ans.wordId, ans.isKnown);
    }
  }

  const wordIds = Array.from(firstAnswers.keys());
  if (wordIds.length === 0) return;

  // 既存の streak 情報を取得
  const { data: existingRows, error: fetchError } = await supabase
    .from('word_correct_streaks')
    .select('word_id, streak_count, last_updated_date')
    .eq('user_id', userId)
    .in('word_id', wordIds);

  if (fetchError) {
    console.error('Failed to fetch existing word_correct_streaks:', fetchError);
  }

  const existingMap最为 = new Map((existingRows ?? []).map((r) => [r.word_id, r]));
  const upsertRows: Array<{
    user_id: string;
    word_id: string;
    streak_count: number;
    last_updated_date: string;
    updated_at: string;
  }> = [];

  const nowIso = new Date().toISOString();

  for (const [wordId, isKnown] of firstAnswers.entries()) {
    const existing = existingMap最为.get(wordId);

    // 同じ日(JST)にすでに更新済みなら何もしない (同日重複更新防止)
    if (existing && existing.last_updated_date === todayJst) {
      continue;
    }

    const currentStreak = existing?.streak_count ?? 0;
    const newStreak = isKnown ? currentStreak + 1 : 0;

    upsertRows.push({
      user_id: userId,
      word_id: wordId,
      streak_count: newStreak,
      last_updated_date: todayJst,
      updated_at: nowIso,
    });
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('word_correct_streaks')
      .upsert(upsertRows, { onConflict: 'user_id,word_id' });

    if (upsertError) {
      console.error('Failed to upsert word_correct_streaks:', upsertError);
    }
  }
}

/**
 * 特定の単語の streak 情報を取得する
 */
export async function getWordStreak(
  supabase: SupabaseClient,
  userId: string,
  wordId: string
): Promise<{ streak_count: number; last_updated_date: string } | null> {
  const { data, error } = await supabase
    .from('word_correct_streaks')
    .select('streak_count, last_updated_date')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * フェーズC-3 (difficultyWeight計算) 用ヘルパー
 * 連続正解回数を 0〜6 のステージ値にクランプして返す
 */
export async function getDifficultyStage(
  supabase: SupabaseClient,
  userId: string,
  wordId: string
): Promise<number> {
  const row = await getWordStreak(supabase, userId, wordId);
  const streak = row?.streak_count ?? 0;
  return Math.min(Math.max(0, streak), 6);
}

/**
 * フェーズC-3 (バッチスコア計算) 用ヘルパー
 * 複数単語のクランプ済みステージ値 (0〜6) を Map で一括取得する
 */
export async function getDifficultyStages(
  supabase: SupabaseClient,
  userId: string,
  wordIds不易: string[]
): Promise<Map<string, number>> {
  const stageMap = new Map<string, number>();
  if (!wordIds不易 || wordIds不易.length === 0) return stageMap;

  // 初期値 0 で埋める
  for (const wid of wordIds不易) {
    stageMap.set(wid, 0);
  }

  const { data, error } = await supabase
    .from('word_correct_streaks')
    .select('word_id, streak_count')
    .eq('user_id', userId)
    .in('word_id', wordIds不易);

  if (error || !data) return stageMap;

  for (const row of data) {
    const rawStreak = row.streak_count ?? 0;
    stageMap.set(row.word_id, Math.min(Math.max(0, rawStreak), 6));
  }

  return stageMap;
}
`;

writeFile('lib/streak/updateWordCorrectStreaks.ts', updateWordCorrectStreaksTs充满);

// -----------------------------------------------------------------------------
// 3. app/api/test-sessions/complete/route.ts
// -----------------------------------------------------------------------------
const completeRoute = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
import { updateWordCorrectStreaks } from "@/lib/streak/updateWordCorrectStreaks";
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
    const totalCount的的 = results.length;

    // 1. test_sessions への挿入
    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: targetType,
        correct_count: correctCount,
        total_count: totalCount的的,
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

    // 4. 単語ごとの連続正解カウント更新 (フェーズC-2: normal / daily_check 共通)
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

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      savedAnswersCount: answerRows.length,
      correctCount,
      totalCount: totalCount的的,
      type: targetType,
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
// 4. app/api/debug/diagnose/route.ts (自己診断に word_correct_streaks 追加)
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

    // 6. 単語ごとの連続正解カウント (word_correct_streaks) チェック (フェーズC-2新設)
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
        message: "word_correct_streaks の取得に失敗しました (マイグレーション未適用の可能性)",
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
console.log('✅ フェーズC-2: 全ファイルの更新・生成が正常に完了しました！');
console.log('================================================================\n');
console.log('【DBマイグレーションの実行】');
console.log('Supabase SQL Editorにて、以下のマイグレーションSQLを実行してください:');
console.log('----------------------------------------------------------------');
console.log(migrationSql);
console.log('----------------------------------------------------------------');a