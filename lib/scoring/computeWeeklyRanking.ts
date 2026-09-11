export interface WeeklyMemberRankingItem {
  userId: string;
  name: string;
  wordbookName?: string;
  weeklyScore: number;
  totalRawScore: number;
  daysAttended: number;
  avgAccuracyRate: number | null;
  dailyScores: Array<{ date: string; score: number; attended: boolean }>;
}

interface ScoreEntryRow {
  user_id: string;
  date: string;
  normalized_score: number;
  raw_score: number;
  accuracy_rate: number;
  word_count: number;
}

export function computeWeeklyRanking(params: {
  members: Array<{ id: string; name: string; wordbooks?: any }>;
  weekDates: string[];
  scoreEntries: ScoreEntryRow[];
}): WeeklyMemberRankingItem[] {
  const { members, weekDates, scoreEntries } = params;

  const entryMap = new Map<string, ScoreEntryRow>();
  for (const entry of scoreEntries) {
    entryMap.set(`${entry.user_id}_${entry.date}`, entry);
  }

  const rankingList: WeeklyMemberRankingItem[] = members.map((member) => {
    let sumNormalized = 0;
    let sumRaw = 0;
    let attendedCount = 0;
    let sumAccuracy = 0;

    const dailyScores = weekDates.map((date) => {
      const entry = entryMap.get(`${member.id}_${date}`);
      if (entry) {
        sumNormalized += Number(entry.normalized_score ?? 0);
        sumRaw += Number(entry.raw_score ?? 0);
        attendedCount += 1;
        sumAccuracy += Number(entry.accuracy_rate ?? 0);
        return { date, score: entry.normalized_score, attended: true };
      } else {
        return { date, score: 0, attended: false };
      }
    });

    const weeklyScore = Math.round(sumNormalized / 7);
    const totalRawScore = Math.round(sumRaw * 100) / 100;
    const avgAccuracyRate = attendedCount > 0
      ? Math.round((sumAccuracy / attendedCount) * 100)
      : null;

    const wbName = (member.wordbooks as { name?: string } | null)?.name;

    return {
      userId: member.id,
      name: member.name,
      wordbookName: wbName,
      weeklyScore,
      totalRawScore,
      daysAttended: attendedCount,
      avgAccuracyRate,
      dailyScores,
    };
  });

  rankingList.sort((a, b) => {
    if (b.weeklyScore !== a.weeklyScore) {
      return b.weeklyScore - a.weeklyScore;
    }
    if (b.totalRawScore !== a.totalRawScore) {
      return b.totalRawScore - a.totalRawScore;
    }
    return b.daysAttended - a.daysAttended;
  });

  return rankingList;
}
