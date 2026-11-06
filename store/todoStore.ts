import { create } from 'zustand';
import { runQuery, runMutation, newId } from '@/lib/db';
import { nowIso } from '@/lib/clock';
import { todayKey } from '@/lib/dates';
import { usePointStore } from '@/store/pointStore';
import { playFx } from '@/store/fxStore';
import { dayStats, fullClearStreak } from '@/lib/todoAnalytics';

export interface Todo {
  id: string;
  date: string;
  title: string;
  points: number;
  done: boolean;
  doneAt: string | null;
  /** Points entry created when checked, removed when unchecked. */
  ledgerId: string | null;
  createdAt: string;
}

interface TodoStore {
  todos: Todo[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (title: string, points: number, date?: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Copies a day's unfinished items onto today (the originals stay as they were, for honest stats). */
  carryOver: (fromDate: string) => Promise<number>;
}

const rowToTodo = (r: any): Todo => ({ ...r, done: Boolean(r.done), doneAt: r.doneAt ?? null, ledgerId: r.ledgerId ?? null });

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  loaded: false,

  load: async () => {
    const rows = await runQuery<any>('SELECT * FROM todos ORDER BY date ASC, createdAt ASC');
    set({ todos: rows.map(rowToTodo), loaded: true });
  },

  add: async (title, points, date = todayKey()) => {
    const t: Todo = {
      id: newId(), date, title: title.trim(), points: Math.max(0, Math.round(points)),
      done: false, doneAt: null, ledgerId: null, createdAt: nowIso(),
    };
    await runMutation(
      'INSERT INTO todos (id,date,title,points,done,doneAt,ledgerId,createdAt) VALUES (?,?,?,?,0,NULL,NULL,?)',
      [t.id, t.date, t.title, t.points, t.createdAt]
    );
    set((s) => ({ todos: [...s.todos, t] }));
  },

  toggle: async (id) => {
    const t = get().todos.find((x) => x.id === id);
    if (!t) return;
    const points = usePointStore.getState();
    let next: Todo;
    if (!t.done) {
      const entry = t.points > 0
        ? await points.addEntry({ habitId: null, type: 'todo', amount: t.points, reason: `To-do: ${t.title}` })
        : null;
      next = { ...t, done: true, doneAt: nowIso(), ledgerId: entry?.id ?? null };
    } else {
      if (t.ledgerId) await points.removeEntry(t.ledgerId);
      next = { ...t, done: false, doneAt: null, ledgerId: null };
    }
    await runMutation('UPDATE todos SET done=?, doneAt=?, ledgerId=? WHERE id=?', [next.done ? 1 : 0, next.doneAt, next.ledgerId, id]);
    set((s) => ({ todos: s.todos.map((x) => (x.id === id ? next : x)) }));

    // Finishing the last item of the day gets the full celebration
    const day = dayStats(get().todos, t.date);
    if (next.done && t.date === todayKey() && day.total > 1 && day.done === day.total) {
      playFx({
        kind: 'cleared',
        title: "TODAY'S TO-DO LIST",
        points: day.pointsEarned,
        streak: fullClearStreak(get().todos, todayKey()),
        bonuses: [],
        freezeEarned: false,
        avoid: false,
      });
    }
  },

  remove: async (id) => {
    const t = get().todos.find((x) => x.id === id);
    if (t?.ledgerId) await usePointStore.getState().removeEntry(t.ledgerId);
    await runMutation('DELETE FROM todos WHERE id=?', [id]);
    set((s) => ({ todos: s.todos.filter((x) => x.id !== id) }));
  },

  carryOver: async (fromDate) => {
    const left = get().todos.filter((t) => t.date === fromDate && !t.done);
    const today = todayKey();
    const existing = new Set(get().todos.filter((t) => t.date === today).map((t) => t.title.toLowerCase()));
    let n = 0;
    for (const t of left) {
      if (existing.has(t.title.toLowerCase())) continue;
      await get().add(t.title, t.points, today);
      n++;
    }
    return n;
  },
}));
