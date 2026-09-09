import type { ChunkStat } from './computeChunkStats';
import { getSaturdayOf, getWeekDates } from '@/lib/assignment/weekDates';

export interface GridDayCell {
  date: string;
  dayLabel: string;
  dayIndex: number;
  chunk: ChunkStat | null;
}

export interface WeekColumnData {
  weekStartDate: string;
  weekEndDate: string;
  monthLabel: string | null;
  isCurrentWeek: boolean;
  days: GridDayCell[];
  totalChunks: number;
  avgAccuracyRate: number | null;
  totalMistakes: number;
  minRangeStart: number | null;
  maxRangeEnd: number | null;
  chunkIds: string[];
}

const DAY_LABELS_SAT = ['土', '日', '月', '火', '水', '木', '金'];

export function buildWeaknessGrid(
  chunks: ChunkStat[],
  todayJst: string
): WeekColumnData[] {
  const currentWeekSat = getSaturdayOf(todayJst);

  let oldestSat = currentWeekSat;
  chunks.forEach((c) => {
    if (c.originDate) {
      const sat = getSaturdayOf(c.originDate);
      if (sat < oldestSat) {
        oldestSat = sat;
      }
    }
  });

  const saturdayList: string[] = [];
  let cursorSat = oldestSat;
  while (cursorSat <= currentWeekSat) {
    saturdayList.push(cursorSat);
    const [y, m, d] = cursorSat.split(-).map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    cursorSat = dt.toISOString().slice(0, 10);
  }

  const chunksByDate = new Map<string, ChunkStat>();
  chunks.forEach((c) => {
    chunksByDate.set(c.originDate, c);
  });

  let previousMonth: number | null = null;

  return saturdayList.map((satDate) => {
    const dates = getWeekDates(satDate);
    const endDate = dates[6];
    const isCurrentWeek = satDate === currentWeekSat;

    const [y, m] = satDate.split(-).map(Number);
    let monthLabel: string | null = null;
    if (previousMonth === null || m !== previousMonth) {
      monthLabel = `${m}月`;
      previousMonth = m;
    }

    const days: GridDayCell[] = dates.map((dateStr, idx) => {
      const chunk = chunksByDate.get(dateStr) ?? null;
      return {
        date: dateStr,
        dayLabel: DAY_LABELS_SAT[idx],
        dayIndex: idx,
        chunk,
      };
    });

    const activeChunks = days.map((d) => d.chunk).filter((c): c is ChunkStat => c !== null);
    const totalChunks = activeChunks.length;

    let avgAccuracyRate: number | null = null;
    let totalMistakes = 0;
    let minRangeStart: number | null = null;
    let maxRangeEnd: number | null = null;
    const chunkIds: string[] = [];

    if (totalChunks > 0) {
      const sumAcc = activeChunks.reduce((acc, c) => acc + c.accuracyRate, 0);
      avgAccuracyRate = Math.round(sumAcc / totalChunks);

      const seenWordIds = new Set<string>();
      activeChunks.forEach((c) => {
        chunkIds.push(c.chunkId);
        c.mistakeWords.forEach((mw) => {
          seenWordIds.add(mw.wordId);
        });
        if (minRangeStart === null || c.rangeStart < minRangeStart) {
          minRangeStart = c.rangeStart;
        }
        if (maxRangeEnd === null || c.rangeEnd > maxRangeEnd) {
          maxRangeEnd = c.rangeEnd;
        }
      });
      totalMistakes = seenWordIds.size;
    }

    return {
      weekStartDate: satDate,
      weekEndDate: endDate,
      monthLabel,
      isCurrentWeek,
      days,
      totalChunks,
      avgAccuracyRate,
      totalMistakes,
      minRangeStart,
      maxRangeEnd,
      chunkIds,
    };
  });
}
