import { addDaysJST } from './dates';

export const FIXED_INTERVAL_TABLE = [0, 1, 3, 7, 14, 30, 90] as const;

export interface SrsCalculationInput {
  stage: number;
  easeFactor: number;
  intervalDays: number;
  correctStreak: number;
  wrongCount: number;
}

export interface SrsCalculationOutput {
  stage: number;
  easeFactor: number;
  intervalDays: number;
  correctStreak: number;
  wrongCount: number;
  nextReviewAt: string;
}

export function calculateSrsUpdate(
  current: SrsCalculationInput,
  isCorrect: boolean,
  todayJst: string
): SrsCalculationOutput {
  let stage = current.stage;
  let easeFactor = current.easeFactor;
  let intervalDays = current.intervalDays;
  let correctStreak = current.correctStreak;
  let wrongCount = current.wrongCount;

  if (isCorrect) {
    stage = Math.min(stage + 1, 6);
    if (stage <= 2) {
      intervalDays = FIXED_INTERVAL_TABLE[stage];
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    easeFactor = Math.min(easeFactor + 0.05, 2.8);
    correctStreak += 1;
  } else {
    stage = Math.max(stage - 2, 0);
    intervalDays = 1;
    easeFactor = Math.max(easeFactor - 0.2, 1.3);
    correctStreak = 0;
    wrongCount += 1;
  }

  easeFactor = Math.round(easeFactor * 100) / 100;
  const calculatedInterval = Math.max(1, Math.round(intervalDays));
  const nextReviewAt = addDaysJST(todayJst, calculatedInterval);

  return {
    stage,
    easeFactor,
    intervalDays: calculatedInterval,
    correctStreak,
    wrongCount,
    nextReviewAt,
  };
}
