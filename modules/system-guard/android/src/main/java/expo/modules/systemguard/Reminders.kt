package expo.modules.systemguard

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import java.util.Calendar

internal data class ReminderSpec(val id: String, val title: String, val body: String, val minutes: Int)

/**
 * Quest reminders that can't be swiped away.
 *
 * Each reminder is ongoing + FLAG_NO_CLEAR, and its delete intent re-posts it. Android 14+ lets users swipe
 * ongoing notifications, so the re-post is what actually enforces "Start or Snooze". The reminder only goes
 * away when the quest is started, snoozed, completed or skipped (all of which call [markHandled] or [snoozeUntil]).
 */
internal object Reminders {
  const val CHANNEL = "quest_reminders"
  const val TIMER_CHANNEL = "quest_timer"
  const val ACTION_FIRE = "expo.modules.systemguard.FIRE"
  const val ACTION_SNOOZE = "expo.modules.systemguard.SNOOZE"
  const val ACTION_REPOST = "expo.modules.systemguard.REPOST"
  const val ACTION_TIMER_DONE = "expo.modules.systemguard.TIMER_DONE"
  const val EXTRA_ID = "habitId"
  const val EXTRA_MINUTES = "minutes"
  const val EXTRA_NAME = "name"

  private const val KEY_SPECS = "reminders"
  private const val TIMER_NOTIF_ID = 0x7100
  private const val TIMER_DONE_NOTIF_ID = 0x7101
  private val SYSTEM_BLUE = 0xFF38B6FF.toInt()

  private const val KIND_DAILY = 0
  private const val KIND_SNOOZE_ALARM = 1
  private const val KIND_SNOOZE_BUTTON = 2
  private const val KIND_REPOST = 3
  private const val KIND_START = 4
  private const val KIND_PICK = 5
  private const val KIND_OPEN = 6
  private const val KIND_TIMER = 7

  // ── Specs ────────────────────────────────────────────────────────────────

  fun specs(ctx: Context): List<ReminderSpec> {
    val raw = Prefs.get(ctx).getString(KEY_SPECS, "[]") ?: "[]"
    val arr = try { JSONArray(raw) } catch (e: Exception) { JSONArray() }
    return (0 until arr.length()).map {
      val o = arr.getJSONObject(it)
      ReminderSpec(o.getString("id"), o.getString("title"), o.optString("body", ""), o.getInt("minutes"))
    }
  }

  /** Replaces the full reminder list (called by JS whenever habits change) and reschedules everything. */
  fun setSpecs(ctx: Context, json: String) {
    val old = specs(ctx)
    val am = alarmManager(ctx)
    old.forEach { am.cancel(broadcastPI(ctx, ACTION_FIRE, it.id, KIND_DAILY)) }
    Prefs.get(ctx).edit().putString(KEY_SPECS, json).apply()
    val newIds = specs(ctx).map { it.id }.toSet()
    // Habits that were removed shouldn't leave a stuck notification behind
    old.filter { it.id !in newIds }.forEach { markHandled(ctx, it.id) }
    rescheduleAll(ctx)
  }

  fun rescheduleAll(ctx: Context) {
    ensureChannels(ctx)
    specs(ctx).forEach { scheduleNextDaily(ctx, it) }
  }

  private fun scheduleNextDaily(ctx: Context, spec: ReminderSpec) {
    val cal = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, spec.minutes / 60)
      set(Calendar.MINUTE, spec.minutes % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    if (cal.timeInMillis <= System.currentTimeMillis() || isHandledToday(ctx, spec.id)) {
      cal.add(Calendar.DAY_OF_MONTH, 1)
    }
    setAlarm(ctx, cal.timeInMillis, broadcastPI(ctx, ACTION_FIRE, spec.id, KIND_DAILY))
  }

  // ── Handled state ─────────────────────────────────────────────────────────

  private fun handledKey(id: String) = "handled_$id"

  fun isHandledToday(ctx: Context, id: String): Boolean =
    Prefs.get(ctx).getString(handledKey(id), null) == Prefs.today()

  /** Started, completed or skipped today: remove the reminder and don't show it again today. */
  fun markHandled(ctx: Context, id: String) {
    Prefs.get(ctx).edit().putString(handledKey(id), Prefs.today()).apply()
    alarmManager(ctx).cancel(broadcastPI(ctx, ACTION_FIRE, id, KIND_SNOOZE_ALARM))
    NotificationManagerCompat.from(ctx).cancel(notifId(id))
  }

  /** Clears the handled flag, e.g. when a completion is undone. */
  fun clearHandled(ctx: Context, id: String) {
    Prefs.get(ctx).edit().remove(handledKey(id)).apply()
  }

  // ── Firing, snoozing, re-posting ─────────────────────────────────────────

  fun onFire(ctx: Context, id: String, fromSnooze: Boolean) {
    val spec = specs(ctx).find { it.id == id } ?: return
    if (!fromSnooze) scheduleNextDaily(ctx, spec) // queue tomorrow's
    if (!isHandledToday(ctx, id)) post(ctx, spec)
  }

  fun snoozeUntil(ctx: Context, id: String, atMillis: Long) {
    NotificationManagerCompat.from(ctx).cancel(notifId(id))
    setAlarm(ctx, atMillis, broadcastPI(ctx, ACTION_FIRE, id, KIND_SNOOZE_ALARM, fromSnooze = true))
  }

  fun repostIfPending(ctx: Context, id: String) {
    if (isHandledToday(ctx, id)) return
    specs(ctx).find { it.id == id }?.let { post(ctx, it) }
  }

  private fun post(ctx: Context, spec: ReminderSpec) {
    ensureChannels(ctx)
    val n = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(R.drawable.ic_system_guard)
      .setColor(SYSTEM_BLUE)
      .setContentTitle("[SYSTEM] Daily Quest: ${spec.title}")
      .setContentText(spec.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(spec.body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(deepLinkPI(ctx, "habitforge://today?quest=${spec.id}", spec.id, KIND_OPEN))
      .setDeleteIntent(broadcastPI(ctx, ACTION_REPOST, spec.id, KIND_REPOST))
      .addAction(0, "▶ START", deepLinkPI(ctx, "habitforge://today?start=${spec.id}", spec.id, KIND_START))
      .addAction(0, "+15 MIN", broadcastPI(ctx, ACTION_SNOOZE, spec.id, KIND_SNOOZE_BUTTON, minutes = 15))
      .addAction(0, "PICK TIME", deepLinkPI(ctx, "habitforge://today?snooze=${spec.id}", spec.id, KIND_PICK))
      .build()
    n.flags = n.flags or Notification.FLAG_NO_CLEAR or Notification.FLAG_ONGOING_EVENT
    notifySafe(ctx, notifId(spec.id), n)
  }

  // ── Quest timer ──────────────────────────────────────────────────────────

  fun showTimer(ctx: Context, id: String, name: String, endAt: Long) {
    ensureChannels(ctx)
    val n = NotificationCompat.Builder(ctx, TIMER_CHANNEL)
      .setSmallIcon(R.drawable.ic_system_guard)
      .setColor(SYSTEM_BLUE)
      .setContentTitle("[QUEST IN PROGRESS] $name")
      .setContentText("Stay on it. The System is watching.")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(endAt)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setContentIntent(deepLinkPI(ctx, "habitforge://today?timer=$id", id, KIND_TIMER))
      .build()
    notifySafe(ctx, TIMER_NOTIF_ID, n)
    NotificationManagerCompat.from(ctx).cancel(TIMER_DONE_NOTIF_ID)
    Prefs.get(ctx).edit().putBoolean("timer_active", true).putString("timer_id", id).apply()
    setAlarm(ctx, endAt, broadcastPI(ctx, ACTION_TIMER_DONE, id, KIND_TIMER, name = name))
  }

  fun cancelTimer(ctx: Context) {
    NotificationManagerCompat.from(ctx).cancel(TIMER_NOTIF_ID)
    val prefs = Prefs.get(ctx)
    prefs.getString("timer_id", null)?.let {
      alarmManager(ctx).cancel(broadcastPI(ctx, ACTION_TIMER_DONE, it, KIND_TIMER))
    }
    prefs.edit().putBoolean("timer_active", false).remove("timer_id").apply()
  }

  fun onTimerDone(ctx: Context, id: String, name: String) {
    if (!Prefs.get(ctx).getBoolean("timer_active", false)) return
    Prefs.get(ctx).edit().putBoolean("timer_active", false).remove("timer_id").apply()
    NotificationManagerCompat.from(ctx).cancel(TIMER_NOTIF_ID)
    val n = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(R.drawable.ic_system_guard)
      .setColor(0xFF2EE6A6.toInt())
      .setContentTitle("[QUEST CLEARED] $name")
      .setContentText("Timer complete. Tap to claim your reward.")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(deepLinkPI(ctx, "habitforge://today?timer=$id", id, KIND_TIMER))
      .build()
    notifySafe(ctx, TIMER_DONE_NOTIF_ID, n)
  }

  // ── Plumbing ─────────────────────────────────────────────────────────────

  fun notifId(id: String) = id.hashCode()

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Quest reminders", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Daily quest alerts with Start and Snooze"
        }
      )
    }
    if (nm.getNotificationChannel(TIMER_CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(TIMER_CHANNEL, "Quest timer", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Countdown while a quest is in progress"
        }
      )
    }
  }

  fun alarmManager(ctx: Context): AlarmManager = ctx.getSystemService(AlarmManager::class.java)

  fun canScheduleExact(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(ctx).canScheduleExactAlarms()

  fun setAlarm(ctx: Context, at: Long, pi: PendingIntent) {
    val am = alarmManager(ctx)
    try {
      if (canScheduleExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
      else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    } catch (e: SecurityException) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
  }

  private fun requestCode(id: String, kind: Int) = "$id#$kind".hashCode()

  private fun broadcastPI(
    ctx: Context, action: String, id: String, kind: Int,
    minutes: Int = 0, fromSnooze: Boolean = false, name: String? = null,
  ): PendingIntent {
    val i = Intent(ctx, ReminderReceiver::class.java).apply {
      this.action = action
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_MINUTES, minutes)
      putExtra("fromSnooze", fromSnooze)
      if (name != null) putExtra(EXTRA_NAME, name)
    }
    return PendingIntent.getBroadcast(
      ctx, requestCode(id, kind), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun deepLinkIntent(ctx: Context, url: String): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
      setPackage(ctx.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

  private fun deepLinkPI(ctx: Context, url: String, id: String, kind: Int): PendingIntent =
    PendingIntent.getActivity(
      ctx, requestCode(id, kind), deepLinkIntent(ctx, url),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  fun notifySafe(ctx: Context, notifId: Int, n: Notification) {
    try {
      NotificationManagerCompat.from(ctx).notify(notifId, n)
    } catch (e: SecurityException) {
      // POST_NOTIFICATIONS not granted; the app asks for it on launch.
    }
  }
}
