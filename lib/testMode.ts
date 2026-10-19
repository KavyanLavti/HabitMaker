// Test mode: a sandbox for trying the app across simulated days.
//  - Works on a copy of your data in a separate database file, so nothing real changes.
//  - Shifts the app clock (lib/clock) so streaks, freezes, windows and the bank roll over as if days passed.
//  - Real alarms, notifications and gate limits are frozen while it's on (see setSystemGuardSandbox).
// Exiting deletes the copy and returns to real data and real time.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setClockOffset } from './clock';
import { REAL_DB, TEST_DB, switchDatabase, deleteDatabase } from './db';
import { buildBackup, restoreFromBackup } from './dataExport';
import { reloadAll } from './reload';
import { setSystemGuardSandbox } from '@/modules/system-guard';

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

interface TestModeState {
  enabled: boolean;
  offsetMs: number;
}

export const useTestMode = create<TestModeState>()(
  persist((): TestModeState => ({ enabled: false, offsetMs: 0 }), {
    name: 'test-mode',
    storage: createJSONStorage(() => AsyncStorage),
  })
);

async function hydrated() {
  if (useTestMode.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = useTestMode.persist.onFinishHydration(() => { unsub(); resolve(); });
  });
}

/** Call once at startup, before any store loads, so a running test session resumes on the sandbox. */
export async function initTestMode() {
  await hydrated();
  const { enabled, offsetMs } = useTestMode.getState();
  if (!enabled) return;
  await switchDatabase(TEST_DB);
  setSystemGuardSandbox(true);
  setClockOffset(offsetMs);
}

/** Copies the real data into the sandbox and switches to it. Also used to restart from a fresh copy. */
export async function enterTestMode() {
  if (useTestMode.getState().enabled) await switchDatabase(REAL_DB);
  const snapshot = await buildBackup();
  setSystemGuardSandbox(true);
  await switchDatabase(TEST_DB, { fresh: true });
  await restoreFromBackup(JSON.stringify(snapshot));
  setClockOffset(0);
  useTestMode.setState({ enabled: true, offsetMs: 0 });
  await reloadAll();
}

export async function exitTestMode() {
  await switchDatabase(REAL_DB);
  setClockOffset(0);
  useTestMode.setState({ enabled: false, offsetMs: 0 });
  setSystemGuardSandbox(false);
  await deleteDatabase(TEST_DB);
  await reloadAll(); // also re-syncs the real gate config; reminders re-sync when habits reload
}

/** Moves the simulated clock. Negative values go back in time. */
export async function shiftClock(ms: number) {
  if (!useTestMode.getState().enabled) return;
  const offsetMs = useTestMode.getState().offsetMs + ms;
  setClockOffset(offsetMs);
  useTestMode.setState({ offsetMs });
  await reloadAll();
}

export async function resetClock() {
  await shiftClock(-useTestMode.getState().offsetMs);
}
