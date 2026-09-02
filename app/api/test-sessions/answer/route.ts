import { NextRequest, NextResponse } from "next/server";
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
