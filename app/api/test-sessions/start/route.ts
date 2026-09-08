import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      type = 'normal',
      dailyAssignmentId = null,
      totalCount = 0,
      wordIds = [],
      isRandomOrder = false,
      forceNew = false,
    } = body;
    const today = getTodayJST();

    if (type === 'daily_check') {
      const { data: completedSession } = await supabase
        .from('test_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('type', 'daily_check')
        .not('completed_at', 'is', null)
        .maybeSingle();

      if (completedSession) {
        return NextResponse.json(
          {
            error: 'Conflict',
            detail: '本日の本番デイリーチェックは既に受験完了しています。',
          },
          { status: 409 }
        );
      }
    }

    if (forceNew) {
      const nowIso = new Date().toISOString();
      await supabase
        .from('test_sessions')
        .update({ completed_at: nowIso })
        .eq('user_id', user.id)
        .eq('type', type)
        .is('completed_at', null);
    } else {
      let incompleteQuery = supabase
        .from('test_sessions')
        .select('id, type, date, total_count, correct_count, created_at, is_random_order')
        .eq('user_id', user.id)
        .eq('type', type)
        .is('completed_at', null);

      if (type === 'daily_check') {
        incompleteQuery = incompleteQuery.eq('date', today);
      }

      const { data: incompleteSession } = await incompleteQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (incompleteSession) {
        const { data: answers } = await supabase
          .from('test_answers')
          .select('word_id, is_known, origin_daily_assignment_id, created_at')
          .eq('session_id', incompleteSession.id)
          .order('created_at', { ascending: true });

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
            mode: 'resume',
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

    const { data: newSession, error: createError } = await supabase
      .from('test_sessions')
      .insert({
        user_id: user.id,
        date: today,
        type: type,
        correct_count: 0,
        total_count: totalCount,
        completed_at: null,
        is_random_order: isRandomOrder,
      })
      .select('id, type, date, total_count, correct_count, created_at, is_random_order')
      .single();

    if (createError || !newSession) {
      if (createError?.code === '23505') {
        return NextResponse.json(
          { error: 'Conflict', detail: '本日のセッションは既に作成されています。' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to start session', detail: createError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'new',
      session: newSession,
      isRandomOrder: !!newSession.is_random_order,
      answeredWords: [],
    });
  } catch (err: any) {
    console.error('Start session error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
