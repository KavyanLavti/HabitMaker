import * as Notifications from 'expo-notifications';
import { Habit } from '@/store/habitStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleHabitNotification(
  habit: Habit,
  minutesBefore: number
): Promise<string | null> {
  if (!habit.scheduledTime) return null;

  const [h, m] = habit.scheduledTime.split(':').map(Number);
  const triggerMinutes = h * 60 + m - minutesBefore;
  if (triggerMinutes < 0) return null;

  const triggerHour = Math.floor(triggerMinutes / 60);
  const triggerMin = triggerMinutes % 60;

  await cancelHabitNotification(habit.id);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'HabitForge',
      body: `Time to start: ${habit.name}`,
      data: { habitId: habit.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: triggerHour,
      minute: triggerMin,
    },
  });

  return id;
}

export async function cancelHabitNotification(habitId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.habitId === habitId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}
