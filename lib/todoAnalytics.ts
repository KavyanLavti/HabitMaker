// Pure to-do maths: how much of what you planned for a day you actually finished. Unit tested.
import { addDaysKey, weekStartKey } from './dates';

export interface TodoRow {
  date: string;
  points: number;
  done: boolean;
}

export interface DayTodo {
  date: string;
  total: number;
  done: number;
  pointsPlanned: number;
  pointsEarned: number;
  /** 0..1, or null when nothing was planned that day */
  rate: number | null;
}

export function dayStats(todos: TodoRow[], date: string): DayTodo {
  const items = todos.filter((t) => t.date === date);
  const done = items.filter((t) => t.done);
  return {
    date,
    total: items.length,
    done: done.length,
    pointsPlanned: items.reduce((n, t) => n + t.points, 0),
    pointsEarned: done.reduce((n, t) => n + t.points, 0),
    rate: items.length ? done.length / items.length : null,
  };
}

/** Each day of the calendar week (Monday → Sunday) containing `today`. */
export function weekStats(todos: TodoRow[], today: string): DayTodo[] {
  const monday = weekStartKey(today);
  return Array.from({ length: 7 }, (_, i) => dayStats(todos, addDaysKey(monday, i)));
}

/** Combined completion over several days, counting only days that had a plan. */
export function overallRate(days: DayTodo[]): number | null {
  const total = days.reduce((n, d) => n + d.total, 0);
  return total ? days.reduce((n, d) => n + d.done, 0) / total : null;
}

/**
 * Days in a row (ending today, or yesterday while today is unfinished) where every planned item was
 * done. Days with no plan are skipped rather than breaking the run.
 */
export function fullClearStreak(todos: TodoRow[], today: string, lookback = 60): number {
  let run = 0;
  for (let i = 0; i < lookback; i++) {
    const d = dayStats(todos, addDaysKey(today, -i));
    if (d.rate == null) continue;
    if (d.rate === 1) run++;
    else if (i === 0) continue; // today still in progress
    else break;
  }
  return run;
}
