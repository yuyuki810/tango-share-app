import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
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
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CompletePayload = await req.json();
    const { dailyAssignmentId, type, results } = body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "Invalid results payload" },
        { status: 400 }
      );
    }

    const today = getTodayJST();

    if (type === "daily_check") {
      const { data: existingSession } = await supabase
        .from("test_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("type", "daily_check")
        .maybeSingle();

      if (existingSession) {
        return NextResponse.json(
          { error: "Daily check test already completed today" },
          { status: 409 }
        );
      }
    }

    const { data: profile } = await supabase
      .from("users")
      .select("wordbook_id")
      .eq("id", user.id)
      .single();

    if (!profile?.wordbook_id) {
      return NextResponse.json(
        { error: "User wordbook not found" },
        { status: 400 }
      );
    }

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;

    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        date: today,
        type,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Failed to insert test_sessions:", sessionError);
      return NextResponse.json(
        { error: "Failed to create test session" },
        { status: 500 }
      );
    }

    const wordIds = results.map((r) => r.wordId);
    const originMap = await resolveOriginAssignment(
      user.id,
      profile.wordbook_id,
      wordIds
    );

    const answerRows = results.map((r) => ({
      session_id: session.id,
      word_id: r.wordId,
      is_known: r.isKnown,
      origin_daily_assignment_id:
        r.originDailyAssignmentId ||
        originMap.get(r.wordId) ||
        (dailyAssignmentId ?? null),
    }));

    const { error: answersError } = await supabase
      .from("test_answers")
      .insert(answerRows);

    if (answersError) {
      console.error("Failed to insert test_answers:", answersError);
    }

    await updateStreak(user.id, today);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      correctCount,
      totalCount,
    });
  } catch (err: unknown) {
    console.error("Complete API error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
