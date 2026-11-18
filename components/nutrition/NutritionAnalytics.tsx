import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SectionLabel, Stat, Body } from '@/components/ui/System';
import { useNutritionStore } from '@/store/nutritionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { todayKey } from '@/lib/dates';
import { daysOnTarget, weekAverages, weekCalories } from '@/lib/nutrition';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Status tab: this week's calories against the target, Monday–Sunday. */
export function NutritionAnalytics({ onOpen }: { onOpen: () => void }) {
  const items = useNutritionStore((s) => s.items);
  const target = useSettingsStore((s) => s.settings.calorieTarget);
  const today = todayKey();
  const week = useMemo(() => weekCalories(items, today), [items, today]);
  if (!items.length) return null;

  const avg = weekAverages(week);
  const onTarget = daysOnTarget(week, target);
  const max = Math.max(target * 1.3, ...week.map((d) => d.calories));

  return (
    <>
      <SectionLabel>CALORIES · THIS WEEK · MON–SUN</SectionLabel>
      <TouchableOpacity activeOpacity={0.85} onPress={onOpen}>
        <SystemPanel tone="success">
          <View style={{ flexDirection: 'row' }}>
            <Stat label="AVG KCAL" value={avg.calories || '—'} color={Colors.success} />
            <Stat label="AVG PROTEIN" value={avg.days ? `${avg.protein}g` : '—'} color={Colors.system} />
            <Stat label="ON TARGET" value={`${onTarget}/${avg.days}`} color={Colors.gold} />
          </View>
          <View style={styles.chart}>
            <View pointerEvents="none" style={styles.lineArea}><View style={[styles.targetLine, { bottom: `${(target / max) * 100}%` }]} /></View>
            {week.map((d, i) => {
              const over = d.calories > target * 1.1;
              return (
                <View key={d.date} style={styles.col}>
                  <View style={styles.track}>
                    <Animated.View entering={FadeIn.delay(i * 50)}
                      style={[styles.fill, { height: `${(d.calories / max) * 100}%`, backgroundColor: over ? Colors.ember : Colors.success }]} />
                  </View>
                  <Text style={[styles.day, d.date === today && { color: Colors.success }, d.date > today && { opacity: 0.4 }]}>{DAY_LETTERS[i]}</Text>
                </View>
              );
            })}
          </View>
          <Body muted style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            Dashed line = {target} kcal target. Averages count logged days only.
          </Body>
        </SystemPanel>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', gap: 6, height: 110, marginTop: Space.md },
  lineArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 18, zIndex: 1 },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Colors.gold },
  col: { flex: 1, alignItems: 'center' },
  track: { flex: 1, width: '100%', backgroundColor: Colors.surfaceHigh, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 2 },
  day: { fontFamily: Fonts.display, fontSize: 11, color: Colors.textSecondary, marginTop: 4, height: 14 },
});
