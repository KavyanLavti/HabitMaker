package expo.modules.systemguard

import android.content.Context
import org.json.JSONObject

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

/** Per-day foreground milliseconds for each leisure app, kept natively for 14 days. */
internal object Usage {
  private fun key(date: String) = "usage_$date"

  fun read(ctx: Context, date: String): JSONObject =
    try { JSONObject(Prefs.get(ctx).getString(key(date), "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

  fun msToday(ctx: Context, pkg: String): Long = read(ctx, Prefs.today()).optLong(pkg, 0L)

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
