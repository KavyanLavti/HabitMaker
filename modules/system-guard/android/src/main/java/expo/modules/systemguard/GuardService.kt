package expo.modules.systemguard

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Watches which app is in front. While a leisure app is open it adds the time to today's usage, and once
 * the app's allowance (base + earned minutes) is spent it sends you home and shows [BlockActivity].
 * Only the package name of the foreground window is read — never screen content.
 */
class GuardService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var current: String? = null
  private var lastTick = 0L
  private var screenOn = true
  private var imePackages: Set<String> = emptySet()

  private val tick = object : Runnable {
    override fun run() {
      flush()
      check()
      if (current != null) handler.postDelayed(this, TICK_MS)
    }
  }

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
      when (i.action) {
        Intent.ACTION_SCREEN_OFF -> { flush(); screenOn = false }
        Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT -> {
          screenOn = true
          lastTick = SystemClock.elapsedRealtime()
          check()
        }
      }
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    imePackages = try {
      getSystemService(InputMethodManager::class.java).enabledInputMethodList.map { it.packageName }.toSet()
    } catch (e: Exception) { emptySet() }
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_USER_PRESENT)
    }
    ContextCompat.registerReceiver(this, screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  override fun onDestroy() {
    flush()
    handler.removeCallbacks(tick)
    try { unregisterReceiver(screenReceiver) } catch (e: Exception) {}
    super.onDestroy()
  }

  override fun onInterrupt() {}

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    // The notification shade and keyboards pop over the current app without leaving it
    if (pkg == "com.android.systemui" || pkg in imePackages) return
    if (pkg == current) return
    switchTo(pkg)
  }

  private fun switchTo(pkg: String) {
    flush()
    handler.removeCallbacks(tick)
    current = if (GateConfig.load(this).isLeisure(pkg)) pkg else null
    if (current != null) {
      lastTick = SystemClock.elapsedRealtime()
      check()
      if (current != null) handler.postDelayed(tick, TICK_MS)
    }
  }

  private fun flush() {
    val pkg = current ?: return
    val now = SystemClock.elapsedRealtime()
    if (screenOn && lastTick > 0) Usage.add(this, pkg, now - lastTick)
    lastTick = now
  }

  private fun check() {
    val pkg = current ?: return
    if (!screenOn) return
    val cfg = GateConfig.load(this)
    if (!cfg.isLeisure(pkg)) { current = null; return }
    val left = cfg.budgetMs(pkg) - Usage.msToday(this, pkg)
    if (left <= 0) {
      block(pkg, cfg.label(pkg))
    } else if (left <= 60_000L) {
      warnOnce(pkg, cfg.label(pkg))
    }
  }

  private fun warnOnce(pkg: String, label: String) {
    val key = "warned_${Prefs.today()}_$pkg"
    val prefs = Prefs.get(this)
    if (prefs.getBoolean(key, false)) return
    prefs.edit().putBoolean(key, true).apply()
    Reminders.ensureChannels(this)
    val n = NotificationCompat.Builder(this, Reminders.CHANNEL)
      .setSmallIcon(R.drawable.ic_system_guard)
      .setColor(0xFFFF6A2B.toInt())
      .setContentTitle("[WARNING] 1 minute left on $label")
      .setContentText("The gate closes soon. Earn points to buy more time.")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setTimeoutAfter(90_000L)
      .build()
    Reminders.notifySafe(this, ("warn$pkg").hashCode(), n)
  }

  private fun block(pkg: String, label: String) {
    current = null
    handler.removeCallbacks(tick)
    performGlobalAction(GLOBAL_ACTION_HOME)
    startActivity(
      Intent(this, BlockActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        .putExtra(BlockActivity.EXTRA_LABEL, label)
        .putExtra(BlockActivity.EXTRA_PKG, pkg)
    )
  }

  companion object {
    private const val TICK_MS = 5_000L

    fun isEnabled(ctx: Context): Boolean {
      val enabled = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        ?: return false
      val me = ComponentName(ctx, GuardService::class.java)
      return enabled.split(':').any {
        it.equals(me.flattenToString(), ignoreCase = true) || it.equals(me.flattenToShortString(), ignoreCase = true)
      }
    }
  }
}
