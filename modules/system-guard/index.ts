import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export interface LaunchableApp {
  packageName: string;
  label: string;
}

export interface ReminderSpec {
  id: string;
  title: string;
  body: string;
  /** Minutes after midnight, local time. */
  minutes: number;
}

export interface GateConfig {
  date: string;
  enabled: boolean;
  baseMinutes: number;
  apps: { pkg: string; label: string; extraMinutes: number }[];
}

interface NativeSystemGuard {
  setReminders(json: string): void;
  markHandled(id: string): void;
  clearHandled(id: string): void;
  snoozeReminder(id: string, atMillis: number): void;
  showTimer(id: string, name: string, endAt: number): void;
  cancelTimer(): void;
  notificationsEnabled(): boolean;
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
  setGateConfig(json: string): void;
  getUsage(date: string): string;
  isGateServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  openAppDetails(): void;
  getLaunchableApps(): LaunchableApp[];
}

// Null in Expo Go / web: the custom Android build is required for these features.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeSystemGuard>('SystemGuard') : null;

export const isSystemGuardAvailable = native != null;

export const SystemGuard = {
  setReminders: (specs: ReminderSpec[]) => native?.setReminders(JSON.stringify(specs)),
  markHandled: (id: string) => native?.markHandled(id),
  clearHandled: (id: string) => native?.clearHandled(id),
  snoozeReminder: (id: string, atMillis: number) => native?.snoozeReminder(id, atMillis),
  showTimer: (id: string, name: string, endAt: number) => native?.showTimer(id, name, endAt),
  cancelTimer: () => native?.cancelTimer(),
  notificationsEnabled: () => native?.notificationsEnabled() ?? false,
  canScheduleExactAlarms: () => native?.canScheduleExactAlarms() ?? false,
  openExactAlarmSettings: () => native?.openExactAlarmSettings(),

  setGateConfig: (config: GateConfig) => native?.setGateConfig(JSON.stringify(config)),
  /** Milliseconds in each leisure app on `date` (YYYY-MM-DD). */
  getUsage: (date: string): Record<string, number> => {
    if (!native) return {};
    try { return JSON.parse(native.getUsage(date)); } catch { return {}; }
  },
  isGateServiceEnabled: () => native?.isGateServiceEnabled() ?? false,
  openAccessibilitySettings: () => native?.openAccessibilitySettings(),
  openAppDetails: () => native?.openAppDetails(),
  getLaunchableApps: (): LaunchableApp[] => native?.getLaunchableApps() ?? [],
};
