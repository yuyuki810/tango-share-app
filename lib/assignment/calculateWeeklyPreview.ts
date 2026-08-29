import { resolveDayTypes, CYCLE_DAY_LABELS, type CycleType, type DayType } from './cycleTypes';

export interface PreviewDay {
  date: string; // YYYY-MM-DD
  dayLabel: string; // '土' など
  type: DayType;
  rangeStart: number | null;
  rangeEnd: number | null;
}

export interface WeeklyPreviewResult {
  days: PreviewDay[];
  newDaysCount: number;
  totalNewWords: number;
  calculatedEnd: number;
  isOverflow: boolean;
}

function getCycleWeekDates(weekStartDateSaturday: string): string[] {
  const [y, m, d] = weekStartDateSaturday.split('-').map(Number);
  const saturday = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(saturday);
    dt.setUTCDate(saturday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

export function calculateWeeklyPreview(params: {
  weekStartDate: string; // 今週の土曜日
  rangeStart: number;
  perDayCount: number;
  cycleType: CycleType;
  customDayTypes?: DayType[];
  wordbookTotalWords: number;
}): WeeklyPreviewResult {
  const { weekStartDate, rangeStart, perDayCount, cycleType, customDayTypes, wordbookTotalWords } =
    params;
  const dayTypes = resolveDayTypes(cycleType, customDayTypes);
  const weekDates = getCycleWeekDates(weekStartDate);

  const newDaysCount = dayTypes.filter((t) => t === 'new').length;
  const totalNewWords = newDaysCount * perDayCount;
  const calculatedEnd = rangeStart + totalNewWords - 1;

  const days: PreviewDay[] = [];
  let cursor = rangeStart;

  dayTypes.forEach((type, i) => {
    if (type === 'new') {
      const start = cursor;
      const end = cursor + perDayCount - 1;
      days.push({ date: weekDates[i], dayLabel: CYCLE_DAY_LABELS[i], type, rangeStart: start, rangeEnd: end });
      cursor = end + 1;
    } else if (type === 'review') {
      days.push({
        date: weekDates[i],
        dayLabel: CYCLE_DAY_LABELS[i],
        type,
        rangeStart: newDaysCount > 0 ? rangeStart : null,
        rangeEnd: newDaysCount > 0 ? calculatedEnd : null,
      });
    } else {
      days.push({ date: weekDates[i], dayLabel: CYCLE_DAY_LABELS[i], type, rangeStart: null, rangeEnd: null });
    }
  });

  return {
    days,
    newDaysCount,
    totalNewWords,
    calculatedEnd,
    isOverflow: calculatedEnd > wordbookTotalWords,
  };
}
