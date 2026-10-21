import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHabitStore } from '@/store/habitStore';
import { playFx } from '@/store/fxStore';
import { activeDbName } from './db';
import { addDaysKey, todayKey } from './dates';

/**
 * Freezes are spent implicitly (a missed day just gets covered), so nothing "happens" at the moment of use.
 * This compares each habit's frozen days with the ones already shown and plays the "streak protected"
 * animation for new ones. Call after habits load.
 */
export async function announceNewFreezes() {
  const key = `fx_seen_frozen:${activeDbName()}`; // test mode keeps its own list
  const raw = await AsyncStorage.getItem(key);
  const seen = new Set<string>(raw ? JSON.parse(raw) : []);
  const { habits, getStreakState } = useHabitStore.getState();
  const recent = addDaysKey(todayKey(), -3);

  const saves: { name: string; streak: number }[] = [];
  const all: string[] = [];
  for (const h of habits) {
    const s = getStreakState(h.id);
    let fresh = false;
    for (const d of s.frozenDays) {
      const k = `${h.id}:${d}`;
      all.push(k);
      if (!seen.has(k) && d >= recent) fresh = true;
    }
    if (fresh) saves.push({ name: h.name, streak: s.streak });
  }

  await AsyncStorage.setItem(key, JSON.stringify(all));
  // First run just records what exists, so old history doesn't replay as a burst of animations
  if (raw && saves.length) playFx({ kind: 'frozen', saves });
}
