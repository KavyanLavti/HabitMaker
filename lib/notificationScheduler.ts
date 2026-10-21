import { PermissionsAndroid, Platform } from 'react-native';
import { SystemGuard, ReminderSpec } from '@/modules/system-guard';
import { parseHHMM } from '@/lib/dates';
import type { Habit } from '@/store/habitStore';
import type { Settings } from '@/store/settingsStore';

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 33) return true;
  const res = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/** When a habit's daily alert should fire, in minutes after midnight. Any-time habits have none. */
export function reminderMinutes(habit: Habit, settings: Settings): number | null {
  const start = parseHHMM(habit.scheduledTime);
  if (start == null || habit.scheduleType === 'anytime') return null;
  if (habit.scheduleType === 'window' || habit.scheduleType === 'avoid') return start;
  return Math.max(0, start - settings.notifyMinutesBefore);
}

function body(habit: Habit): string {
  if (habit.scheduleType === 'avoid') {
    return 'Evening check-in: did you stay clean today? Tap START to check in. This alert stays until you choose.';
  }
  const when =
    habit.scheduleType === 'window' && habit.windowEnd
      ? `Window ${habit.scheduledTime}–${habit.windowEnd}`
      : `Scheduled ${habit.scheduledTime}`;
  return `${when} · ${habit.dailyDurationMinutes} min. Start now or snooze — this alert stays until you choose.`;
}

/**
 * Hands the full reminder list to the native scheduler. The native side keeps rescheduling daily
 * (and after reboots) on its own, so this only needs to run when habits or settings change.
 */
export function syncReminders(
  habits: Habit[],
  settings: Settings,
  completedTodayIds: string[],
  /** habitId → date → "HH:MM" (null = no alert that day), from the schedule store */
  dayOverrides: Record<string, Record<string, string | null>> = {}
) {
  const specs: ReminderSpec[] = !settings.notificationsEnabled
    ? []
    : habits.flatMap((h) => {
        const minutes = reminderMinutes(h, settings);
        if (minutes == null) return [];
        const lead = h.scheduleType === 'fixed' ? settings.notifyMinutesBefore : 0;
        const overrides: Record<string, number> = {};
        for (const [date, t] of Object.entries(dayOverrides[h.id] ?? {})) {
          const m = parseHHMM(t);
          overrides[date] = m == null ? -1 : Math.max(0, m - lead);
        }
        return [{ id: h.id, title: h.name, body: body(h), minutes, overrides }];
      });
  SystemGuard.setReminders(specs);
  completedTodayIds.forEach((id) => SystemGuard.markHandled(id));
}
