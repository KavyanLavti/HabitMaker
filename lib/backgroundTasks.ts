// Must be imported at app start (root layout) so the task is defined before Android wakes it headlessly.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runBackupIfDue } from './backup';

export const BACKUP_TASK = 'habitforge-nightly-backup';

TaskManager.defineTask(BACKUP_TASK, async () => {
  const result = await runBackupIfDue();
  return result === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
});

/**
 * Android decides exactly when background work runs, so the task wakes roughly hourly and only
 * backs up once a day after 2 AM. Opening the app after 2 AM also triggers it.
 */
export async function registerBackgroundTasks() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(BACKUP_TASK))) {
      await BackgroundTask.registerTaskAsync(BACKUP_TASK, { minimumInterval: 60 });
    }
  } catch {
    // Unavailable in Expo Go; the in-app trigger still covers it.
  }
}
