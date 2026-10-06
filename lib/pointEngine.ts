import { Settings } from '@/store/settingsStore';

export interface PointResult {
  base: number;
  streakMultiplier: number;
  total: number;
  streakDays: number;
}

export function calculateEarnedPoints(basePoints: number, streakDays: number, settings: Settings): PointResult {
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

export function isPerfectDay(habitIds: string[], completedTodayIds: string[]): boolean {
  if (!habitIds.length) return false;
  return habitIds.every((id) => completedTodayIds.includes(id));
}

/** Perfect days in a row ending today (or yesterday, if today isn't perfect yet). */
export function getConsecutivePerfectDays(
  habitIds: string[],
  completionsByDate: Record<string, string[]>,
  dayKeys: string[] // most recent first, starting with today
): number {
  let count = 0;
  for (let i = 0; i < dayKeys.length; i++) {
    if (isPerfectDay(habitIds, completionsByDate[dayKeys[i]] ?? [])) count++;
    else if (i === 0) continue; // today still in progress
    else break;
  }
  return count;
}
