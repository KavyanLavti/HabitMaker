import { create } from 'zustand';
import { runQuery, runMutation, newId } from '@/lib/db';
import { nowIso } from '@/lib/clock';
import { SetRow } from '@/lib/gymAnalytics';

export interface Exercise {
  id: string;
  name: string;
  createdAt: string;
}

export type WorkoutSet = SetRow & { createdAt: string };

interface GymStore {
  loaded: boolean;
  exercises: Exercise[];
  sets: WorkoutSet[];
  loadGym: () => Promise<void>;
  /** Returns the existing exercise when the name already exists (case-insensitive). */
  addExercise: (name: string) => Promise<Exercise>;
  renameExercise: (id: string, name: string) => Promise<void>;
  addSet: (date: string, exerciseId: string, reps: number, weightKg: number) => Promise<void>;
  updateSet: (id: string, changes: { reps?: number; weightKg?: number }) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  removeExerciseFromDay: (date: string, exerciseId: string) => Promise<void>;
}

export const useGymStore = create<GymStore>((set, get) => ({
  loaded: false,
  exercises: [],
  sets: [],

  loadGym: async () => {
    const [exercises, sets] = await Promise.all([
      runQuery<Exercise>('SELECT * FROM exercises ORDER BY name COLLATE NOCASE ASC'),
      runQuery<WorkoutSet>('SELECT * FROM workout_sets ORDER BY date ASC, setIndex ASC'),
    ]);
    set({ exercises, sets, loaded: true });
  },

  addExercise: async (name) => {
    const clean = name.trim().replace(/\s+/g, ' ');
    const existing = get().exercises.find((e) => e.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const ex: Exercise = { id: newId(), name: clean, createdAt: nowIso() };
    await runMutation('INSERT INTO exercises (id,name,createdAt) VALUES (?,?,?)', [ex.id, ex.name, ex.createdAt]);
    set((s) => ({ exercises: [...s.exercises, ex].sort((a, b) => a.name.localeCompare(b.name)) }));
    return ex;
  },

  renameExercise: async (id, name) => {
    await runMutation('UPDATE exercises SET name=? WHERE id=?', [name.trim(), id]);
    set((s) => ({ exercises: s.exercises.map((e) => (e.id === id ? { ...e, name: name.trim() } : e)) }));
  },

  addSet: async (date, exerciseId, reps, weightKg) => {
    const sameDay = get().sets.filter((s) => s.date === date && s.exerciseId === exerciseId);
    const row: WorkoutSet = {
      id: newId(), date, exerciseId, reps, weightKg, createdAt: nowIso(),
      setIndex: sameDay.length ? Math.max(...sameDay.map((s) => s.setIndex)) + 1 : 0,
    };
    await runMutation(
      'INSERT INTO workout_sets (id,date,exerciseId,setIndex,reps,weightKg,createdAt) VALUES (?,?,?,?,?,?,?)',
      [row.id, row.date, row.exerciseId, row.setIndex, row.reps, row.weightKg, row.createdAt]
    );
    set((s) => ({ sets: [...s.sets, row] }));
  },

  updateSet: async (id, changes) => {
    const cur = get().sets.find((s) => s.id === id);
    if (!cur) return;
    const next = { ...cur, ...changes };
    await runMutation('UPDATE workout_sets SET reps=?, weightKg=? WHERE id=?', [next.reps, next.weightKg, id]);
    set((s) => ({ sets: s.sets.map((x) => (x.id === id ? next : x)) }));
  },

  deleteSet: async (id) => {
    await runMutation('DELETE FROM workout_sets WHERE id=?', [id]);
    set((s) => ({ sets: s.sets.filter((x) => x.id !== id) }));
  },

  removeExerciseFromDay: async (date, exerciseId) => {
    await runMutation('DELETE FROM workout_sets WHERE date=? AND exerciseId=?', [date, exerciseId]);
    set((s) => ({ sets: s.sets.filter((x) => !(x.date === date && x.exerciseId === exerciseId)) }));
  },
}));
