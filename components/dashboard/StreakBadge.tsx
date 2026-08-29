interface StreakBadgeProps {
  currentStreak: number;
}

export function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-1 text-xs font-bold text-ink/70 shadow-sm">
      <span className="text-sm">🔥</span>
      <span>{currentStreak}日連続達成中</span>
    </span>
  );
}
