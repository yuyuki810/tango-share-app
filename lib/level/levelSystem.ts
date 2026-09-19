export interface LevelInfo {
  level: number;
  currentExp: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercentage: number;
}

export function calculateLevel(totalExp: number = 0): LevelInfo {
  let level = 1;
  let expRemaining = Math.max(0, totalExp);
  let expForNext = 50;

  while (expRemaining >= expForNext && level < 99) {
    expRemaining -= expForNext;
    level += 1;
    expForNext = 50 + (level - 1) * 25;
  }

  const progressPercentage = Math.min(100, Math.round((expRemaining / expForNext) * 100));

  return {
    level,
    currentExp: totalExp,
    currentLevelExp: expRemaining,
    nextLevelExp: expForNext,
    progressPercentage,
  };
}
