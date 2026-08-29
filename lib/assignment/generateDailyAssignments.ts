import { getWeekDates } from './weekDates';

export type DayType = 'learn' | 'review' | 'off';

export interface DayScheduleConfig {
  dayIndex: number; // 0=土, 1=日, 2=月, 3=火, 4=水, 5=木, 6=金
  type: DayType;
}

export interface DailyAssignmentRow {
  user_id: string;
  wordbook_id: string;
  date: string; // YYYY-MM-DD
  range_start: number;
  range_end: number;
  is_review_day: boolean;
}

export interface GenerateAssignmentParams {
  userId: string;
  wordbookId: string;
  weekStartDate: string; // 土曜日の日付 YYYY-MM-DD
  rangeStart: number;
  wordsPerDay: number;
  patternType?: '5_2' | '4_3' | 'custom';
  customDays?: DayType[]; // 長さ7の配列 (土〜金)
  maxWordsLimit?: number; // 単語帳の total_words
}

/**
 * 週間計画から各曜日の割当(daily_assignments)を生成する
 */
export function generateDailyAssignmentRows(
  params: GenerateAssignmentParams
): { rows: DailyAssignmentRow[]; calculatedRangeEnd: number; totalWords: number } {
  const {
    userId,
    wordbookId,
    weekStartDate,
    rangeStart,
    wordsPerDay,
    patternType = '5_2',
    customDays,
    maxWordsLimit = Infinity,
  } = params;

  const weekDates = getWeekDates(weekStartDate);

  // 曜日ごとのタイプ決定 (土〜金)
  let dayTypes: DayType[] = ['learn', 'learn', 'learn', 'learn', 'learn', 'review', 'review'];

  if (patternType === '4_3') {
    dayTypes = ['learn', 'learn', 'learn', 'learn', 'review', 'review', 'review'];
  } else if (patternType === 'custom' && customDays && customDays.length === 7) {
    dayTypes = customDays;
  }

  const rows: DailyAssignmentRow[] = [];
  let currentStart = rangeStart;
  const learnDayIndices: number[] = [];

  // 1. 新規学習日の割り当て
  dayTypes.forEach((type, index) => {
    if (type === 'learn') {
      learnDayIndices.push(index);
      const start = currentStart;
      let end = start + wordsPerDay - 1;
      if (end > maxWordsLimit) {
        end = maxWordsLimit;
      }
      if (start <= maxWordsLimit) {
        rows.push({
          user_id: userId,
          wordbook_id: wordbookId,
          date: weekDates[index],
          range_start: start,
          range_end: end,
          is_review_day: false,
        });
      }
      currentStart = end + 1;
    }
  });

  const calculatedRangeEnd = Math.min(
    maxWordsLimit,
    Math.max(rangeStart, currentStart - 1)
  );
  const totalWords = Math.max(0, calculatedRangeEnd - rangeStart + 1);

  // 2. 復習日の割り当て（今週進んだ範囲全体を復習）
  dayTypes.forEach((type, index) => {
    if (type === 'review' && totalWords > 0) {
      rows.push({
        user_id: userId,
        wordbook_id: wordbookId,
        date: weekDates[index],
        range_start: rangeStart,
        range_end: calculatedRangeEnd,
        is_review_day: true,
      });
    }
  });

  // 日付順にソート
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return { rows, calculatedRangeEnd, totalWords };
}
