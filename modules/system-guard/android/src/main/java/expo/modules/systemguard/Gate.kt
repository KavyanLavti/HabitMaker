package expo.modules.systemguard

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import org.json.JSONObject
import java.util.Calendar

/**
 * Leisure-app rules written by JS:
 * { "date": "2026-10-06", "enabled": true, "baseMinutes": 15,
 *   "apps": [{ "pkg": "com.google.android.youtube", "label": "YouTube", "extraMinutes": 10 }] }
 *
 * extraMinutes (bought with points or drawn from the bank) only count on `date`. If JS hasn't run yet
 * today, every app falls back to the base allowance, so the gate never opens up just because the app
 * wasn't launched.
 */
internal class GateConfig(
  val date: String,
  val enabled: Boolean,
  val baseMinutes: Int,
  private val apps: Map<String, Pair<String, Int>>,
) {
  fun isLeisure(pkg: String) = enabled && apps.containsKey(pkg)
  fun packages(): Set<String> = apps.keys
  fun label(pkg: String) = apps[pkg]?.first ?: pkg

  fun budgetMs(pkg: String): Long {
    val extra = if (date == Prefs.today()) apps[pkg]?.second ?: 0 else 0
    return (baseMinutes + extra) * 60_000L
  }

  companion object {
    private const val KEY = "gate_config"

    fun save(ctx: Context, json: String) {
      Prefs.get(ctx).edit().putString(KEY, json).apply()
    }

    fun load(ctx: Context): GateConfig {
      val raw = Prefs.get(ctx).getString(KEY, null)
        ?: return GateConfig("", false, 15, emptyMap())
      return try {
        val o = JSONObject(raw)
        val arr = o.optJSONArray("apps")
        val apps = mutableMapOf<String, Pair<String, Int>>()
        if (arr != null) for (i in 0 until arr.length()) {
          val a = arr.getJSONObject(i)
          apps[a.getString("pkg")] = a.optString("label", a.getString("pkg")) to a.optInt("extraMinutes", 0)
        }
        GateConfig(o.optString("date"), o.optBoolean("enabled", true), o.optInt("baseMinutes", 15), apps)
      } catch (e: Exception) {
        GateConfig("", false, 15, emptyMap())
      }
    }
  }
}

/**
 * Per-day foreground milliseconds for each leisure app.
 *
 * Two sources: Android's own usage stats (what Digital Wellbeing shows; needs "Usage access") and our
 * accessibility-service counter (kept 14 days). When both exist the larger wins, so time is never lost
 * because one of them missed it — e.g. the accessibility service being stopped by the system.
 */
internal object Usage {
  private fun key(date: String) = "usage_$date"

  // UsageEvents.Event constants (ACTIVITY_RESUMED / ACTIVITY_PAUSED / ACTIVITY_STOPPED)
  private const val RESUMED = 1
  private const val PAUSED = 2
  private const val STOPPED = 23

  /** Our own accessibility-service counter only. */
  fun read(ctx: Context, date: String): JSONObject =
    try { JSONObject(Prefs.get(ctx).getString(key(date), "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

  fun hasUsageAccess(ctx: Context): Boolean {
    val ops = ctx.getSystemService(AppOpsManager::class.java) ?: return false
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
    } else {
      @Suppress("DEPRECATION")
      ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /** Foreground time per package on `date` from Android's usage events, or null without Usage access. */
  private fun systemMs(ctx: Context, date: String, pkgs: Set<String>): Map<String, Long>? {
    if (pkgs.isEmpty() || !hasUsageAccess(ctx)) return null
    val usm = ctx.getSystemService(UsageStatsManager::class.java) ?: return null
    val start = startOfDay(date) ?: return null
    val now = System.currentTimeMillis()
    val end = minOf(start + 86_400_000L, now)
    if (end <= start) return emptyMap()

    val totals = HashMap<String, Long>()
    val openSince = HashMap<String, Long>()
    val events = try { usm.queryEvents(start, end) } catch (e: Exception) { return null }
    val e = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      val p = e.packageName ?: continue
      if (p !in pkgs) continue
      when (e.eventType) {
        RESUMED -> if (p !in openSince) openSince[p] = e.timeStamp
        PAUSED, STOPPED -> openSince.remove(p)?.let { totals[p] = (totals[p] ?: 0L) + (e.timeStamp - it) }
      }
    }
    // Still in the foreground right now
    if (end == now) openSince.forEach { (p, t) -> totals[p] = (totals[p] ?: 0L) + (now - t) }
    return totals
  }

  private fun startOfDay(date: String): Long? = try {
    val (y, m, d) = date.split("-").map { it.toInt() }
    Calendar.getInstance().apply {
      clear()
      set(y, m - 1, d, 0, 0, 0)
    }.timeInMillis
  } catch (e: Exception) { null }

  /** Best available usage for `date`: max of Android's usage stats and our own counter, per package. */
  fun forDate(ctx: Context, date: String): JSONObject {
    val counter = read(ctx, date)
    val pkgs = GateConfig.load(ctx).packages() + counter.keys().asSequence().toSet()
    val system = systemMs(ctx, date, pkgs) ?: return counter
    val out = JSONObject()
    for (p in pkgs) {
      val ms = maxOf(counter.optLong(p, 0L), system[p] ?: 0L)
      if (ms > 0) out.put(p, ms)
    }
    return out
  }

  fun msToday(ctx: Context, pkg: String): Long = forDate(ctx, Prefs.today()).optLong(pkg, 0L)

  fun add(ctx: Context, pkg: String, ms: Long) {
    if (ms <= 0) return
    val today = Prefs.today()
    val o = read(ctx, today)
    o.put(pkg, o.optLong(pkg, 0L) + ms)
    val edit = Prefs.get(ctx).edit().putString(key(today), o.toString())
    // Prune anything older than 14 days
    val cutoff = Prefs.dateKey(System.currentTimeMillis() - 14L * 86_400_000L)
    Prefs.get(ctx).all.keys.filter { it.startsWith("usage_") && it.removePrefix("usage_") < cutoff }
      .forEach { edit.remove(it) }
    edit.apply()
  }
}
