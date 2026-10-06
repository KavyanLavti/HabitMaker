package expo.modules.systemguard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra(Reminders.EXTRA_ID) ?: return
    when (intent.action) {
      Reminders.ACTION_FIRE ->
        Reminders.onFire(ctx, id, intent.getBooleanExtra("fromSnooze", false))
      Reminders.ACTION_SNOOZE -> {
        val minutes = intent.getIntExtra(Reminders.EXTRA_MINUTES, 15)
        Reminders.snoozeUntil(ctx, id, System.currentTimeMillis() + minutes * 60_000L)
      }
      Reminders.ACTION_REPOST -> Reminders.repostIfPending(ctx, id)
      Reminders.ACTION_TIMER_DONE ->
        Reminders.onTimerDone(ctx, id, intent.getStringExtra(Reminders.EXTRA_NAME) ?: "Quest")
    }
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      Reminders.rescheduleAll(ctx)
    }
  }
}
