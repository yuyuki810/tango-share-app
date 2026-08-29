import { SupabaseClient } from '@supabase/supabase-js';
import { getTodayJST } from './dates';
import { HomeStateMachine } from './types';

export async function evaluateHomeState(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeStateMachine> {
  const todayJst = getTodayJST();

  const { data: weeklyRange } = await supabase
    .from('weekly_ranges')
    .select('id, wordbook_id, start_date, end_date')
    .eq('user_id', userId)
    .lte('start_date', todayJst)
    .gte('end_date', todayJst)
    .maybeSingle();

  if (!weeklyRange) {
    return { state: 'no_range' };
  }

  const { count: dueReviewCount } = await supabase
    .from('word_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_in_srs', true)
    .lte('next_review_at', todayJst);

  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('start_number, end_number, is_review_day')
    .eq('user_id', userId)
    .eq('date', todayJst)
    .maybeSingle();

  let unintroducedCount = 0;
  if (assignment && !assignment.is_review_day && assignment.start_number && assignment.end_number) {
    const { data: rangeWords } = await supabase
      .from('words')
      .select('id')
      .eq('wordbook_id', weeklyRange.wordbook_id)
      .gte('number', assignment.start_number)
      .lte('number', assignment.end_number);

    if (rangeWords && rangeWords.length > 0) {
      const wordIds = rangeWords.map((w) => w.id);
      const { data: progressWords } = await supabase
        .from('word_progress')
        .select('word_id')
        .eq('user_id', userId)
        .in('word_id', wordIds);

      const progressWordIds = new Set(progressWords?.map((p) => p.word_id) || []);
      unintroducedCount = wordIds.filter((id) => !progressWordIds.has(id)).length;
    }
  }

  const reviewDueTotal = dueReviewCount || 0;
  const newCandidateCount = Math.min(unintroducedCount, 20);
  const sessionCount = Math.min(reviewDueTotal + newCandidateCount, 20);

  const { count: todayIntroducedCount } = await supabase
    .from('daily_new_words')
    .select('word_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('date', todayJst);

  const { data: dailyCheckSession } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'daily_check')
    .gte('created_at', `${todayJst}T00:00:00+09:00`)
    .lte('created_at', `${todayJst}T23:59:59+09:00`)
    .maybeSingle();

  const dailyCheckDone = !!dailyCheckSession;
  const introducedCount = todayIntroducedCount || 0;

  const { data: streakRow } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', userId)
    .maybeSingle();

  if (sessionCount > 0) {
    return {
      state: 'review_due',
      sessionCount,
      dueReviewCount: reviewDueTotal,
      todayNewCount: newCandidateCount,
    };
  }

  if (introducedCount > 0 && !dailyCheckDone) {
    return {
      state: 'daily_check_due',
      count: introducedCount,
    };
  }

  const { count: remainingAssignments } = await supabase
    .from('daily_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('date', todayJst)
    .eq('is_review_day', false);

  return {
    state: 'completed',
    streak: streakRow?.current_streak || 0,
    longestStreak: streakRow?.longest_streak || 0,
    hasAheadContent: (remainingAssignments || 0) > 0,
  };
}
