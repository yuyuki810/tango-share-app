import { NextRequest, NextResponse } from "next/server";
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

    if (!session || session.completed_at) {
      return NextResponse.json({ error: "Active session not found" }, { status: 404 });
    }

    const todayJst = getTodayJST();

    // 1. 現在の word_correct_streaks を取得
    const { data: existingStreak } = await supabase
      .from("word_correct_streaks")
      .select("streak_count, last_updated_date")
      .eq("user_id", user.id)
      .eq("word_id", wordId)
      .maybeSingle();

    let streakBefore: number | null = null;
    let streakAfter: number | null = null;
    let shouldUpdateStreak = true;

    // 同一日にすでに更新済みであれば streak 変動はスキップ（同日初回回答ルール）
    if (existingStreak && existingStreak.last_updated_date === todayJst) {
      shouldUpdateStreak = false;
      streakBefore = existingStreak.streak_count;
      streakAfter = existingStreak.streak_count;
    } else {
      streakBefore = existingStreak?.streak_count ?? 0;
      streakAfter = isKnown ? streakBefore + 1 : 0;
    }

    // 2. word_correct_streaks の更新
    if (shouldUpdateStreak) {
      await supabase.from("word_correct_streaks").upsert(
        {
          user_id: user.id,
          word_id: wordId,
          streak_count: streakAfter,
          last_updated_date: todayJst,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" }
      );
    }

    // 3. test_answers に upsert (streak_before / streak_after を保持)
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
          streak_before: streakBefore,
          streak_after: streakAfter,
        })
        .eq("id", existingAnswer.id);
    } else {
      await supabase.from("test_answers").insert({
        session_id: sessionId,
        word_id: wordId,
        is_known: isKnown,
        origin_daily_assignment_id: originDailyAssignmentId,
        streak_before: streakBefore,
        streak_after: streakAfter,
      });
    }

    return NextResponse.json({
      success: true,
      streakBefore,
      streakAfter,
      streakUpdated: shouldUpdateStreak,
    });
  } catch (err: any) {
    console.error("Answer saving error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
