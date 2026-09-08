import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { updateStreak } from '@/lib/streak/updateStreak';
import { updateWordCorrectStreaks } from '@/lib/streak/updateWordCorrectStreaks';
import { computeAndSaveDailyScore } from '@/lib/scoring/computeDailyScore';
import { diagnoseLearningPattern } from '@/lib/scoring/diagnoseLearningPattern';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: authError?.message || 'ログインユーザーが見つかりません' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sessionId, results } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const today = getTodayJST();

    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .select('id, user_id, date, type, completed_at, is_random_order')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
        .from('test_answers')
        .select('word_id')
        .eq('session_id', sessionId);

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
        await supabase.from('test_answers').insert(missingAnswers);
      }
    }

    const { data: allAnswers } = await supabase
      .from('test_answers')
      .select('word_id, is_known, origin_daily_assignment_id')
      .eq('session_id', sessionId);

    const answerList = allAnswers ?? [];
    const correctCount = answerList.filter((a) => a.is_known).length;
    const totalCount = answerList.length;

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('test_sessions')
      .update({
        completed_at: nowIso,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update test_sessions:', updateError);
      return NextResponse.json(
        { error: 'Failed to finalize session', detail: updateError.message },
        { status: 500 }
      );
    }

    try {
      await updateStreak(supabase, user.id, today);
    } catch (streakErr: any) {
      console.error('Failed to update streak:', (streakErr as any)?.message || String(streakErr));
    }

    try {
      await updateWordCorrectStreaks(
        supabase,
        user.id,
        answerList.map((a) => ({ wordId: a.word_id, isKnown: a.is_known })),
        today
      );
    } catch (wordStreakErr: any) {
      console.error('Failed to update word correct streaks:', (wordStreakErr as any)?.message || String(wordStreakErr));
    }

    let computedScore: any = null;
    let learningPatternBadge: any = null;

    if (session.type === 'daily_check') {
      try {
        const { data: assignment } = await supabase
          .from('daily_assignments')
          .select('range_start, range_end')
          .eq('user_id', user.id)
          .eq('date', today)
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
            .from('daily_score_entries')
            .update({
              normalized_score: bonusScore,
              random_bonus_applied: true,
            })
            .eq('user_id', user.id)
            .eq('date', today);

          computedScore.normalizedScore = bonusScore;
          computedScore.randomBonusApplied = true;
        }

        learningPatternBadge = await diagnoseLearningPattern(
          supabase,
          user.id,
          today,
          targetWordCount
        );
      } catch (scoreErr: any) {
        console.error('Failed to compute daily score or diagnose pattern:', (scoreErr as any)?.message || String(scoreErr));
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
    });
  } catch (err: any) {
    console.error('Complete API fatal error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
