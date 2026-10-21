import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runQuery, runMutation, activeDbName, REAL_DB } from '@/lib/db';
import { addDaysKey, todayKey } from '@/lib/dates';
import { Busy, Conflict, SchedHabit, Slot, findConflicts, plannedSlot } from '@/lib/scheduling';
import {
  CalendarInfo, SYNC_DAYS, fetchBusy, hasCalendarPermission, isNoiseCalendar, listCalendars,
  removeAllHabitEvents, requestCalendarPermission, writeHabitEvents,
} from '@/lib/calendarSync';
import { useHabitStore } from '@/store/habitStore';

export type Overrides = Record<string, Record<string, string | null>>; // habitId → date → "HH:MM"

interface ScheduleState {
  // Persisted (this device's calendar choices)
  calendarEnabled: boolean;
  habitCalendarId: string | null;
  /** Calendars whose events don't count as conflicts. Null until first connect (then noise calendars are added). */
  ignoredCalendarIds: string[] | null;
  /** Conflicts already shown in the pop-up ("habitId|date"). */
  seenConflicts: string[];

  // Runtime
  calendars: CalendarInfo[];
  busyByDate: Record<string, Busy[]>;
  overrides: Overrides;
  conflicts: Conflict[];
  syncing: boolean;
  /** A refresh was requested while one was running; run once more after it. */
  again: boolean;
  lastError: string | null;
  lastSyncAt: number | null;

  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setHabitCalendar: (id: string) => Promise<void>;
  toggleIgnored: (id: string) => Promise<void>;
  /** Reloads overrides, busy times and conflicts, then rewrites the habit events. */
  refresh: () => Promise<void>;
  setOverride: (habitId: string, date: string, time: string | null) => Promise<void>;
  clearOverride: (habitId: string, date: string) => Promise<void>;
  markConflictsSeen: (keys: string[]) => void;
}

export const conflictKey = (c: { habitId: string; date: string }) => `${c.habitId}|${c.date}`;

function schedHabits(): SchedHabit[] {
  return useHabitStore.getState().habits.map((h) => ({
    id: h.id, name: h.name, scheduleType: h.scheduleType, scheduledTime: h.scheduledTime,
    windowEnd: h.windowEnd, dailyDurationMinutes: h.dailyDurationMinutes,
  }));
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      calendarEnabled: false,
      habitCalendarId: null,
      ignoredCalendarIds: null,
      seenConflicts: [],
      calendars: [],
      busyByDate: {},
      overrides: {},
      conflicts: [],
      syncing: false,
      again: false,
      lastError: null,
      lastSyncAt: null,

      connect: async () => {
        if (!(await requestCalendarPermission())) {
          set({ lastError: 'Calendar permission was denied.' });
          return false;
        }
        const calendars = await listCalendars();
        set({
          calendars,
          calendarEnabled: true,
          ignoredCalendarIds: get().ignoredCalendarIds ?? calendars.filter(isNoiseCalendar).map((c) => c.id),
          // Pick a calendar literally named HabitForge if the user already created one
          habitCalendarId:
            get().habitCalendarId ??
            calendars.find((c) => c.writable && c.isGoogle && /habit\s*forge/i.test(c.title))?.id ?? null,
        });
        await get().refresh();
        return true;
      },

      disconnect: async () => {
        try { await removeAllHabitEvents(); } catch {}
        set({ calendarEnabled: false, busyByDate: {}, conflicts: [] });
      },

      setHabitCalendar: async (id) => {
        if (id === get().habitCalendarId) return;
        // Move upcoming events: remove from the old calendar, the refresh writes them to the new one
        try { await removeAllHabitEvents(); } catch {}
        set({ habitCalendarId: id });
        await get().refresh();
      },

      toggleIgnored: async (id) => {
        const cur = get().ignoredCalendarIds ?? [];
        set({ ignoredCalendarIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
        await get().refresh();
      },

      refresh: async () => {
        // Never run two syncs at once: they would both create the same calendar events
        if (get().syncing) { set({ again: true }); return; }
        set({ syncing: true, lastError: null });
        try {
          const today = todayKey();
          // Overrides live in the database so they're backed up with everything else
          const rows = await runQuery<{ habitId: string; date: string; time: string | null }>(
            'SELECT * FROM habit_overrides WHERE date >= ?', [addDaysKey(today, -1)]
          );
          const overrides: Overrides = {};
          for (const r of rows) (overrides[r.habitId] ??= {})[r.date] = r.time;
          set({ overrides });

          const { calendarEnabled, habitCalendarId } = get();
          if (!calendarEnabled || !(await hasCalendarPermission())) {
            set({ busyByDate: {}, conflicts: [] });
            return;
          }

          const calendars = await listCalendars();
          const ignored = new Set(get().ignoredCalendarIds ?? []);
          const sourceIds = calendars.filter((c) => c.id !== habitCalendarId && !ignored.has(c.id)).map((c) => c.id);
          const busyByDate = await fetchBusy(sourceIds, today, SYNC_DAYS);
          const dates = Array.from({ length: SYNC_DAYS }, (_, i) => addDaysKey(today, i));
          const habits = schedHabits();
          const conflicts = findConflicts(habits, dates, busyByDate, overrides);

          // Never write the real Google calendar from test mode's sandbox
          if (habitCalendarId && activeDbName() === REAL_DB) {
            const slots: Record<string, Record<string, Slot | null>> = {};
            for (const h of habits) {
              slots[h.id] = {};
              for (const d of dates) slots[h.id][d] = plannedSlot(h, busyByDate[d] ?? [], overrides[h.id]?.[d]);
            }
            await writeHabitEvents(habitCalendarId, habits, slots);
          }
          set({ calendars, busyByDate, conflicts, lastSyncAt: Date.now() });
        } catch (e: any) {
          set({ lastError: e?.message ?? String(e) });
        } finally {
          set({ syncing: false });
          if (get().again) { set({ again: false }); await get().refresh(); }
        }
      },

      setOverride: async (habitId, date, time) => {
        await runMutation('INSERT OR REPLACE INTO habit_overrides (habitId,date,time) VALUES (?,?,?)', [habitId, date, time]);
        await get().refresh();
      },

      clearOverride: async (habitId, date) => {
        await runMutation('DELETE FROM habit_overrides WHERE habitId=? AND date=?', [habitId, date]);
        await get().refresh();
      },

      markConflictsSeen: (keys) => set({ seenConflicts: [...new Set([...get().seenConflicts, ...keys])].slice(-200) }),
    }),
    {
      name: 'schedule-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        calendarEnabled: s.calendarEnabled,
        habitCalendarId: s.habitCalendarId,
        ignoredCalendarIds: s.ignoredCalendarIds,
        seenConflicts: s.seenConflicts,
      }),
    }
  )
);

/** Today's planned start for a habit, honouring a one-day override. */
export function todaysTime(habitId: string, fallback: string | null, overrides: Overrides): string | null {
  return overrides[habitId]?.[todayKey()] ?? fallback;
}
