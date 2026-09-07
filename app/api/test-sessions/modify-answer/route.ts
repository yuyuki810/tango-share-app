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
    const { sessionId, wordId, isKnown } = body;

    if (!sessionId || !wordId || typeof isKnown !== "boolean") {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // セッション所有権 & 未完了チェック
    const { data: session } = await supabase
      .from("test_sessions")
      .select("id, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session || session.completed_at) {
      return NextResponse.json(
        { error: "テスト完了後の回答は修正できません" },
        { status: 400 }
      );
    }

    // 該当セッションで最も新しく回答されたレコードを取得 (直前1問ガード)
    const { data: latestAnswer, error: answerError } = await supabase
      .from("test_answers")
      .select("id, word_id, is_known, streak_before, streak_after, origin_daily_assignment_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (answerError || !latestAnswer) {
      return NextResponse.json({ error: "修正可能な回答が見つかりません" }, { status: 404 });
    }

    if (latestAnswer.word_id !== wordId) {
      return NextResponse.json(
        { error: "直前の1問のみ修正可能です" },
        { status: 400 }
      );
    }

    const todayJst = getTodayJST();

    // 1. streak の巻き戻しと再計算
    // streak_before と streak_after が異なっていた場合のみ、この回答で streak が変更されていたと判定
    const didUpdateStreak =
      latestAnswer.streak_before !== null &&
      latestAnswer.streak_after !== null &&
      latestAnswer.streak_before !== latestAnswer.streak_after;

    let newStreakAfter = latestAnswer.streak_after;

    if (didUpdateStreak) {
      const baseBefore = latestAnswer.streak_before ?? 0;
      newStreakAfter = isKnown ? baseBefore + 1 : 0;

      // 巻き戻した基準値から新判定で streak を再更新
      await supabase.from("word_correct_streaks").upsert(
        {
          user_id: user.id,
          word_id: wordId,
          streak_count: newStreakAfter,
          last_updated_date: todayJst,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" }
      );
    }

    // 2. test_answers を修正後の判定と streak_after に更新
    const { error: updateError } = await supabase
      .from("test_answers")
      .update({
        is_known: isKnown,
        streak_after: newStreakAfter,
      })
      .eq("id", latestAnswer.id);

    if (updateError) {
      return NextResponse.json(
        { error: "回答の修正保存に失敗しました", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      wordId,
      isKnown,
      streakBefore: latestAnswer.streak_before,
      streakAfter: newStreakAfter,
    });
  } catch (err: any) {
    console.error("Modify answer error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
