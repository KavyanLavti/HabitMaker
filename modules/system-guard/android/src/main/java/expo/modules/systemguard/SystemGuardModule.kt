package expo.modules.systemguard

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

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
    Function("getUsage") { date: String -> Usage.forDate(ctx, date).toString() }
    Function("hasUsageAccess") { Usage.hasUsageAccess(ctx) }
    Function("openUsageAccessSettings") {
      // Some phones support jumping straight to this app's entry; fall back to the list
      try {
        startSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${ctx.packageName}")))
      } catch (e: Exception) {
        startSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
      }
    }
    Function("getGateDebug") {
      val p = Prefs.get(ctx)
      val cfg = GateConfig.load(ctx)
      JSONObject().apply {
        put("connectedAt", p.getLong(GuardService.DEBUG_CONNECTED_AT, 0L))
        put("lastPkg", p.getString(GuardService.DEBUG_LAST_PKG, "") ?: "")
        put("lastAt", p.getLong(GuardService.DEBUG_LAST_AT, 0L))
        put("configDate", cfg.date)
        put("configEnabled", cfg.enabled)
        put("configApps", JSONArray(cfg.packages().toList()))
      }.toString()
    }
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
