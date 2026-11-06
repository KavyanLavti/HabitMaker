import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { SystemPanel, SectionLabel, Stat, Body } from '@/components/ui/System';
import { useTodoStore } from '@/store/todoStore';
import { addDaysKey, todayKey } from '@/lib/dates';
import { dayStats, fullClearStreak, overallRate, weekStats } from '@/lib/todoAnalytics';

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Status tab: how much of what you planned you actually finished. */
export function TodoAnalytics() {
  const todos = useTodoStore((s) => s.todos);
  const today = todayKey();
  const week = useMemo(() => weekStats(todos, today), [todos, today]);
  const lastWeek = useMemo(() => weekStats(todos, addDaysKey(today, -7)), [todos, today]);
  const todayStats = dayStats(todos, today);
  const thisRate = overallRate(week);
  const lastRate = overallRate(lastWeek);
  const earnedThisWeek = week.reduce((n, d) => n + d.pointsEarned, 0);
  const plannedThisWeek = week.reduce((n, d) => n + d.pointsPlanned, 0);

  if (!todos.length) return null;

  const trend =
    thisRate != null && lastRate != null
      ? thisRate >= lastRate
        ? `▲ ${Math.round((thisRate - lastRate) * 100)} pts vs last week`
        : `▼ ${Math.round((lastRate - thisRate) * 100)} pts vs last week`
      : null;

  return (
    <>
      <SectionLabel>TO-DO ANALYTICS</SectionLabel>
      <SystemPanel tone="gold">
        <View style={styles.stats}>
          <Stat label="TODAY" value={pct(todayStats.rate)} color={Colors.gold} />
          <Stat label="THIS WEEK" value={pct(thisRate)} color={Colors.gold} />
          <Stat label="CLEAR STREAK" value={fullClearStreak(todos, today)} color={Colors.success} />
          <Stat label="PTS / WEEK" value={earnedThisWeek} color={Colors.system} />
        </View>
        {trend && <Body muted style={styles.trend}>{trend}</Body>}

        <Text style={styles.subLabel}>THIS WEEK · MON–SUN · % OF PLAN DONE</Text>
        <View style={styles.chart}>
          {week.map((d, i) => {
            const future = d.date > today;
            const h = d.rate == null ? 0 : d.rate;
            return (
              <View key={d.date} style={styles.col}>
                <Text style={styles.val}>{d.rate == null ? '' : `${Math.round(h * 100)}`}</Text>
                <View style={styles.track}>
                  <Animated.View
                    entering={FadeIn.delay(i * 50)}
                    style={[
                      styles.fill,
                      { height: `${Math.max(d.total ? 4 : 0, h * 100)}%`, backgroundColor: h === 1 ? Colors.success : Colors.gold },
                      h === 1 && glow(Colors.success),
                    ]}
                  />
                </View>
                <Text style={[styles.day, d.date === today && { color: Colors.gold }, future && { opacity: 0.4 }]}>{DAY_LETTERS[i]}</Text>
                <Text style={styles.count}>{d.total ? `${d.done}/${d.total}` : ''}</Text>
              </View>
            );
          })}
        </View>
        <Body muted style={styles.trend}>
          {earnedThisWeek} of {plannedThisWeek} planned points earned this week.
        </Body>
      </SystemPanel>
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row' },
  trend: { fontSize: 12, marginTop: Space.sm, textAlign: 'center' },
  subLabel: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted, marginTop: Space.md, marginBottom: 6 },
  chart: { flexDirection: 'row', gap: 6, height: 130 },
  col: { flex: 1, alignItems: 'center' },
  val: { fontFamily: Fonts.displaySemi, fontSize: 9, color: Colors.textMuted, height: 14 },
  track: { flex: 1, width: '100%', backgroundColor: Colors.surfaceHigh, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 2 },
  day: { fontFamily: Fonts.display, fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  count: { fontFamily: Fonts.body, fontSize: 9, color: Colors.textMuted, height: 12 },
});
