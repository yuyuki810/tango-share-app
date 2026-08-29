import { getWeekDates, DAY_LABELS_SAT } from './weekDates';

export type DayType = 'progress' | 'review' | 'rest';

export interface CalculatedDay {
  date: string;
  dayLabel: string;
  dayType: DayType;
  rangeStart: number | null;
  rangeEnd: number | null;
  wordCount: number;
}

export interface CalculateParams {
  weekStartDate: string;
  startNumber: number;
  wordsPerDay: number;
  pattern: '5-2' | '4-3' | 'custom';
  daySequence?: DayType[];
  totalWords?: number;
}

export function calculateWeeklyAssignments(params: CalculateParams): CalculatedDay[] {
  const { weekStartDate, startNumber, wordsPerDay, pattern, totalWords = 2000 } = params;
  const dates = getWeekDates(weekStartDate);

  let sequence: DayType[] = [];
  if (pattern === '5-2') {
    sequence = ['progress', 'progress', 'progress', 'progress', 'progress', 'review', 'review'];
  } else if (pattern === '4-3') {
    sequence = ['progress', 'progress', 'progress', 'progress', 'review', 'review', 'review'];
  } else {
    sequence = params.daySequence ?? ['progress', 'progress', 'progress', 'progress', 'progress', 'review', 'review'];
  }

  let currentStart = startNumber;
  let weekProgressStart: number | null = null;
  let weekProgressEnd: number | null = null;

  const result: CalculatedDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = dates[i];
    const dayLabel = DAY_LABELS_SAT[i];
    const dayType = sequence[i] ?? 'progress';

    if (dayType === 'progress') {
      const pStart = currentStart;
      const pEnd = Math.min(pStart + wordsPerDay - 1, totalWords);
      const count = pEnd >= pStart ? pEnd - pStart + 1 : 0;

      if (weekProgressStart === null) weekProgressStart = pStart;
      weekProgressEnd = pEnd;
      currentStart = pEnd + 1;

      result.push({
        date,
        dayLabel,
        dayType,
        rangeStart: pStart,
        rangeEnd: pEnd,
        wordCount: count,
      });
    } else if (dayType === 'review') {
      const rStart = weekProgressStart ?? startNumber;
      const rEnd = weekProgressEnd ?? (startNumber + wordsPerDay - 1);
      const count = rEnd >= rStart ? rEnd - rStart + 1 : 0;

      result.push({
        date,
        dayLabel,
        dayType,
        rangeStart: rStart,
        rangeEnd: rEnd,
        wordCount: count,
      });
    } else {
      result.push({
        date,
        dayLabel,
        dayType: 'rest',
        rangeStart: null,
        rangeEnd: null,
        wordCount: 0,
      });
    }
  }

  return result;
}
