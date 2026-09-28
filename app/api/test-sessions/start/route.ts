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
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const {
      type = "normal",
      dailyAssignmentId = null,
      totalCount = 0,
      wordIds = [],
      isRandomOrder = false,
      forceNew = false,
      isRetry = false,
    } = body;
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
        console.warn(`[start/route] Daily check already completed for user ${user.id} on ${today}`);
        return NextResponse.json(
          {
            error: "Conflict",
            code: "ALREADY_COMPLETED",
            detail: "本日の本番デイリーチェックは既に受験完了しています。",
          },
          { status: 409 }
        );
      }
    }

    let incompleteSession: any = null;

    // 2. forceNew が true の場合: 過去の未完了セッションをクローズ
    if (forceNew) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("test_sessions")
        .update({ completed_at: nowIso })
        .eq("user_id", user.id)
        .eq("type", type)
        .is("completed_at", null);
    } else {
      // 未完了セッションを検索
      let incompleteQuery = supabase
        .from("test_sessions")
        .select("id, type, date, total_count, correct_count, created_at, is_random_order, is_retry")
        .eq("user_id", user.id)
        .eq("type", type)
        .is("completed_at", null);

      if (type === "daily_check") {
        incompleteQuery = incompleteQuery.eq("date", today);
      }

      const { data: foundSession } = await incompleteQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      incompleteSession = foundSession;

      if (incompleteSession) {
        const { data: answers } = await supabase
          .from("test_answers")
          .select("word_id, is_known, origin_daily_assignment_id, created_at")
          .eq("session_id", incompleteSession.id)
          .order("created_at", { ascending: true });

        const answeredList = answers ?? [];

        let isValidResume = false;
        if (answeredList.length > 0 && totalCount > 0 && answeredList.length < totalCount) {
          if (Array.isArray(wordIds) && wordIds.length > 0) {
            const targetWordIdSet = new Set(wordIds);
            isValidResume = answeredList.every((a) => targetWordIdSet.has(a.word_id));
          } else {
            isValidResume = true;
          }
        }

        if (isValidResume) {
          return NextResponse.json({
            success: true,
            mode: "resume",
            session: incompleteSession,
            isRandomOrder: !!incompleteSession.is_random_order,
            answeredWords: answeredList.map((a) => ({
              wordId: a.word_id,
              isKnown: a.is_known,
              originDailyAssignmentId: a.origin_daily_assignment_id,
            })),
          });
        }
      }
    }

    // 3. 【修正2】daily_check かつ未完了セッションが存在するが再開できない場合:
    //    新規 insert せずに既存行を再利用(リセット)して 23505 衝突を完全防止
    if (type === "daily_check" && !forceNew && incompleteSession) {
      console.log(`[start/route] Reusing incomplete daily_check session ${incompleteSession.id} for user ${user.id}`);

      const { error: deleteError } = await supabase
        .from("test_answers")
        .delete()
        .eq("session_id", incompleteSession.id);

      if (deleteError) {
        console.error("[start/route] Failed to clear previous answers:", deleteError);
        return NextResponse.json(
          {
            error: "Failed to reset session answers",
            code: "RESET_FAILED",
            detail: deleteError.message,
          },
          { status: 500 }
        );
      }

      const { data: updatedSession, error: updateError } = await supabase
        .from("test_sessions")
        .update({
          total_count: totalCount,
          correct_count: 0,
          is_random_order: isRandomOrder,
        })
        .eq("id", incompleteSession.id)
        .select("id, type, date, total_count, correct_count, created_at, is_random_order")
        .single();

      if (updateError || !updatedSession) {
        console.error("[start/route] Failed to update reused session:", updateError);
        return NextResponse.json(
          {
            error: "Failed to reuse session",
            code: "RESET_FAILED",
            detail: updateError?.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "new",
        session: updatedSession,
        isRandomOrder: !!updatedSession.is_random_order,
        answeredWords: [],
      });
    }

    // 4. 通常の新規セッション作成
    const { data: newSession, error: createError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type: type,
        correct_count: 0,
        total_count: totalCount,
        completed_at: null,
        is_random_order: isRandomOrder,
        is_retry: isRetry,
      })
      .select("id, type, date, total_count, correct_count, created_at, is_random_order, is_retry")
      .single();

    if (createError || !newSession) {
      if (createError?.code === "23505") {
        console.error(`[start/route] 23505 Conflict: Session already exists for user ${user.id} on ${today}`, createError);
        return NextResponse.json(
          {
            error: "Conflict",
            code: "SESSION_CONFLICT",
            detail: "本日のセッションは既に作成されています。",
          },
          { status: 409 }
        );
      }
      console.error("[start/route] Failed to insert new session:", createError);
      return NextResponse.json(
        {
          error: "Failed to start session",
          code: "START_FAILED",
          detail: createError?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: "new",
      session: newSession,
      isRandomOrder: !!newSession.is_random_order,
      answeredWords: [],
    });
  } catch (err: any) {
    console.error("Start session fatal error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "START_FAILED",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
