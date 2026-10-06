import { addDaysKey, daysBetweenKeys } from './dates';

export const MAX_FREEZES = 3;
export const DAYS_PER_FREEZE = 2;

export interface StreakState {
  /** Current streak in completed days. Frozen days keep it alive but don't add to it. */
  streak: number;
  /** Freezes banked for this habit, 0..MAX_FREEZES. */
  freezes: number;
  /** Completed days counted toward the next freeze, 0..DAYS_PER_FREEZE-1. */
  towardNextFreeze: number;
  /** Days a freeze was spent on. */
  frozenDays: string[];
}

/**
 * Replays a habit's history day by day (Duolingo-style):
 *  - every DAYS_PER_FREEZE completed days in a row earns one freeze (max MAX_FREEZES)
 *  - a missed day spends a freeze if one is banked, otherwise the streak resets to 0
 *  - today is never counted as missed — it's still in progress
 *
 * Derived purely from completion dates, so it can't drift out of sync with the history and
 * survives backup/restore without extra state.
 */
export function computeStreak(startKey: string, completedKeys: Iterable<string>, today: string): StreakState {
  const done = new Set(completedKeys);
  const state: StreakState = { streak: 0, freezes: 0, towardNextFreeze: 0, frozenDays: [] };

  // Start from the earlier of creation day and first completion (restored data can predate createdAt).
  let start = startKey;
  for (const k of done) if (k < start) start = k;

  const span = daysBetweenKeys(start, today);
  for (let i = 0; i <= span; i++) {
    const day = addDaysKey(start, i);
    if (done.has(day)) {
      state.streak++;
      state.towardNextFreeze++;
      if (state.towardNextFreeze >= DAYS_PER_FREEZE) {
        state.towardNextFreeze = 0;
        if (state.freezes < MAX_FREEZES) state.freezes++;
      }
    } else if (day === today) {
      // In progress — not a miss yet.
    } else if (state.freezes > 0) {
      state.freezes--;
      state.frozenDays.push(day);
    } else {
      state.streak = 0;
      state.towardNextFreeze = 0;
    }
  }
  return state;
}
