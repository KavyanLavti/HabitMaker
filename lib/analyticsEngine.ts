import { HabitCompletion } from '@/store/habitStore';
import { LedgerEntry } from '@/store/pointStore';

export function getConsistencyScore(
  habitId: string,
  completions: HabitCompletion[],
  daysSinceCreation: number
): number {
  if (!daysSinceCreation) return 0;
  const unique = new Set(
    completions
      .filter((c) => c.habitId === habitId)
      .map((c) => c.completedAt.slice(0, 10))
  ).size;
  return Math.min(100, Math.round((unique / daysSinceCreation) * 100));
}

export function getWeeklyPointTotals(
  ledger: LedgerEntry[],
  weeks = 8
): { week: string; points: number }[] {
  const result: { week: string; points: number }[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const points = ledger
      .filter((e) => {
        const d = e.createdAt.slice(0, 10);
        return e.amount > 0 && d >= startStr && d <= endStr;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    result.push({ week: startStr, points: Math.round(points) });
  }
  return result;
}

export function getDailyPointTotals(
  ledger: LedgerEntry[],
  days = 30
): { date: string; points: number }[] {
  const result: { date: string; points: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const points = ledger
      .filter((e) => e.amount > 0 && e.createdAt.slice(0, 10) === dateStr)
      .reduce((sum, e) => sum + e.amount, 0);
    result.push({ date: dateStr, points: Math.round(points) });
  }
  return result;
}

export function getHeatmapData(
  completions: HabitCompletion[],
  days = 90
): Record<string, number> {
  const map: Record<string, number> = {};
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    map[d.toISOString().slice(0, 10)] = 0;
  }

  for (const c of completions) {
    const d = c.completedAt.slice(0, 10);
    if (d in map) map[d]++;
  }
  return map;
}

export function getMissPatternInsights(
  habitId: string,
  habitName: string,
  completions: HabitCompletion[],
  days = 60
): string | null {
  const dayCounts: number[] = Array(7).fill(0);
  const dayMisses: number[] = Array(7).fill(0);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dow = d.getDay();
    dayCounts[dow]++;
    const ds = d.toISOString().slice(0, 10);
    const done = completions.some(
      (c) => c.habitId === habitId && c.completedAt.slice(0, 10) === ds
    );
    if (!done) dayMisses[dow]++;
  }

  let worstDay = -1;
  let worstRate = 0;
  for (let i = 0; i < 7; i++) {
    if (!dayCounts[i]) continue;
    const rate = dayMisses[i] / dayCounts[i];
    if (rate > worstRate) {
      worstRate = rate;
      worstDay = i;
    }
  }

  if (worstDay === -1 || worstRate < 0.4) return null;
  return `You tend to miss "${habitName}" on ${dayNames[worstDay]}s`;
}
