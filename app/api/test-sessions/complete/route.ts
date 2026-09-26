import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";
import { updateStreak } from "@/lib/streak/updateStreak";
import { updateWordCorrectStreaks } from "@/lib/streak/updateWordCorrectStreaks";
import { computeAndSaveDailyScore } from "@/lib/scoring/computeDailyScore";
import { diagnoseLearningPattern } from "@/lib/scoring/diagnoseLearningPattern";

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

    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .select("id, user_id, date, type, completed_at, is_random_order")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.completed_at) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        sessionId: session.id,
      });
    }

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

    const { data: allAnswers } = await supabase
      .from("test_answers")
      .select("word_id, is_known, origin_daily_assignment_id")
      .eq("session_id", sessionId);

    const answerList = allAnswers ?? [];
    const correctCount = answerList.filter((a) => a.is_known).length;
    const totalCount = answerList.length;

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

    // 全体連続学習ストリーク更新
    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error("Failed to update streak:", (streakErr as any)?.message || String(streakErr));
    }

    // 単語ごとの連続正解カウント更新
    try {
      await updateWordCorrectStreaks(
        supabase,
        user.id,
        answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        today
      );
    } catch (wordStreakErr: any) {
      console.error("Failed to update word correct streaks:", (wordStreakErr as any)?.message || String(wordStreakErr));
    }

    let computedScore: any = null;
    let learningPatternBadge: any = null;
    let personalBests: any = null;

    // daily_check 完了時のみの特別処理
    if (session.type === "daily_check") {
      // 1. 【指示書修正点1 & 2】EXP加算を最優先で独立したtry/catchで実行し、エラーも確認・記録する
      try {
        const { data: userRow, error: userFetchError } = await supabase
          .from("users")
          .select("total_exp")
          .eq("id", user.id)
          .single();

        if (userFetchError) {
          console.error("Failed to fetch total_exp:", userFetchError.message);
        } else {
          const currentExp = userRow?.total_exp ?? 0;
          const updatedExp = currentExp + totalCount;

          const { error: expUpdateError } = await supabase
            .from("users")
            .update({ total_exp: updatedExp })
            .eq("id", user.id);

          if (expUpdateError) {
            console.error("Failed to update total_exp:", expUpdateError.message);
          } else {
            console.log(`Successfully updated total_exp for ${user.id}: ${currentExp} -> ${updatedExp}`);
          }
        }
      } catch (expErr: any) {
        console.error("EXP accumulation failed:", (expErr as any)?.message || String(expErr));
      }

      // 2. その後、スコア計算・診断バッジ・自己ベスト判定を独立して実行
      try {
        const { data: assignment } = await supabase
          .from("daily_assignments")
          .select("range_start, range_end")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();

        const targetWordCount = assignment && assignment.range_end && assignment.range_start
          ? assignment.range_end - assignment.range_start + 1
          : totalCount;

        computedScore = await computeAndSaveDailyScore({
          supabase,
          userId: user.id,
          date: today,
          answers: answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
          targetWordCount,
        });

        if (session.is_random_order && computedScore) {
          const bonusScore = Math.min(100, computedScore.normalizedScore + 5);
          await supabase
            .from("daily_score_entries")
            .update({
              normalized_score: bonusScore,
              random_bonus_applied: true,
            })
            .eq("user_id", user.id)
            .eq("date", today);

          computedScore.normalizedScore = bonusScore;
          computedScore.randomBonusApplied = true;
        }

        learningPatternBadge = await diagnoseLearningPattern(
          supabase,
          user.id,
          today,
          targetWordCount
        );

        // 自己ベスト判定 (過去の最高スコア & 最長継続日数)
        const { data: pastScores } = await supabase
          .from("daily_score_entries")
          .select("normalized_score")
          .eq("user_id", user.id)
          .lt("date", today)
          .order("normalized_score", { ascending: false })
          .limit(1);

        const pastMaxScore = pastScores && pastScores.length > 0 ? (pastScores[0].normalized_score ?? 0) : null;
        const currentNorm = computedScore ? computedScore.normalizedScore : 0;
        const isScoreBest = pastMaxScore !== null && currentNorm > pastMaxScore;

        const { data: streakRow } = await supabase
          .from("streaks")
          .select("current_streak, longest_streak")
          .eq("user_id", user.id)
          .maybeSingle();

        const currentStreak = streakRow?.current_streak ?? 1;
        const longestStreak = streakRow?.longest_streak ?? 1;
        const isStreakBest = currentStreak > 1 && currentStreak >= longestStreak;

        if (isScoreBest || isStreakBest) {
          personalBests = {
            isScoreBest,
            previousScoreBest: pastMaxScore,
            newScore: currentNorm,
            isStreakBest,
            newStreak: currentStreak,
          };
        }
      } catch (scoreErr: any) {
        console.error("Failed to compute daily score or diagnose pattern:", (scoreErr as any)?.message || String(scoreErr));
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
      isRandomOrder: session.is_random_order,
      learningPatternBadge,
      personalBests,
    });
  } catch (err: any) {
    console.error("Complete API fatal error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
