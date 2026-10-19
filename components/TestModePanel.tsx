import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body } from '@/components/ui/System';
import {
  useTestMode, enterTestMode, exitTestMode, shiftClock, resetClock, DAY, HOUR,
} from '@/lib/testMode';
import { nowDate } from '@/lib/clock';
import { dateKey, describeKey, formatHHMM } from '@/lib/dates';

const JUMPS: [string, number][] = [
  ['−1 DAY', -DAY],
  ['+1 HOUR', HOUR],
  ['+6 HOURS', 6 * HOUR],
  ['+1 DAY', DAY],
  ['+3 DAYS', 3 * DAY],
  ['+7 DAYS', 7 * DAY],
];

/** Settings section for simulating days on a sandboxed copy of your data. */
export function TestModePanel() {
  const { enabled, offsetMs } = useTestMode();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { Alert.alert('Test mode', e?.message ?? String(e)); }
    setBusy(false);
  };

  if (!enabled) {
    return (
      <SystemPanel title="TEST MODE" tone="ember">
        <Body muted style={styles.small}>
          Simulate days passing to test streaks, freezes, windows, the bank and delayed gate rules. It runs on a COPY
          of your data. Your real quests, points and streaks aren't touched, and real alerts and gate limits stay frozen
          until you exit.
        </Body>
        <SystemButton
          label="ENTER TEST MODE"
          tone="ember"
          variant="outline"
          loading={busy}
          style={{ marginTop: Space.md }}
          onPress={() => run(enterTestMode)}
        />
      </SystemPanel>
    );
  }

  const now = nowDate();
  const { day, date } = describeKey(dateKey(now));
  const offsetDays = Math.round((offsetMs / DAY) * 10) / 10;

  return (
    <SystemPanel title="TEST MODE · ACTIVE" tone="ember" glowing>
      <Text style={styles.day}>{day}</Text>
      <Text style={styles.date}>{date} · {formatHHMM(now.getHours() * 60 + now.getMinutes())}</Text>
      <Text style={styles.offset}>
        {offsetMs === 0 ? 'REAL TIME' : `${offsetDays > 0 ? '+' : ''}${offsetDays} DAYS FROM REAL TIME`}
      </Text>

      <View style={styles.grid}>
        {JUMPS.map(([label, ms]) => (
          <TouchableOpacity key={label} disabled={busy} onPress={() => run(() => shiftClock(ms))}
            style={[styles.jump, busy && { opacity: 0.4 }]}>
            <Text style={styles.jumpText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        <SystemButton label="BACK TO NOW" small variant="outline" tone="ember" disabled={busy || offsetMs === 0}
          onPress={() => run(resetClock)} style={{ flex: 1 }} />
        <SystemButton label="FRESH COPY" small variant="outline" tone="ember" disabled={busy}
          onPress={() => Alert.alert('Start over?', 'Throws away test changes and copies your real data again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Fresh copy', onPress: () => run(enterTestMode) },
          ])} style={{ flex: 1 }} />
      </View>
      <SystemButton label="EXIT TEST MODE" tone="ember" loading={busy} style={{ marginTop: Space.sm }}
        onPress={() => Alert.alert('Exit test mode?', 'Test changes are discarded and the app returns to your real data and today.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', onPress: () => run(exitTestMode) },
        ])} />
      <Body muted style={styles.small}>
        Backups are paused while testing. App gating and alerts follow the real clock, so they are only testable in normal
        mode.
      </Body>
    </SystemPanel>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 12, marginTop: Space.sm },
  day: { fontFamily: Fonts.display, fontSize: 26, letterSpacing: 2, color: Colors.textPrimary },
  date: { fontFamily: Fonts.displaySemi, fontSize: 14, letterSpacing: 1.5, color: Colors.ember, marginTop: 2 },
  offset: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Space.md },
  jump: {
    width: '31.5%',
    borderWidth: 1,
    borderColor: Colors.ember + '88',
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 3,
    paddingVertical: 10,
    alignItems: 'center',
  },
  jumpText: { fontFamily: Fonts.display, fontSize: 12, letterSpacing: 1, color: Colors.ember },
  row: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
});
