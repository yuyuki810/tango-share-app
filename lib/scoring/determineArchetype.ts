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
 * メンバーのスコア系アーキタイプを判定する (優先順位順に評価)
 * 1. ゾンビ・グリット型 (物量突破)
 * 2. レジェンド・コレクター型 (高難度制覇)
 * 3. パーフェクト・スナイパー型 (精密無比)
 * 4. タイブレーク・チャンピオン型 (僅差の覇者)
 * 5. 急成長型 (自己ベスト更新)
 */
export async function determineArchetype(
  supabase: SupabaseClient,
  targetUserId: string,
  date: string,
  allGroupEntriesForDate: DailyScoreEntryData[]
): Promise<ArchetypeResult | null> {
  const self = allGroupEntriesForDate.find((e) => e.user_id === targetUserId);
  if (!self) return null;

  // 1. ゾンビ・グリット型 (物量突破)
  // normalized_score >= 85 かつ accuracy_rate < 0.65
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
  // accuracy_rate >= 0.9 かつ avg_difficulty_weight >= 1.2 かつ word_count >= 15
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
  // accuracy_rate >= 0.95 かつ normalized_score < 55 かつ word_count >= 5
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
  // 同日・同groupで normalized_score が同点の他メンバーが存在し、そのメンバー達の raw_score の最大値より自分の raw_score が厳密に大きい
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
  // 対象日より前の直近5件の daily_score_entries の normalized_score 平均と比べ、今日が +20 以上 (直近データ3件以上の場合のみ判定)
  const { data: recentScores } = await supabase
    .from('daily_score_entries')
    .select('normalized_score')
    .eq('user_id', targetUserId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(5);

  if (recentScores && recentScores.length >= 3) {
    const sum = recentScores.reduce((acc, r) => acc + (r.normalized_score ?? 0), 0);
    const avg = sum / recentScores.length;
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
