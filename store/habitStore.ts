import { create } from 'zustand';
import { runQuery, runMutation } from '@/lib/db';

export interface Habit {
  id: string;
  name: string;
  urgencyLevel: 1 | 2 | 3 | 4;
  pointsPerCompletion: number;
  dailyDurationMinutes: number;
  scheduledTime: string | null;
  totalDays: number | null;
  isDaily: boolean;
  createdAt: string;
  archivedAt: string | null;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedAt: string;
  durationMinutes: number;
  timerUsed: boolean;
}

interface HabitStore {
  habits: Habit[];
  completions: HabitCompletion[];
  loaded: boolean;
  loadAll: () => Promise<void>;
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'archivedAt'>) => Promise<Habit>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addCompletion: (c: Omit<HabitCompletion, 'id'>) => Promise<HabitCompletion>;
  getCompletionsForHabit: (habitId: string, since?: string) => HabitCompletion[];
  isCompletedToday: (habitId: string) => boolean;
  getStreakCount: (habitId: string) => number;
  getCompletionCount: (habitId: string) => number;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  completions: [],
  loaded: false,

  loadAll: async () => {
    const habits = await runQuery<Habit>(
      'SELECT * FROM habits WHERE archivedAt IS NULL ORDER BY scheduledTime ASC'
    );
    const completions = await runQuery<HabitCompletion>(
      'SELECT * FROM habit_completions ORDER BY completedAt DESC'
    );
    const mapped = completions.map((c) => ({
      ...c,
      timerUsed: Boolean((c as any).timerUsed),
    }));
    set({ habits, completions: mapped, loaded: true });
  },

  addHabit: async (data) => {
    const habit: Habit = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      archivedAt: null,
    };
    await runMutation(
      `INSERT INTO habits (id,name,urgencyLevel,pointsPerCompletion,dailyDurationMinutes,
       scheduledTime,totalDays,isDaily,createdAt,archivedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        habit.id, habit.name, habit.urgencyLevel, habit.pointsPerCompletion,
        habit.dailyDurationMinutes, habit.scheduledTime, habit.totalDays,
        habit.isDaily ? 1 : 0, habit.createdAt, null,
      ]
    );
    set((s) => ({ habits: [...s.habits, habit] }));
    return habit;
  },

  updateHabit: async (id, updates) => {
    const cols = Object.keys(updates).map((k) => `${k}=?`).join(',');
    const vals = [...Object.values(updates), id] as (string | number | null)[];
    await runMutation(`UPDATE habits SET ${cols} WHERE id=?`, vals);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    }));
  },

  archiveHabit: async (id) => {
    const archivedAt = new Date().toISOString();
    await runMutation('UPDATE habits SET archivedAt=? WHERE id=?', [archivedAt, id]);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  },

  deleteHabit: async (id) => {
    await runMutation('DELETE FROM habit_completions WHERE habitId=?', [id]);
    await runMutation('DELETE FROM habits WHERE id=?', [id]);
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      completions: s.completions.filter((c) => c.habitId !== id),
    }));
  },

  addCompletion: async (data) => {
    const c: HabitCompletion = { ...data, id: uuid() };
    await runMutation(
      `INSERT INTO habit_completions (id,habitId,completedAt,durationMinutes,timerUsed)
       VALUES (?,?,?,?,?)`,
      [c.id, c.habitId, c.completedAt, c.durationMinutes, c.timerUsed ? 1 : 0]
    );
    set((s) => ({ completions: [c, ...s.completions] }));
    return c;
  },

  getCompletionsForHabit: (habitId, since) => {
    const all = get().completions.filter((c) => c.habitId === habitId);
    if (!since) return all;
    return all.filter((c) => c.completedAt >= since);
  },

  isCompletedToday: (habitId) => {
    const today = new Date().toISOString().slice(0, 10);
    return get().completions.some(
      (c) => c.habitId === habitId && c.completedAt.slice(0, 10) === today
    );
  },

  getCompletionCount: (habitId) => {
    return get().completions.filter((c) => c.habitId === habitId).length;
  },

  getStreakCount: (habitId) => {
    const completions = get().completions
      .filter((c) => c.habitId === habitId)
      .map((c) => c.completedAt.slice(0, 10))
      .sort()
      .reverse();
    if (!completions.length) return 0;
    const dates = [...new Set(completions)];
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (const d of dates) {
      const cursorStr = cursor.toISOString().slice(0, 10);
      if (d === cursorStr) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  },
}));
