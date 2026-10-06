import { create } from 'zustand';
import { runQuery, runMutation, newId } from '@/lib/db';
import { dateKeyOf, todayKey, daysBetweenKeys } from '@/lib/dates';
import { computeStreak, StreakState } from '@/lib/streaks';

export type ScheduleType = 'fixed' | 'window' | 'anytime';

export interface Habit {
  id: string;
  name: string;
  urgencyLevel: 1 | 2 | 3 | 4;
  pointsPerCompletion: number;
  dailyDurationMinutes: number;
  scheduleType: ScheduleType;
  /** Fixed time, or window start, as "HH:MM". Null for any-time habits. */
  scheduledTime: string | null;
  /** Window end "HH:MM", only for window habits. */
  windowEnd: string | null;
  totalDays: number | null;
  isDaily: boolean;
  createdAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export type HabitInput = Omit<Habit, 'id' | 'createdAt' | 'archivedAt' | 'deletedAt'>;

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedAt: string;
  durationMinutes: number;
  timerUsed: boolean;
}

/** Trashed habits are kept this long before being purged for good. */
export const TRASH_DAYS = 30;

interface HabitStore {
  habits: Habit[];
  trash: Habit[];
  completions: HabitCompletion[];
  loaded: boolean;
  loadAll: () => Promise<void>;
  addHabit: (h: HabitInput) => Promise<Habit>;
  updateHabit: (id: string, updates: Partial<HabitInput>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  trashHabit: (id: string) => Promise<void>;
  restoreHabit: (id: string) => Promise<void>;
  purgeHabit: (id: string) => Promise<void>;
  addCompletion: (c: Omit<HabitCompletion, 'id'>) => Promise<HabitCompletion>;
  getCompletionsForHabit: (habitId: string) => HabitCompletion[];
  isCompletedToday: (habitId: string) => boolean;
  getStreakState: (habitId: string) => StreakState;
  getCompletionCount: (habitId: string) => number;
}

function rowToHabit(r: any): Habit {
  return {
    ...r,
    isDaily: Boolean(r.isDaily),
    scheduleType: (r.scheduleType ?? (r.scheduledTime ? 'fixed' : 'anytime')) as ScheduleType,
    windowEnd: r.windowEnd ?? null,
    deletedAt: r.deletedAt ?? null,
  };
}

function toDb(v: unknown): string | number | null {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v as string | number | null;
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  trash: [],
  completions: [],
  loaded: false,

  loadAll: async () => {
    // Purge trash older than TRASH_DAYS
    const rows = (await runQuery<any>('SELECT * FROM habits')).map(rowToHabit);
    const today = todayKey();
    for (const h of rows) {
      if (h.deletedAt && daysBetweenKeys(dateKeyOf(h.deletedAt), today) > TRASH_DAYS) {
        await runMutation('DELETE FROM habit_completions WHERE habitId=?', [h.id]);
        await runMutation('DELETE FROM habits WHERE id=?', [h.id]);
      }
    }
    const all = (await runQuery<any>('SELECT * FROM habits ORDER BY scheduledTime ASC')).map(rowToHabit);
    const completions = (await runQuery<any>('SELECT * FROM habit_completions ORDER BY completedAt DESC'))
      .map((c) => ({ ...c, timerUsed: Boolean(c.timerUsed) }));
    set({
      habits: all.filter((h) => !h.archivedAt && !h.deletedAt),
      trash: all.filter((h) => !!h.deletedAt),
      completions,
      loaded: true,
    });
  },

  addHabit: async (data) => {
    const habit: Habit = { ...data, id: newId(), createdAt: new Date().toISOString(), archivedAt: null, deletedAt: null };
    await runMutation(
      `INSERT INTO habits (id,name,urgencyLevel,pointsPerCompletion,dailyDurationMinutes,
       scheduledTime,totalDays,isDaily,createdAt,archivedAt,scheduleType,windowEnd,deletedAt)
       VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,NULL)`,
      [
        habit.id, habit.name, habit.urgencyLevel, habit.pointsPerCompletion,
        habit.dailyDurationMinutes, habit.scheduledTime, habit.totalDays,
        habit.isDaily ? 1 : 0, habit.createdAt, habit.scheduleType, habit.windowEnd,
      ]
    );
    set((s) => ({ habits: [...s.habits, habit] }));
    return habit;
  },

  updateHabit: async (id, updates) => {
    const keys = Object.keys(updates);
    if (!keys.length) return;
    const cols = keys.map((k) => `${k}=?`).join(',');
    const vals = [...Object.values(updates).map(toDb), id];
    await runMutation(`UPDATE habits SET ${cols} WHERE id=?`, vals);
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)) }));
  },

  archiveHabit: async (id) => {
    await runMutation('UPDATE habits SET archivedAt=? WHERE id=?', [new Date().toISOString(), id]);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  },

  trashHabit: async (id) => {
    const deletedAt = new Date().toISOString();
    await runMutation('UPDATE habits SET deletedAt=? WHERE id=?', [deletedAt, id]);
    set((s) => {
      const h = s.habits.find((x) => x.id === id);
      return {
        habits: s.habits.filter((x) => x.id !== id),
        trash: h ? [{ ...h, deletedAt }, ...s.trash] : s.trash,
      };
    });
  },

  restoreHabit: async (id) => {
    await runMutation('UPDATE habits SET deletedAt=NULL WHERE id=?', [id]);
    set((s) => {
      const h = s.trash.find((x) => x.id === id);
      return {
        trash: s.trash.filter((x) => x.id !== id),
        habits: h ? [...s.habits, { ...h, deletedAt: null }] : s.habits,
      };
    });
  },

  purgeHabit: async (id) => {
    await runMutation('DELETE FROM habit_completions WHERE habitId=?', [id]);
    await runMutation('DELETE FROM habits WHERE id=?', [id]);
    set((s) => ({
      trash: s.trash.filter((h) => h.id !== id),
      completions: s.completions.filter((c) => c.habitId !== id),
    }));
  },

  addCompletion: async (data) => {
    const c: HabitCompletion = { ...data, id: newId() };
    await runMutation(
      `INSERT INTO habit_completions (id,habitId,completedAt,durationMinutes,timerUsed) VALUES (?,?,?,?,?)`,
      [c.id, c.habitId, c.completedAt, c.durationMinutes, c.timerUsed ? 1 : 0]
    );
    set((s) => ({ completions: [c, ...s.completions] }));
    return c;
  },

  getCompletionsForHabit: (habitId) => get().completions.filter((c) => c.habitId === habitId),

  isCompletedToday: (habitId) => {
    const today = todayKey();
    return get().completions.some((c) => c.habitId === habitId && dateKeyOf(c.completedAt) === today);
  },

  getCompletionCount: (habitId) => get().completions.filter((c) => c.habitId === habitId).length,

  getStreakState: (habitId) => {
    const habit = get().habits.find((h) => h.id === habitId) ?? get().trash.find((h) => h.id === habitId);
    const keys = get().completions.filter((c) => c.habitId === habitId).map((c) => dateKeyOf(c.completedAt));
    const start = habit ? dateKeyOf(habit.createdAt) : todayKey();
    return computeStreak(start, keys, todayKey());
  },
}));
