// Pure gym maths: estimated 1-rep max, volume, PRs and trends. No React/storage imports (unit tested).
import { addDaysKey, weekStartKey } from './dates';

export interface SetRow {
  id: string;
  date: string; // YYYY-MM-DD
  exerciseId: string;
  setIndex: number;
  reps: number;
  weightKg: number;
}

/** Epley estimate of the weight you could lift once. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export const setVolume = (s: Pick<SetRow, 'reps' | 'weightKg'>) => s.reps * s.weightKg;

const chrono = (a: SetRow, b: SetRow) => a.date.localeCompare(b.date) || a.setIndex - b.setIndex;

/** Ids of sets that beat every earlier set of the same exercise on estimated 1RM (the first set ever counts). */
export function prSetIds(sets: SetRow[]): Set<string> {
  const best: Record<string, number> = {};
  const prs = new Set<string>();
  for (const s of [...sets].sort(chrono)) {
    const e = estimate1RM(s.weightKg, s.reps);
    if (e <= 0) continue;
    if (e > (best[s.exerciseId] ?? 0)) {
      best[s.exerciseId] = e;
      prs.add(s.id);
    }
  }
  return prs;
}

export interface ExerciseSession {
  date: string;
  sets: number;
  volume: number;
  topWeight: number;
  best1RM: number;
}

export interface ExerciseStats {
  exerciseId: string;
  sessions: ExerciseSession[]; // oldest first
  bestWeight: number;
  best1RM: number;
  totalVolume: number;
  lastDate: string | null;
}

export function exerciseStats(sets: SetRow[], exerciseId: string): ExerciseStats {
  const byDate: Record<string, ExerciseSession> = {};
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue;
    const d = (byDate[s.date] ??= { date: s.date, sets: 0, volume: 0, topWeight: 0, best1RM: 0 });
    d.sets++;
    d.volume += setVolume(s);
    d.topWeight = Math.max(d.topWeight, s.weightKg);
    d.best1RM = Math.max(d.best1RM, estimate1RM(s.weightKg, s.reps));
  }
  const sessions = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  return {
    exerciseId,
    sessions,
    bestWeight: Math.max(0, ...sessions.map((s) => s.topWeight)),
    best1RM: Math.max(0, ...sessions.map((s) => s.best1RM)),
    totalVolume: sessions.reduce((n, s) => n + s.volume, 0),
    lastDate: sessions.length ? sessions[sessions.length - 1].date : null,
  };
}

/**
 * Total kg lifted per calendar week (Monday → Sunday), oldest first. The last entry is the current week
 * so far.
 */
export function weeklyVolume(sets: SetRow[], today: string, weeks = 8): { start: string; end: string; volume: number }[] {
  const thisWeek = weekStartKey(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDaysKey(thisWeek, -(weeks - 1 - i) * 7);
    const end = addDaysKey(start, 6);
    const volume = sets.filter((s) => s.date >= start && s.date <= end).reduce((n, s) => n + setVolume(s), 0);
    return { start, end, volume };
  });
}

/** Distinct days with at least one set between `from` and `to` (inclusive). */
export function workoutDaysBetween(sets: SetRow[], from: string, to: string): number {
  return new Set(sets.filter((s) => s.date >= from && s.date <= to).map((s) => s.date)).size;
}

/** Workout days in the current calendar week (since Monday). */
export const workoutDaysThisWeek = (sets: SetRow[], today: string) => workoutDaysBetween(sets, weekStartKey(today), today);

/** Workout days in the current calendar month. */
export const workoutDaysThisMonth = (sets: SetRow[], today: string) => workoutDaysBetween(sets, today.slice(0, 8) + '01', today);

/** Exercise ids ordered by how recently they were used (most recent first), then by name order given. */
export function recentExerciseOrder(sets: SetRow[]): string[] {
  const last: Record<string, string> = {};
  for (const s of sets) if (!last[s.exerciseId] || s.date > last[s.exerciseId]) last[s.exerciseId] = s.date;
  return Object.keys(last).sort((a, b) => last[b].localeCompare(last[a]));
}
