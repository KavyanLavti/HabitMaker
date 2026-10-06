import { HabitCompletion } from '@/store/habitStore';
import { LedgerEntry } from '@/store/pointStore';
import { addDaysKey, dateKeyOf, daysBetweenKeys, todayKey } from '@/lib/dates';

/** % of days since creation on which the habit was done. */
export function getConsistencyScore(completions: HabitCompletion[], createdAt: string): number {
  const days = Math.max(1, daysBetweenKeys(dateKeyOf(createdAt), todayKey()) + 1);
  const unique = new Set(completions.map((c) => dateKeyOf(c.completedAt))).size;
  return Math.min(100, Math.round((unique / days) * 100));
}

/** Points earned per day (positive entries only), oldest first. */
export function getDailyPointTotals(ledger: LedgerEntry[], days = 14): { date: string; points: number }[] {
  const today = todayKey();
  const totals: Record<string, number> = {};
  for (const e of ledger) {
    if (e.amount <= 0) continue;
    const k = dateKeyOf(e.createdAt);
    totals[k] = (totals[k] ?? 0) + e.amount;
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysKey(today, i - days + 1);
    return { date, points: Math.round(totals[date] ?? 0) };
  });
}

/** Completions per day for the last `days` days, oldest first. */
export function getHeatmap(completions: HabitCompletion[], days = 84): { date: string; count: number }[] {
  const today = todayKey();
  const counts: Record<string, number> = {};
  for (const c of completions) {
    const k = dateKeyOf(c.completedAt);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysKey(today, i - days + 1);
    return { date, count: counts[date] ?? 0 };
  });
}

/** "You tend to miss X on Mondays" when one weekday is missed 40%+ of the time over the last 60 days. */
export function getMissPatternInsight(habitName: string, completions: HabitCompletion[], createdAt: string, days = 60): string | null {
  const done = new Set(completions.map((c) => dateKeyOf(c.completedAt)));
  const start = dateKeyOf(createdAt);
  const today = todayKey();
  const seen = Array(7).fill(0);
  const missed = Array(7).fill(0);
  for (let i = 1; i <= days; i++) {
    const k = addDaysKey(today, -i);
    if (k < start) break;
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
