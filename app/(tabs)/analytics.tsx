import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VictoryBar, VictoryChart, VictoryLine, VictoryTheme, VictoryAxis, VictoryPie } from 'victory-native';
import { Colors } from '@/constants/Colors';
import { useHabitStore } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  getWeeklyPointTotals,
  getDailyPointTotals,
  getHeatmapData,
  getConsistencyScore,
  getMissPatternInsights,
} from '@/lib/analyticsEngine';
import { StatChip } from '@/components/ui/StatChip';

const W = Dimensions.get('window').width - 32;

export default function AnalyticsTab() {
  const { habits, completions, loaded, loadAll } = useHabitStore();
  const { ledger, spendablePoints, lifetimePoints, loadPoints, getLevel } = usePointStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (!loaded) { loadAll(); loadPoints(); }
  }, []);

  const weeklyData = useMemo(() => getWeeklyPointTotals(ledger, 8), [ledger]);
  const dailyData = useMemo(() => getDailyPointTotals(ledger, 30), [ledger]);
  const heatmap = useMemo(() => getHeatmapData(completions), [completions]);
  const level = getLevel(settings.pointsPerLevel);

  const bestWeek = useMemo(() => Math.max(...weeklyData.map((w) => w.points), 0), [weeklyData]);
  const totalCompletions = completions.length;

  const insights = useMemo(() =>
    habits.flatMap((h) => {
      const r = getMissPatternInsights(h.id, h.name, completions);
      return r ? [r] : [];
    }), [habits, completions]);

  const urgencyBreakdown = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const h of habits) counts[h.urgencyLevel]++;
    return [
      { x: 'Low', y: counts[1] },
      { x: 'Med', y: counts[2] },
      { x: 'High', y: counts[3] },
      { x: 'Max', y: counts[4] },
    ].filter((d) => d.y > 0);
  }, [habits]);

  const heatmapCells = Object.entries(heatmap).slice(0, 63);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.pageTitle}>ANALYTICS</Text>

        {/* Stat chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <StatChip label="Level" value={level} color={Colors.accent} />
          <StatChip label="Lifetime pts" value={Math.round(lifetimePoints)} color={Colors.accentBlue} />
          <StatChip label="Completions" value={totalCompletions} color={Colors.success} />
          <StatChip label="Best week" value={bestWeek} color={Colors.accent} />
        </ScrollView>

        {/* Weekly bar chart */}
        <Text style={styles.sectionTitle}>Weekly Points</Text>
        <View style={styles.chartCard}>
          {weeklyData.some((d) => d.points > 0) ? (
            <VictoryChart width={W - 16} height={180} theme={VictoryTheme.material} padding={{ left: 40, bottom: 30, right: 16, top: 16 }}>
              <VictoryAxis style={{ axis: { stroke: Colors.border }, tickLabels: { fill: Colors.textMuted, fontSize: 9, fontFamily: 'DMSans' } }}
                tickFormat={(t, i) => `W${i + 1}`} />
              <VictoryAxis dependentAxis style={{ axis: { stroke: 'none' }, tickLabels: { fill: Colors.textMuted, fontSize: 9 }, grid: { stroke: Colors.border, strokeDasharray: '4' } }} />
              <VictoryBar data={weeklyData} x="week" y="points" style={{ data: { fill: Colors.accent, width: 20 } }} cornerRadius={{ top: 3 }} />
            </VictoryChart>
          ) : (
            <Text style={styles.noData}>No data yet</Text>
          )}
        </View>

        {/* 30-day line chart */}
        <Text style={styles.sectionTitle}>30-Day Points Trend</Text>
        <View style={styles.chartCard}>
          {dailyData.some((d) => d.points > 0) ? (
            <VictoryChart width={W - 16} height={160} theme={VictoryTheme.material} padding={{ left: 40, bottom: 24, right: 16, top: 16 }}>
              <VictoryAxis style={{ axis: { stroke: Colors.border }, tickLabels: { fill: 'transparent' } }} />
              <VictoryAxis dependentAxis style={{ axis: { stroke: 'none' }, tickLabels: { fill: Colors.textMuted, fontSize: 9 }, grid: { stroke: Colors.border, strokeDasharray: '4' } }} />
              <VictoryLine data={dailyData} x="date" y="points"
                style={{ data: { stroke: Colors.accentBlue, strokeWidth: 2 } }}
                interpolation="monotoneX"
              />
            </VictoryChart>
          ) : (
            <Text style={styles.noData}>No data yet</Text>
          )}
        </View>

        {/* Heatmap */}
        <Text style={styles.sectionTitle}>Activity Heatmap</Text>
        <View style={styles.chartCard}>
          <View style={styles.heatmapGrid}>
            {heatmapCells.map(([date, count]) => (
              <View key={date} style={[styles.heatCell, {
                backgroundColor: count === 0 ? Colors.surfaceHigh :
                  count === 1 ? '#1E4A8C' :
                  count <= 3 ? Colors.accentBlue :
                  Colors.accent,
              }]} />
            ))}
          </View>
        </View>

        {/* Per-habit consistency */}
        {habits.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Habit Consistency</Text>
            {habits.map((h) => {
              const daysSince = Math.max(1, Math.floor(
                (Date.now() - new Date(h.createdAt).getTime()) / 86400000
              ));
              const hCompletions = completions.filter((c) => c.habitId === h.id);
              const score = getConsistencyScore(h.id, hCompletions, daysSince);
              return (
                <View key={h.id} style={styles.consistencyRow}>
                  <Text style={styles.consistencyName} numberOfLines={1}>{h.name}</Text>
                  <View style={styles.consistencyBarBg}>
                    <View style={[styles.consistencyBarFill, { width: `${score}%` }]} />
                  </View>
                  <Text style={styles.consistencyScore}>{score}%</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Urgency pie */}
        {urgencyBreakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Urgency Mix</Text>
            <View style={[styles.chartCard, { alignItems: 'center' }]}>
              <VictoryPie
                data={urgencyBreakdown}
                width={W - 16} height={180}
                colorScale={[Colors.textMuted, '#A3C4F3', Colors.accent, Colors.accentRed]}
                style={{ labels: { fill: Colors.textPrimary, fontSize: 11, fontFamily: 'DMSans' } }}
                innerRadius={40}
                padding={20}
              />
            </View>
          </>
        )}

        {/* Miss insights */}
        {insights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Insights</Text>
            {insights.map((txt, i) => (
              <View key={i} style={styles.insightCard}>
                <Text style={styles.insightText}>💡 {txt}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  pageTitle: { fontFamily: 'BebasNeue', fontSize: 28, color: Colors.textPrimary, letterSpacing: 1, marginBottom: 12 },
  chipsRow: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'BebasNeue', fontSize: 18, color: Colors.textMuted, letterSpacing: 2, marginBottom: 8, marginTop: 12 },
  chartCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 4, overflow: 'hidden' },
  noData: { fontFamily: 'DMSans', fontSize: 13, color: Colors.textMuted, textAlign: 'center', padding: 24 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, padding: 4 },
  heatCell: { width: 14, height: 14, borderRadius: 2 },
  consistencyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  consistencyName: { fontFamily: 'DMSans', fontSize: 12, color: Colors.textPrimary, width: 100 },
  consistencyBarBg: { flex: 1, height: 8, backgroundColor: Colors.surfaceHigh, borderRadius: 4, overflow: 'hidden' },
  consistencyBarFill: { height: 8, backgroundColor: Colors.accentBlue, borderRadius: 4 },
  consistencyScore: { fontFamily: 'DMSansBold', fontSize: 12, color: Colors.accentBlue, width: 36, textAlign: 'right' },
  insightCard: { backgroundColor: Colors.surface, borderRadius: 8, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  insightText: { fontFamily: 'DMSans', fontSize: 13, color: Colors.textPrimary },
});
