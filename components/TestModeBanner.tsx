import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { useTestMode, shiftClock, DAY, HOUR } from '@/lib/testMode';
import { nowDate } from '@/lib/clock';
import { dateKey, describeKey, formatHHMM } from '@/lib/dates';

/** Always-visible strip while test mode is on: simulated date/time plus quick time jumps. */
export function TestModeBanner() {
  const router = useRouter();
  const enabled = useTestMode((s) => s.enabled);
  useTestMode((s) => s.offsetMs); // re-render when the clock moves
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const now = nowDate();
  const { day, date } = describeKey(dateKey(now));
  const jump = async (ms: number) => {
    setBusy(true);
    await shiftClock(ms);
    setBusy(false);
  };

  return (
    <View style={[styles.wrap, glow(Colors.ember)]} pointerEvents="box-none">
      <TouchableOpacity style={styles.info} onPress={() => router.push('/settings')}>
        <Text style={styles.label}>TEST MODE</Text>
        <Text style={styles.when}>
          {day.slice(0, 3)} {date} · {formatHHMM(now.getHours() * 60 + now.getMinutes())}
        </Text>
      </TouchableOpacity>
      {[['−1D', -DAY], ['+1H', HOUR], ['+1D', DAY]].map(([label, ms]) => (
        <TouchableOpacity key={label as string} disabled={busy} onPress={() => jump(ms as number)}
          style={[styles.btn, busy && { opacity: 0.4 }]}>
          <Text style={styles.btnText}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Space.md,
    right: Space.md,
    bottom: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.ember,
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
  },
  info: { flex: 1, paddingHorizontal: 4 },
  label: { fontFamily: Fonts.display, fontSize: 9, letterSpacing: 2, color: Colors.ember },
  when: { fontFamily: Fonts.displaySemi, fontSize: 12, letterSpacing: 1, color: Colors.textPrimary },
  btn: {
    borderWidth: 1,
    borderColor: Colors.ember,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  btnText: { fontFamily: Fonts.display, fontSize: 12, color: Colors.ember },
});
