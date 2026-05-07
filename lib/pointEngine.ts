import { Settings } from '@/store/settingsStore';
import { HabitCompletion } from '@/store/habitStore';

export interface PointResult {
  base: number;
  streakMultiplier: number;
  total: number;
  streakDays: number;
}

export function calculateEarnedPoints(
  basePoints: number,
  streakDays: number,
  settings: Settings
): PointResult {
  let multiplier = 1;
  if (streakDays >= 30) multiplier = settings.streakMult30;
  else if (streakDays >= 7) multiplier = settings.streakMult7;
  else if (streakDays >= 3) multiplier = settings.streakMult3;

  return {
    base: basePoints,
    streakMultiplier: multiplier,
    total: Math.round(basePoints * multiplier),
    streakDays,
  };
}

export function calculatePenalty(
  weeklyEarned: number,
  missCount: number,
  urgencyLevel: number,
  settings: Settings
): number {
  const threshold =
    urgencyLevel === 4
      ? settings.penaltyThreshold4
      : urgencyLevel === 3
      ? settings.penaltyThreshold3
      : settings.penaltyThreshold12;

  if (missCount <= threshold) return 0;
  return -Math.round((weeklyEarned * settings.penaltyPct) / 100);
}

export function calculateDecayPenalty(
  recentEarned: number,
  daysSinceOpen: number,
  settings: Settings
): number {
  if (daysSinceOpen < settings.decayTriggerDays) return 0;
  return -Math.round((recentEarned * settings.decayPct) / 100);
}

export function getWeeklyMissCount(
  completions: HabitCompletion[],
  totalDaysInWeek: number
): number {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);

  const uniqueDays = new Set(
    completions
      .filter((c) => c.completedAt.slice(0, 10) >= weekStr)
      .map((c) => c.completedAt.slice(0, 10))
  );
  return Math.max(0, totalDaysInWeek - uniqueDays.size);
}

export function isPerfectDay(
  habitIds: string[],
  completedTodayIds: string[]
): boolean {
  if (!habitIds.length) return false;
  return habitIds.every((id) => completedTodayIds.includes(id));
}

export function getConsecutivePerfectDays(
  habitIds: string[],
  completionsByDate: Record<string, string[]>
): number {
  let count = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 30; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const doneIds = completionsByDate[dateStr] ?? [];
    if (isPerfectDay(habitIds, doneIds)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}
