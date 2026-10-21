import { create } from 'zustand';

/** Full-screen "System" celebrations. Queued so several events (clear + freeze + level up) play in turn. */
export type FxEvent =
  | { kind: 'cleared'; title: string; points: number; streak: number; bonuses: string[]; freezeEarned: boolean; avoid: boolean }
  | { kind: 'frozen'; saves: { name: string; streak: number }[] }
  | { kind: 'levelup'; level: number; rankFrom: string; rankTo: string }
  | { kind: 'slip'; name: string; freezes: number };

interface FxStore {
  queue: FxEvent[];
  push: (e: FxEvent) => void;
  shift: () => void;
}

export const useFxStore = create<FxStore>((set) => ({
  queue: [],
  push: (e) => set((s) => ({ queue: [...s.queue, e] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

export const playFx = (e: FxEvent) => useFxStore.getState().push(e);
