import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { SystemPanel, SectionLabel, Stat, Body, SystemButton } from '@/components/ui/System';
import { useGymStore } from '@/store/gymStore';
import { todayKey, describeKey } from '@/lib/dates';
import { exerciseStats, recentExerciseOrder, weeklyVolume, workoutDays } from '@/lib/gymAnalytics';

const kg = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}T` : `${Math.round(n)}`);

/** Status tab section: training frequency, volume trend, and per-exercise progress. */
export function GymAnalytics({ onOpenLog }: { onOpenLog: () => void }) {
  const { sets, exercises } = useGymStore();
  const today = todayKey();
  const weekly = useMemo(() => weeklyVolume(sets, today, 8), [sets, today]);
  const maxWeek = Math.max(1, ...weekly.map((w) => w.volume));
  const order = useMemo(() => recentExerciseOrder(sets), [sets]);
  const [exId, setExId] = useState<string | null>(null);
  const selected = exId ?? order[0] ?? null;
  const stats = useMemo(() => (selected ? exerciseStats(sets, selected) : null), [sets, selected]);
  const recent = stats?.sessions.slice(-10) ?? [];
  const max1RM = Math.max(1, ...recent.map((s) => s.best1RM));
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? '?';

  return (
    <>
      <SectionLabel>GYM ANALYTICS</SectionLabel>
      <SystemPanel tone="ember">
        <View style={styles.stats}>
          <Stat label="THIS WEEK" value={workoutDays(sets, today, 7)} color={Colors.ember} />
          <Stat label="30 DAYS" value={workoutDays(sets, today, 30)} color={Colors.ember} />
          <Stat label="KG / WEEK" value={kg(weekly[weekly.length - 1]?.volume ?? 0)} color={Colors.gold} />
          <Stat label="EXERCISES" value={order.length} color={Colors.system} />
        </View>
        <SystemButton label="OPEN GYM LOG" tone="ember" variant="outline" small onPress={onOpenLog} style={{ marginTop: Space.md }} />
      </SystemPanel>

      {sets.length > 0 && (
        <>
          <SystemPanel title="WEEKLY VOLUME (KG)">
            <View style={styles.chart}>
              {weekly.map((w, i) => (
                <View key={w.start} style={styles.barCol}>
                  <Text style={styles.barVal}>{w.volume ? kg(w.volume) : ''}</Text>
                  <Animated.View
                    entering={FadeIn.delay(i * 50)}
                    style={[styles.bar, { height: `${Math.max(2, (w.volume / maxWeek) * 80)}%` }, w.volume > 0 && glow(Colors.ember)]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.axis}>
              <Text style={styles.axisText}>8 WEEKS AGO</Text>
              <Text style={styles.axisText}>THIS WEEK</Text>
            </View>
          </SystemPanel>

          <SystemPanel title="EXERCISE PROGRESS">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {order.map((id) => (
                <TouchableOpacity key={id} onPress={() => setExId(id)} style={[styles.chip, id === selected && styles.chipOn]}>
                  <Text style={[styles.chipText, id === selected && { color: Colors.background }]}>{nameOf(id)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {stats && (
              <Animated.View key={selected} entering={FadeIn} layout={LinearTransition}>
                <View style={[styles.stats, { marginTop: Space.md }]}>
                  <Stat label="BEST KG" value={stats.bestWeight} color={Colors.gold} />
                  <Stat label="EST. 1RM" value={Math.round(stats.best1RM)} color={Colors.gold} />
                  <Stat label="SESSIONS" value={stats.sessions.length} color={Colors.system} />
                  <Stat label="TOTAL KG" value={kg(stats.totalVolume)} color={Colors.ember} />
                </View>
                <Text style={styles.subLabel}>EST. 1RM · LAST {recent.length} SESSIONS</Text>
                <View style={[styles.chart, { height: 90 }]}>
                  {recent.map((s, i) => {
                    const isBest = s.best1RM === stats.best1RM;
                    return (
                      <View key={s.date} style={styles.barCol}>
                        <Text style={styles.barVal}>{Math.round(s.best1RM)}</Text>
                        <Animated.View
                          entering={FadeIn.delay(i * 40)}
                          style={[styles.bar, { height: `${Math.max(4, (s.best1RM / max1RM) * 75)}%`, backgroundColor: isBest ? Colors.gold : Colors.system }]}
                        />
                      </View>
                    );
                  })}
                </View>
                {stats.lastDate && (
                  <Body muted style={{ fontSize: 11, marginTop: 6 }}>
                    Last done {describeKey(stats.lastDate).day.toLowerCase()}, {describeKey(stats.lastDate).date}
                  </Body>
                )}
              </Animated.View>
            )}
          </SystemPanel>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row' },
  chart: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', backgroundColor: Colors.ember, borderRadius: 1 },
  barVal: { fontFamily: Fonts.displaySemi, fontSize: 8, color: Colors.textMuted, marginBottom: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1, color: Colors.textMuted },
  chip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceHigh, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: Colors.system, borderColor: Colors.system },
  chipText: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 0.5, color: Colors.textSecondary },
  subLabel: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted, marginTop: Space.md, marginBottom: 4 },
});
