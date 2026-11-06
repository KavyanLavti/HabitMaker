import { HabitCompletion } from '@/store/habitStore';
import { LedgerEntry } from '@/store/pointStore';
import { addDaysKey, dateKeyOf, todayKey, weekStartKey, isActiveOn } from '@/lib/dates';

/** % of scheduled days (rest days excluded) since creation on which the habit was done. */
export function getConsistencyScore(completions: HabitCompletion[], createdAt: string, activeDays?: number): number {
  const done = new Set(completions.map((c) => c.date));
  const today = todayKey();
  let scheduled = 0;
  let hit = 0;
  for (let d = dateKeyOf(createdAt); d <= today; d = addDaysKey(d, 1)) {
    if (!isActiveOn(activeDays, d)) continue;
    scheduled++;
    if (done.has(d)) hit++;
  }
  return scheduled ? Math.min(100, Math.round((hit / scheduled) * 100)) : 0;
}

/** Points earned per day (positive entries only), oldest first. */
export function getDailyPointTotals(ledger: LedgerEntry[], days = 14): { date: string; points: number }[] {
  const today = todayKey();
  const totals: Record<string, number> = {};
  for (const e of ledger) {
    if (e.amount <= 0) continue;
    const k = e.date;
    totals[k] = (totals[k] ?? 0) + e.amount;
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysKey(today, i - days + 1);
    return { date, points: Math.round(totals[date] ?? 0) };
  });
}

/**
 * Completions per day for the last `weeks` calendar weeks (Monday → Sunday), oldest first, so every
 * group of 7 is one week. Days after today in the current week have count -1.
 */
export function getHeatmap(completions: HabitCompletion[], weeks = 12): { date: string; count: number }[] {
  const today = todayKey();
  const counts: Record<string, number> = {};
  for (const c of completions) counts[c.date] = (counts[c.date] ?? 0) + 1;
  const first = addDaysKey(weekStartKey(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDaysKey(first, i);
    return { date, count: date > today ? -1 : counts[date] ?? 0 };
  });
}

/** "You tend to miss X on Mondays" when one weekday is missed 40%+ of the time over the last 60 days. */
export function getMissPatternInsight(
  habitName: string, completions: HabitCompletion[], createdAt: string, activeDays?: number, days = 60
): string | null {
  const done = new Set(completions.map((c) => c.date));
  const start = dateKeyOf(createdAt);
  const today = todayKey();
  const seen = Array(7).fill(0);
  const missed = Array(7).fill(0);
  for (let i = 1; i <= days; i++) {
    const k = addDaysKey(today, -i);
    if (k < start) break;
    if (!isActiveOn(activeDays, k)) continue; // rest days aren't misses
    const [y, m, d] = k.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    seen[dow]++;
    if (!done.has(k)) missed[dow]++;
  }
  let worst = -1;
  let rate = 0;
  for (let i = 0; i < 7; i++) {
    if (seen[i] < 3) continue;
    const r = missed[i] / seen[i];
    if (r > rate) { rate = r; worst = i; }
  }
  if (worst === -1 || rate < 0.4) return null;
  const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  return `You tend to miss "${habitName}" on ${names[worst]}.`;
}
