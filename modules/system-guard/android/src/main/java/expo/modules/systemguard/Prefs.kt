package expo.modules.systemguard

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Native-side state lives here so reminders and the app gate keep working when the JS app isn't running. */
internal object Prefs {
  private const val NAME = "system_guard"

  fun get(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun dateKey(ms: Long = System.currentTimeMillis()): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(ms))

  fun today(): String = dateKey()
}
