/**
 * setup_phase_e2_part2.js
 * フェーズE-2: APIルート3ファイル（start / answer / complete）一括生成スクリプト
 * 
 * 実行方法:
 *   node setup_phase_e2_part2.js
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
  console.log(`[FILE] 生成完了: ${relativeFilePath}`);
}

console.log('=== フェーズE-2 APIルート3ファイルの生成を開始します ===\n');

// -----------------------------------------------------------------------------
// 1. app/api/test-sessions/start/route.ts
// -----------------------------------------------------------------------------
const startRoute = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type = "normal", dailyAssignmentId = null, totalCount = 0 } = body;
    const today = getTodayJST();

    // 1. daily_check の場合: 完了済みセッションの重複チェック (409 Conflict)
    if (type === "daily_check") {
      const { data: completedSession } = await supabase
        .from("test_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("type", "daily_check")
        .not("completed_at", "is", null)
        .maybeSingle();

      if (completedSession) {
        return NextResponse.json(
          {
            error: "Conflict",
            detail: "本日の本番デイリーチェックは既に受験完了しています。",
          },
          { status: 409 }
        );
      }
    }

    // 2. 進行中(未完了)のセッションが存在するか確認
    let incompleteQuery = supabase
      .from("test_sessions")
      .select("id, type, date, total_count, correct_count, created_at")
      .eq("user_id", user.id)
      .eq("type", type)
      .is("completed_at", null);

    if (type === "daily_check") {
      incompleteQuery = incompleteQuery.eq("date", today);
    }

    const { data: incompleteSession } = await incompleteQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (incompleteSession) {
      // 既に回答済みの単語一覧を取得
      const { data: answers } = await supabase
        .from("test_answers")
        .select("word_id, is_known, origin_daily_assignment_id, created_at")
        .eq("session_id", incompleteSession.id)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        success: true,
        mode: "resume",
        session: incompleteSession,
        answeredWords: (answers ?? []).map((a) => ({
          wordId: a.word_id,
          isKnown: a.is_known,
          originDailyAssignmentId: a.origin_daily_assignment_id,
        })),
      });
    }

    // 3. 未完了セッションがない場合は新規セッションを作成 (completed_at = null)
    const { data: newSession, error: createError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: type,
        correct_count: 0,
        total_count: totalCount,
        completed_at: null,
      })
      .select("id, type, date, total_count, correct_count, created_at")
      .single();

    if (createError || !newSession) {
      if (createError?.code === "23505") {
        return NextResponse.json(
          { error: "Conflict", detail: "本日のセッションは既に作成されています。" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to start session", detail: createError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "new",
      session: newSession,
      answeredWords: [],
    });
  } catch (err: any) {
    console.error("Start session error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/test-sessions/start/route.ts', startRoute);

// -----------------------------------------------------------------------------
// 2. app/api/test-sessions/answer/route.ts
// -----------------------------------------------------------------------------
const answerRoute = `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, wordId, isKnown, originDailyAssignmentId = null } = body;

    if (!sessionId || !wordId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // セッションの所有権と未完了ステータス確認
    const { data: session } = await supabase
      .from("test_sessions")
      .select("id, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 既に回答済みの場合は更新、なければ新規挿入
    const { data: existingAnswer } = await supabase
      .from("test_answers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("word_id", wordId)
      .maybeSingle();

    if (existingAnswer) {
      await supabase
        .from("test_answers")
        .update({
          is_known: isKnown,
          origin_daily_assignment_id: originDailyAssignmentId,
        })
        .eq("id", existingAnswer.id);
    } else {
      await supabase.from("test_answers").insert({
        session_id: sessionId,
        word_id: wordId,
        is_known: isKnown,
        origin_daily_assignment_id: originDailyAssignmentId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Answer saving error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/test-sessions/answer/route.ts', answerRoute);

// -----------------------------------------------------------------------------
// 3. app/api/test-sessions/complete/route.ts
// -----------------------------------------------------------------------------
const completeRoute = `import { NextRequest, NextResponse } from "next/server";
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
        console.error("Failed to compute daily score:", scoreErr);
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
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`;

writeFile('app/api/test-sessions/complete/route.ts', completeRoute);

console.log('\n================================================================');
console.log('✅ APIルート3ファイルの一括生成が完了しました！');
console.log('================================================================\n');