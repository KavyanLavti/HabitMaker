package expo.modules.systemguard

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SystemGuardModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  override fun definition() = ModuleDefinition {
    Name("SystemGuard")

    // ── Quest reminders ──
    Function("setReminders") { json: String -> Reminders.setSpecs(ctx, json) }
    Function("markHandled") { id: String -> Reminders.markHandled(ctx, id) }
    Function("clearHandled") { id: String -> Reminders.clearHandled(ctx, id) }
    Function("snoozeReminder") { id: String, atMillis: Double -> Reminders.snoozeUntil(ctx, id, atMillis.toLong()) }
    Function("showTimer") { id: String, name: String, endAt: Double -> Reminders.showTimer(ctx, id, name, endAt.toLong()) }
    Function("cancelTimer") { Reminders.cancelTimer(ctx) }

    Function("notificationsEnabled") { NotificationManagerCompat.from(ctx).areNotificationsEnabled() }
    Function("canScheduleExactAlarms") { Reminders.canScheduleExact(ctx) }
    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        startSettings(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${ctx.packageName}")))
      }
      Unit
    }

    // ── Leisure-app gate ──
    Function("setGateConfig") { json: String -> GateConfig.save(ctx, json) }
    Function("getUsage") { date: String -> Usage.read(ctx, date).toString() }
    Function("isGateServiceEnabled") { GuardService.isEnabled(ctx) }
    Function("openAccessibilitySettings") { startSettings(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
    Function("openAppDetails") {
      startSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")))
    }
    Function("getLaunchableApps") {
      val pm = ctx.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(intent, 0)
        .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .filter { it.first != ctx.packageName }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
        .map { mapOf("packageName" to it.first, "label" to it.second) }
    }
  }

  private fun startSettings(intent: Intent) {
    ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
