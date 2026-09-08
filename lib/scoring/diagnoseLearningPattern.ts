import type { SupabaseClient } from '@supabase/supabase-js';
import { getDifficultyStages, difficultyWeight, diminishingReturnFactor } from '@/lib/scoring/computeDailyScore';

export interface LearningPatternBadgeResult {
  key: string;
  name: string;
  message: string;
  colorClass: string;
  stats: {
    uniqueWordCount: number;
    correctRate: number;
    avgStage: number;
    combinedNormalizedScore: number;
  };
}

export async function diagnoseLearningPattern(
  supabase: SupabaseClient,
  userId: string,
  todayJst: string,
  targetWordCount: number = 50
): Promise<LearningPatternBadgeResult | null> {
  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('test_sessions')
      .select('id, test_answers(word_id, is_known, created_at)')
      .eq('user_id', userId)
      .eq('date', todayJst);

    if (sessionsError || !sessions || sessions.length === 0) return null;

    const uniqueAnswersMap = new Map<string, boolean>();
    for (const s of sessions) {
      const answers = (s as any).test_answers ?? [];
      for (const a of answers) {
        if (!uniqueAnswersMap.has(a.word_id)) {
          uniqueAnswersMap.set(a.word_id, a.is_known);
        }
      }
    }

    const wordIds = Array.from(uniqueAnswersMap.keys());
    const N = wordIds.length;
    if (N === 0) return null;

    const correctCount = Array.from(uniqueAnswersMap.values()).filter(Boolean).length;
    const CorrectRate = correctCount / N;

    const stagesMap = await getDifficultyStages(supabase, userId, wordIds);
    let totalStage = 0;
    let rawScore = 0;

    wordIds.forEach((wordId, index) => {
      const stage = stagesMap.get(wordId) ?? 0;
      totalStage += stage;
      const isKnown = uniqueAnswersMap.get(wordId) ?? false;
      const dWeight = difficultyWeight(stage);
      const dFactor = diminishingReturnFactor(index + 1, targetWordCount);
      if (isKnown) {
        rawScore += dWeight * dFactor;
      }
    });

    const S_avg = totalStage / N;
    const NormalizedScore = Math.min(100, Math.round((rawScore / targetWordCount) * 100));

    const stats = {
      uniqueWordCount: N,
      correctRate: Math.round(CorrectRate * 100) / 100,
      avgStage: Math.round(S_avg * 10) / 10,
      combinedNormalizedScore: NormalizedScore,
    };

    // #1. 精鋭チャレンジャー型: S_avg < 1.0 ∧ CorrectRate ≥ 0.9 ∧ N ≥ 20
    if (S_avg < 1.0 && CorrectRate >= 0.9 && N >= 20) {
      return {
        key: 'elite_challenger',
        name: '精鋭チャレンジャー型',
        message: '未知の領域を制覇!完璧な挑戦です。',
        colorClass: 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-200',
        stats,
      };
    }

    // #2. 逆転の兆し型: NormalizedScore ≥ 70 ∧ CorrectRate < 0.6
    if (NormalizedScore >= 70 && CorrectRate < 0.6) {
      return {
        key: 'sign_of_comeback',
        name: '逆転の兆し型',
        message: '難問に挑んだ価値あり。スコアが努力を証明。',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200',
        stats,
      };
    }

    // #3. 完璧主義者型: CorrectRate = 1.0 ∧ N ≥ 10
    if (CorrectRate >= 0.999 && N >= 10) {
      return {
        key: 'perfectionist',
        name: '完璧主義者型',
        message: '妥協なき全問正解。その精度が武器になる。',
        colorClass: 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-200',
        stats,
      };
    }

    // #4. 苦闘の開拓者型: S_avg < 1.0 ∧ CorrectRate < 0.5
    if (S_avg < 1.0 && CorrectRate < 0.5) {
      return {
        key: 'struggling_pioneer',
        name: '苦闘の開拓者型',
        message: '難しい単語に果敢に挑戦した証。次は解ける!',
        colorClass: 'bg-rose-50 text-rose-900 border-rose-300 ring-1 ring-rose-200',
        stats,
      };
    }

    // #5. ゾンビ・グリット型: N > 60 ∧ CorrectRate < 0.4
    if (N > 60 && CorrectRate < 0.4) {
      return {
        key: 'zombie_grit',
        name: 'ゾンビ・グリット型',
        message: '圧倒的な演習量!質より量で攻める君は強い。',
        colorClass: 'bg-teal-50 text-teal-900 border-teal-300 ring-1 ring-teal-200',
        stats,
      };
    }

    // #6. 短期集中スプリンター: N < 10 ∧ CorrectRate ≥ 0.9
    if (N < 10 && CorrectRate >= 0.9) {
      return {
        key: 'focus_sprinter',
        name: '短期集中スプリンター',
        message: '集中力が光る!短い時間で着実に前進。',
        colorClass: 'bg-cyan-50 text-cyan-900 border-cyan-300 ring-1 ring-cyan-200',
        stats,
      };
    }

    // #7. 過剰防衛型: S_avg > 5.5 ∧ NormalizedScore < 50
    if (S_avg > 5.5 && NormalizedScore < 50) {
      return {
        key: 'over_defense',
        name: '過剰防衛型',
        message: '復習は十分。そろそろ新しい単語もいかが?',
        colorClass: 'bg-blue-50 text-blue-900 border-blue-300 ring-1 ring-blue-200',
        stats,
      };
    }

    // #8. 復習の達人型: N ≥ 40 ∧ S_avg > 4.0
    if (N >= 40 && S_avg > 4.0) {
      return {
        key: 'master_of_review',
        name: '復習の達人型',
        message: '完璧なメンテナンス。知識の錆を許さない!',
        colorClass: 'bg-purple-50 text-purple-900 border-purple-300 ring-1 ring-purple-200',
        stats,
      };
    }

    return null;
  } catch (err) {
    console.error('Failed to diagnose learning pattern:', err);
    return null;
  }
}
