import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  // Streak multipliers
  streakMult3: number;
  streakMult7: number;
  streakMult30: number;
  // Completion bonus
  completionBonusPct: number;
  // Level
  pointsPerLevel: number;
  // Combo bonuses
  perfectDayBonus: number;
  onFireBonus: number;
  unstoppableBonus: number;
  // Penalty thresholds per urgency level (misses/week)
  penaltyThreshold4: number;
  penaltyThreshold3: number;
  penaltyThreshold12: number;
  penaltyPct: number;
  // Decay
  decayPct: number;
  decayTriggerDays: number;
  // Notifications
  notifyMinutesBefore: number;
  notificationsEnabled: boolean;
  // Profile
  displayName: string;
  lastOpenedAt: string;
}

interface SettingsStore {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetAll: () => void;
}

const defaults: Settings = {
  streakMult3: 1.1,
  streakMult7: 1.25,
  streakMult30: 1.5,
  completionBonusPct: 15,
  pointsPerLevel: 500,
  perfectDayBonus: 50,
  onFireBonus: 100,
  unstoppableBonus: 200,
  penaltyThreshold4: 2,
  penaltyThreshold3: 3,
  penaltyThreshold12: 4,
  penaltyPct: 10,
  decayPct: 5,
  decayTriggerDays: 3,
  notifyMinutesBefore: 10,
  notificationsEnabled: true,
  displayName: 'Forge Master',
  lastOpenedAt: new Date().toISOString(),
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaults,
      updateSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),
      resetAll: () => set({ settings: defaults }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
