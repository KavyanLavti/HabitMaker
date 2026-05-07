import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform, StatusBar, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PAUSED_TIMER_KEY, PausedTimerSession } from '@/components/habits/HabitTimer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useHabitStore } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import { HabitCard } from '@/components/habits/HabitCard';
import { HabitTimer } from '@/components/habits/HabitTimer';
import { calculateEarnedPoints, getConsecutivePerfectDays, isPerfectDay } from '@/lib/pointEngine';
import type { Habit } from '@/store/habitStore';

export default function TodayTab() {
  const {
    habits, completions, loaded, loadAll,
    addCompletion, archiveHabit,
    isCompletedToday, getStreakCount, getCompletionsForHabit, getCompletionCount,
  } = useHabitStore();
  const { spendablePoints, loadPoints, addEntry, getLevel } = usePointStore();
  const { settings } = useSettingsStore();
  const [timerHabit, setTimerHabit] = useState<Habit | null>(null);

  useEffect(() => {
    if (!loaded) { loadAll(); loadPoints(); }
  }, []);

  // Auto-award any paused timer session saved on a previous day
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const raw = await AsyncStorage.getItem(PAUSED_TIMER_KEY);
      if (!raw) return;
      const session: PausedTimerSession = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (session.savedAt.slice(0, 10) >= today) return; // same day — still resumable
      await AsyncStorage.removeItem(PAUSED_TIMER_KEY);
      const habit = habits.find((h) => h.id === session.habitId);
      if (!habit) return;
      const totalSecs = habit.dailyDurationMinutes * 60;
      const elapsed = totalSecs - session.remainingSeconds;
      if (elapsed <= 0) return;
      const durationMins = Math.max(1, Math.round(elapsed / 60));
      await handleComplete(habit, durationMins, true);
      const pct = Math.round((elapsed / totalSecs) * 100);
      Alert.alert('Progress Recorded', `Yesterday's ${habit.name} session (${pct}%) has been saved.`);
    })();
  }, [loaded]);

  const today = new Date().toISOString().slice(0, 10);
  const completedTodayIds = completions
    .filter((c) => c.completedAt.slice(0, 10) === today)
    .map((c) => c.habitId);

  const activeHabitIds = habits.map((h) => h.id);
  const perfectDay = isPerfectDay(activeHabitIds, completedTodayIds);

  const completionsByDate: Record<string, string[]> = {};
  for (const c of completions) {
    const d = c.completedAt.slice(0, 10);
    if (!completionsByDate[d]) completionsByDate[d] = [];
    completionsByDate[d].push(c.habitId);
  }
  const consecutivePerfect = getConsecutivePerfectDays(activeHabitIds, completionsByDate);
  const level = getLevel(settings.pointsPerLevel);

  const handleComplete = async (habit: Habit, durationMinutes: number, timerUsed: boolean) => {
    const streak = getStreakCount(habit.id);
    const totalSecs = habit.dailyDurationMinutes * 60;
    const doneSecs = durationMinutes * 60;
    const fraction = timerUsed ? Math.min(doneSecs / totalSecs, 1) : 1;
    const basePoints = Math.ceil(habit.pointsPerCompletion * fraction);
    const result = calculateEarnedPoints(basePoints, streak + 1, settings);

    await addCompletion({
      habitId: habit.id,
      completedAt: new Date().toISOString(),
      durationMinutes,
      timerUsed,
    });

    await addEntry({
      habitId: habit.id,
      type: 'earn',
      amount: result.total,
      reason: timerUsed && fraction < 1
        ? `Partial (${Math.round(fraction * 100)}%): ${habit.name}`
        : `Completed: ${habit.name} (${streak + 1}-day streak x${result.streakMultiplier})`,
    });

    // Perfect day bonus
    const newCompletedIds = [...completedTodayIds, habit.id];
    if (isPerfectDay(activeHabitIds, newCompletedIds)) {
      await addEntry({ habitId: null, type: 'combo', amount: settings.perfectDayBonus, reason: 'Perfect Day bonus' });
    }

    // Streak bonuses
    if (consecutivePerfect + 1 === 3) {
      await addEntry({ habitId: null, type: 'combo', amount: settings.onFireBonus, reason: 'On Fire! (3 perfect days)' });
    } else if (consecutivePerfect + 1 === 7) {
      await addEntry({ habitId: null, type: 'combo', amount: settings.unstoppableBonus, reason: 'Unstoppable! (7 perfect days)' });
    }

    // Auto-complete habit when totalDays goal is reached
    if (habit.totalDays) {
      const newCount = getCompletionCount(habit.id) + 1;
      if (newCount >= habit.totalDays) {
        await archiveHabit(habit.id);
        await addEntry({ habitId: null, type: 'combo', amount: habit.pointsPerCompletion * 2, reason: `Quest complete: ${habit.name}!` });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.levelText}>LV {level} · FORGE MASTER</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsVal}>{Math.round(spendablePoints)}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>

      {perfectDay && (
        <View style={styles.perfectBanner}>
          <Text style={styles.perfectText}>⚡ PERFECT DAY ⚡</Text>
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {habits.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No habits yet. Add them in the Quests tab.</Text>
          </View>
        )}
        {habits.map((habit) => {
          const hCompletions = getCompletionsForHabit(habit.id);
          const completedDates = hCompletions.map((c) => c.completedAt.slice(0, 10));
          const streak = getStreakCount(habit.id);
          const completionCount = getCompletionCount(habit.id);
          const completedToday = isCompletedToday(habit.id);

          return (
            <HabitCard
              key={habit.id}
              habit={habit}
              completedDates={completedDates}
              streakDays={streak}
              completionCount={completionCount}
              completedToday={completedToday}
              nearPenalty={false}
              onStart={() => setTimerHabit(habit)}
            />
          );
        })}
      </ScrollView>

      {timerHabit && (
        <HabitTimer
          habit={timerHabit}
          visible={!!timerHabit}
          onComplete={(mins) => {
            handleComplete(timerHabit, mins, true);
            setTimerHabit(null);
          }}
          onDismiss={() => setTimerHabit(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  dateText: { fontFamily: 'DMSansBold', fontSize: 15, color: Colors.textPrimary },
  levelText: { fontFamily: 'DMSans', fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  pointsBadge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  pointsVal: { fontFamily: 'BebasNeue', fontSize: 26, color: Colors.accent },
  pointsLabel: { fontFamily: 'DMSans', fontSize: 10, color: Colors.textMuted },
  perfectBanner: { backgroundColor: Colors.accent, paddingVertical: 8, alignItems: 'center' },
  perfectText: { fontFamily: 'BebasNeue', fontSize: 18, color: Colors.background, letterSpacing: 3 },
  list: { flex: 1 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontFamily: 'DMSans', fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
