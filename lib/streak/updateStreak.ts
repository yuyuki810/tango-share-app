import type { SupabaseClient } from '@supabase/supabase-js';
import { getYesterday } from '@/lib/assignment/weekDates';

export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  today: string
): Promise<void> {
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (!streak) {
    await supabase.from('streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    return;
  }

  if (streak.last_active_date === today) return;

  const isConsecutive = streak.last_active_date === getYesterday(today);
  const nextCurrent = isConsecutive ? streak.current_streak + 1 : 1;

  await supabase
    .from('streaks')
    .update({
      current_streak: nextCurrent,
      longest_streak: Math.max(streak.longest_streak, nextCurrent),
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}
