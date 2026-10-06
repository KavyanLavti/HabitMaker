package expo.modules.systemguard

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import android.widget.TextView

/** Full-screen "ACCESS RESTRICTED" System window shown when a leisure app's allowance runs out. */
class BlockActivity : Activity() {
  private val blue = 0xFF38B6FF.toInt()
  private val red = 0xFFFF3355.toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = BG
    window.navigationBarColor = BG
    val label = intent.getStringExtra(EXTRA_LABEL) ?: "This app"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(BG)
      setPadding(dp(24), dp(24), dp(24), dp(24))
    }

    val panel = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(28), dp(24), dp(24))
      background = GradientDrawable().apply {
        setColor(0xFF0A1020.toInt())
        setStroke(dp(1), red)
        cornerRadius = dp(4).toFloat()
      }
    }

    panel.addView(text("⚠  SYSTEM ALERT", 12f, red, bold = true, spacing = 0.25f))
    panel.addView(text("ACCESS RESTRICTED", 26f, Color.WHITE, bold = true, spacing = 0.08f, top = 10))
    panel.addView(
      text(
        "Your daily allowance for $label has been used up.\n\n" +
          "Clear quests to earn points, then buy more time at the Gate.",
        15f, 0xFFA9BCD9.toInt(), top = 16,
      )
    )
    panel.addView(button("OPEN HABITFORGE", blue, filled = true, top = 28) {
      startActivity(Reminders.deepLinkIntent(this, "habitforge://gate"))
      finish()
    })
    panel.addView(button("RETURN HOME", 0xFF62738F.toInt(), filled = false, top = 10) { goHome() })

    root.addView(panel, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    setContentView(root)
  }

  @Deprecated("Back always leaves to the home screen, never back into the blocked app")
  override fun onBackPressed() {
    goHome()
  }

  private fun goHome() {
    startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    finish()
  }

  private fun text(s: String, size: Float, color: Int, bold: Boolean = false, spacing: Float = 0f, top: Int = 0) =
    TextView(this).apply {
      text = s
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      letterSpacing = spacing
      if (bold) typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(top) }
    }

  private fun button(s: String, color: Int, filled: Boolean, top: Int, onClick: () -> Unit) =
    TextView(this).apply {
      text = s
      gravity = Gravity.CENTER
      setTextColor(if (filled) BG else color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      letterSpacing = 0.15f
      setPadding(0, dp(14), 0, dp(14))
      background = GradientDrawable().apply {
        setColor(if (filled) color else Color.TRANSPARENT)
        setStroke(dp(1), color)
        cornerRadius = dp(4).toFloat()
      }
      layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(top) }
      setOnClickListener { onClick() }
    }

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  companion object {
    const val EXTRA_LABEL = "label"
    const val EXTRA_PKG = "pkg"
    private val BG = 0xFF04060C.toInt()
  }
}
