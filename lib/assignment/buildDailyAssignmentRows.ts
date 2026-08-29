import type { PreviewDay } from './calculateWeeklyPreview';

export interface DailyAssignmentRow {
  user_id: string;
  wordbook_id: string;
  date: string;
  range_start: number;
  range_end: number;
  is_review_day: boolean;
}

/** type='off' の日は行を作らない */
export function buildDailyAssignmentRows(
  days: PreviewDay[],
  userId: string,
  wordbookId: string
): DailyAssignmentRow[] {
  return days
    .filter((d) => d.type !== 'off' && d.rangeStart !== null && d.rangeEnd !== null)
    .map((d) => ({
      user_id: userId,
      wordbook_id: wordbookId,
      date: d.date,
      range_start: d.rangeStart as number,
      range_end: d.rangeEnd as number,
      is_review_day: d.type === 'review',
    }));
}
