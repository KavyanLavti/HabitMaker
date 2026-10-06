import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  // Streak multipliers
  streakMult3: number;
  streakMult7: number;
  streakMult30: number;
  // Level
  pointsPerLevel: number;
  // Combo bonuses
  perfectDayBonus: number;
  onFireBonus: number;
  unstoppableBonus: number;
  // Reminders
  notificationsEnabled: boolean;
  /** Fixed-time quests alert this many minutes before their time. */
  notifyMinutesBefore: number;
  // Profile
  displayName: string;
  // Nightly GitHub backup (the token itself lives in SecureStore)
  backupEnabled: boolean;
  backupRepo: string; // "owner/repo"
}

interface SettingsStore {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetAll: () => void;
}

export const defaultSettings: Settings = {
  streakMult3: 1.1,
  streakMult7: 1.25,
  streakMult30: 1.5,
  pointsPerLevel: 500,
  perfectDayBonus: 50,
  onFireBonus: 100,
  unstoppableBonus: 200,
  notificationsEnabled: true,
  notifyMinutesBefore: 0,
  displayName: 'Player',
  backupEnabled: false,
  backupRepo: '',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      // Keeps backup configuration so a reset never silently turns off backups
      resetAll: () => set((s) => ({
        settings: { ...defaultSettings, backupEnabled: s.settings.backupEnabled, backupRepo: s.settings.backupRepo },
      })),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Deep-merge so settings added in new versions get their defaults instead of being undefined
      merge: (persisted, current) => ({
        ...current,
        settings: { ...current.settings, ...((persisted as Partial<SettingsStore>)?.settings ?? {}) },
      }),
    }
  )
);
