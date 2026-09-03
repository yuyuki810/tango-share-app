import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailyScoreEntryData {
  user_id: string;
  date: string;
  raw_score: number;
  normalized_score: number;
  word_count: number;
  accuracy_rate: number;
  avg_difficulty_weight: number;
  avg_diminishing_factor: number;
}

export interface ArchetypeResult {
  key: string;
  badgeLabel: string;
  title: string;
  message: string;
  colorClass: string;
}

/**
 * メンバーのスコア系アーキタイプをインメモリで同期判定する (N+1ネットワーク遅延を完全解消)
 */
export function determineArchetype(
  targetUserId: string,
  allGroupEntriesForDate: DailyScoreEntryData[],
  recentScoresForUser: number[] = []
): ArchetypeResult | null {
  const self = allGroupEntriesForDate.find((e) => e.user_id === targetUserId);
  if (!self) return null;

  // 1. ゾンビ・グリット型 (物量突破)
  if (self.normalized_score >= 85 && (self.accuracy_rate ?? 0) < 0.65) {
    return {
      key: 'zombie_grit',
      badgeLabel: '物量突破',
      title: 'ゾンビ・グリット型',
      message: '正解の数で押し切った、物量の勝利。',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    };
  }

  // 2. レジェンド・コレクター型 (高難度制覇)
  if (
    (self.accuracy_rate ?? 0) >= 0.9 &&
    (self.avg_difficulty_weight ?? 0) >= 1.2 &&
    (self.word_count ?? 0) >= 15
  ) {
    return {
      key: 'legend_collector',
      badgeLabel: '高難度制覇',
      title: 'レジェンド・コレクター型',
      message: '手強い単語だけを、高精度で撃破。',
      colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    };
  }

  // 3. パーフェクト・スナイパー型 (精密無比)
  if (
    (self.accuracy_rate ?? 0) >= 0.95 &&
    self.normalized_score < 55 &&
    (self.word_count ?? 0) >= 5
  ) {
    return {
      key: 'perfect_sniper',
      badgeLabel: '精密無比',
      title: 'パーフェクト・スナイパー型',
      message: '少数精鋭、狙った的を外さない。',
      colorClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    };
  }

  // 4. タイブレーク・チャンピオン型 (僅差の覇者)
  const tiedOthers = allGroupEntriesForDate.filter(
    (e) => e.user_id !== targetUserId && e.normalized_score === self.normalized_score
  );
  if (tiedOthers.length > 0) {
    const maxOtherRaw = Math.max(...tiedOthers.map((e) => Number(e.raw_score ?? 0)));
    if (Number(self.raw_score) > maxOtherRaw) {
      return {
        key: 'tiebreak_champion',
        badgeLabel: '僅差の覇者',
        title: 'タイブレーク・チャンピオン型',
        message: '同着の中身で、一歩リード。',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    }
  }

  // 5. 急成長型 (自己ベスト更新)
  if (recentScoresForUser.length >= 3) {
    const sum = recentScoresForUser.reduce((acc, score) => acc + score, 0);
    const avg = sum / recentScoresForUser.length;
    if (self.normalized_score - avg >= 20) {
      return {
        key: 'rapid_growth',
        badgeLabel: '自己ベスト更新',
        title: '急成長型',
        message: '直近の自分を、大きく更新。',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-300',
      };
    }
  }

  return null;
}
