import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey } from '@/lib/dates';

/** Today's snoozed-to times, so cards can show "SNOOZED → 18:30". Ignored once the day changes. */
interface SnoozeStore {
  date: string;
  until: Record<string, string>; // habitId → "HH:MM"
  setUntil: (habitId: string, hhmm: string) => void;
}

export const useSnoozeStore = create<SnoozeStore>()(
  persist(
    (set, get) => ({
      date: todayKey(),
      until: {},
      setUntil: (habitId, hhmm) => {
        const today = todayKey();
        const until = get().date === today ? get().until : {};
        set({ date: today, until: { ...until, [habitId]: hhmm } });
      },
    }),
    { name: 'snooze-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Selector: the snoozed-to time for a habit today, or null. */
export const snoozedUntil = (habitId: string) => (s: SnoozeStore) =>
  s.date === todayKey() ? s.until[habitId] ?? null : null;
