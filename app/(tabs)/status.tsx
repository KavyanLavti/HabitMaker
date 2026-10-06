import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Space, rankFor, glow } from '@/constants/theme';
import { SystemPanel, ScreenHeader, SectionLabel, Bar, Stat, Body, sharedStyles } from '@/components/ui/System';
import { RankEmblem } from '@/components/aura/RankEmblem';
import { useHabitStore } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getConsistencyScore, getDailyPointTotals, getHeatmap, getMissPatternInsight } from '@/lib/analyticsEngine';

export default function StatusTab() {
  const router = useRouter();
  const { habits, completions, getStreakState } = useHabitStore();
  const { ledger, lifetimePoints } = usePointStore();
  const { settings } = useSettingsStore();

  const level = Math.floor(lifetimePoints / settings.pointsPerLevel) + 1;
  const rank = rankFor(level);
  const levelProgress = (lifetimePoints % settings.pointsPerLevel) / settings.pointsPerLevel;

  const daily = useMemo(() => getDailyPointTotals(ledger, 14), [ledger]);
  const maxDaily = Math.max(1, ...daily.map((d) => d.points));
  const heat = useMemo(() => getHeatmap(completions, 84), [completions]);

  const streaks = habits.map((h) => ({ h, s: getStreakState(h.id) }));
  const bestStreak = Math.max(0, ...streaks.map((x) => x.s.streak));
  const totalFreezes = streaks.reduce((n, x) => n + x.s.freezes, 0);

  const insights = useMemo(
    () => habits.flatMap((h) => {
      const t = getMissPatternInsight(h.name, completions.filter((c) => c.habitId === h.id), h.createdAt);
      return t ? [t] : [];
    }),
    [habits, completions]
  );

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader
        kicker="PLAYER"
        title="STATUS"
        right={
          <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 6 }}>
            <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: 0, paddingBottom: 40 }}>
        <SystemPanel title="STATUS WINDOW" glowing tone="shadow">
          <View style={styles.profile}>
            <RankEmblem level={level} size={84} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{settings.displayName.toUpperCase()}</Text>
              <Text style={[styles.title, { color: rank.color }]}>{rank.title.toUpperCase()}</Text>
              <Text style={styles.level}>LV {level}</Text>
            </View>
          </View>
          <Bar progress={levelProgress} color={Colors.shadow} height={6} />
          <Text style={styles.xp}>
            {Math.round(lifetimePoints % settings.pointsPerLevel)} / {settings.pointsPerLevel} XP TO LV {level + 1}
          </Text>
          <View style={styles.stats}>
            <Stat label="LIFETIME" value={Math.round(lifetimePoints)} color={Colors.gold} />
            <Stat label="CLEARS" value={completions.length} color={Colors.system} />
            <Stat label="BEST 🔥" value={bestStreak} color={Colors.ember} />
            <Stat label="FREEZES" value={totalFreezes} color={Colors.frost} />
          </View>
        </SystemPanel>

        <SectionLabel>POINTS · LAST 14 DAYS</SectionLabel>
        <SystemPanel>
          <View style={styles.chart}>
            {daily.map((d) => (
              <View key={d.date} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(2, (d.points / maxDaily) * 100)}%` },
                    d.points > 0 && glow(Colors.system),
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.chartAxis}>
            <Text style={styles.axisText}>{daily[0].date.slice(5)}</Text>
            <Text style={styles.axisText}>TODAY</Text>
          </View>
        </SystemPanel>

        <SectionLabel>ACTIVITY · 12 WEEKS</SectionLabel>
        <SystemPanel>
          <View style={styles.heat}>
            {Array.from({ length: 12 }, (_, w) => (
              <View key={w} style={styles.heatCol}>
                {heat.slice(w * 7, w * 7 + 7).map((d) => (
                  <View
                    key={d.date}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor:
                          d.count === 0 ? Colors.surfaceHigh
                          : d.count === 1 ? Colors.systemDim
                          : d.count <= 3 ? Colors.system
                          : Colors.systemGlow,
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </SystemPanel>

        {habits.length > 0 && (
          <>
            <SectionLabel>CONSISTENCY</SectionLabel>
            <SystemPanel>
              {streaks.map(({ h }) => {
                const score = getConsistencyScore(completions.filter((c) => c.habitId === h.id), h.createdAt);
                return (
                  <View key={h.id} style={styles.consRow}>
                    <Text style={styles.consName} numberOfLines={1}>{h.name}</Text>
                    <View style={{ flex: 1 }}><Bar progress={score / 100} /></View>
                    <Text style={styles.consPct}>{score}%</Text>
                  </View>
                );
              })}
            </SystemPanel>
          </>
        )}

        {insights.length > 0 && (
          <>
            <SectionLabel>SYSTEM ANALYSIS</SectionLabel>
            {insights.map((t) => (
              <SystemPanel key={t} tone="ember">
                <Body>{t}</Body>
              </SystemPanel>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: Space.lg, marginBottom: Space.lg },
  name: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 2, color: Colors.textPrimary },
  title: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 1.5, marginTop: 2 },
  level: { fontFamily: Fonts.display, fontSize: 30, color: Colors.shadow, marginTop: 4 },
  xp: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted, marginTop: 6 },
  stats: { flexDirection: 'row', marginTop: Space.lg },
  chart: { flexDirection: 'row', height: 110, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: Colors.system, borderRadius: 1 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1, color: Colors.textMuted },
  heat: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  heatCol: { gap: 4 },
  heatCell: { width: 16, height: 16, borderRadius: 2 },
  consRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.sm },
  consName: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary, width: 110 },
  consPct: { fontFamily: Fonts.display, fontSize: 12, color: Colors.system, width: 40, textAlign: 'right' },
});
