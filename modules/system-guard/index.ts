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
  /** One-day changes: "YYYY-MM-DD" → minutes after midnight (-1 = no alert that day). */
  overrides?: Record<string, number>;
}

export interface GateDebug {
  /** When Android last connected the gate service (epoch ms, 0 = never). */
  connectedAt: number;
  /** Last foreground app the service saw, and when. */
  lastPkg: string;
  lastAt: number;
  configDate: string;
  configEnabled: boolean;
  configApps: string[];
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
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getGateDebug(): string;
  isGateServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  openAppDetails(): void;
  getLaunchableApps(): LaunchableApp[];
}

// Null in Expo Go / web: the custom Android build is required for these features.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeSystemGuard>('SystemGuard') : null;

export const isSystemGuardAvailable = native != null;

// In test mode the app runs on a copy of your data with a simulated clock. Real alarms, notifications
// and gate limits must not change because of that, so writes are dropped while sandboxed.
let sandboxed = false;
export function setSystemGuardSandbox(on: boolean) {
  sandboxed = on;
}
const live = () => (sandboxed ? null : native);

export const SystemGuard = {
  setReminders: (specs: ReminderSpec[]) => live()?.setReminders(JSON.stringify(specs)),
  markHandled: (id: string) => live()?.markHandled(id),
  clearHandled: (id: string) => live()?.clearHandled(id),
  snoozeReminder: (id: string, atMillis: number) => live()?.snoozeReminder(id, atMillis),
  showTimer: (id: string, name: string, endAt: number) => native?.showTimer(id, name, endAt),
  cancelTimer: () => native?.cancelTimer(),
  notificationsEnabled: () => native?.notificationsEnabled() ?? false,
  canScheduleExactAlarms: () => native?.canScheduleExactAlarms() ?? false,
  openExactAlarmSettings: () => native?.openExactAlarmSettings(),

  setGateConfig: (config: GateConfig) => live()?.setGateConfig(JSON.stringify(config)),
  /** Milliseconds in each leisure app on `date` (YYYY-MM-DD). */
  getUsage: (date: string): Record<string, number> => {
    if (!native) return {};
    try { return JSON.parse(native.getUsage(date)); } catch { return {}; }
  },
  hasUsageAccess: () => native?.hasUsageAccess() ?? false,
  openUsageAccessSettings: () => native?.openUsageAccessSettings(),
  getGateDebug: (): GateDebug | null => {
    if (!native) return null;
    try { return JSON.parse(native.getGateDebug()); } catch { return null; }
  },
  isGateServiceEnabled: () => native?.isGateServiceEnabled() ?? false,
  openAccessibilitySettings: () => native?.openAccessibilitySettings(),
  openAppDetails: () => native?.openAppDetails(),
  getLaunchableApps: (): LaunchableApp[] => native?.getLaunchableApps() ?? [],
};
