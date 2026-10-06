import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Colors, Fonts, Space, rankFor } from '@/constants/theme';
import { SystemPanel, SectionLabel, Bar, Body, sharedStyles } from '@/components/ui/System';
import { RankEmblem } from '@/components/aura/RankEmblem';
import { QuestCard, questTiming } from '@/components/habits/QuestCard';
import { HabitTimer, loadTimerSession, clearTimerSession, remainingSec } from '@/components/habits/HabitTimer';
import { SnoozeSheet } from '@/components/habits/SnoozeSheet';
import { QuestPrompt } from '@/components/habits/QuestPrompt';
import { useHabitStore, Habit } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSnoozeStore } from '@/store/snoozeStore';
import { completeQuest } from '@/lib/quests';
import { dateKeyOf, parseHHMM, todayKey } from '@/lib/dates';
import { SystemGuard } from '@/modules/system-guard';

type DeepLink = { start?: string; snooze?: string; quest?: string; timer?: string };

export default function TodayTab() {
  const params = useLocalSearchParams<DeepLink>();
  const router = useRouter();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const loaded = useHabitStore((s) => s.loaded);
  const getStreakState = useHabitStore((s) => s.getStreakState);
  const getCompletionCount = useHabitStore((s) => s.getCompletionCount);
  const spendable = usePointStore((s) => s.spendablePoints);
  const lifetime = usePointStore((s) => s.lifetimePoints);
  const settings = useSettingsStore((s) => s.settings);
  const snoozes = useSnoozeStore();

  const [timer, setTimer] = useState<{ habit: Habit; autoStart: boolean } | null>(null);
  const [snoozeHabit, setSnoozeHabit] = useState<Habit | null>(null);
  const [promptHabit, setPromptHabit] = useState<Habit | null>(null);
  const [toast, setToast] = useState<{ title: string; lines: string[] } | null>(null);

  const today = todayKey();
  const level = Math.floor(lifetime / settings.pointsPerLevel) + 1;
  const rank = rankFor(level);

  const completedByHabit = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const c of completions) (m[c.habitId] ??= new Set()).add(dateKeyOf(c.completedAt));
    return m;
  }, [completions]);
  const isDone = (id: string) => completedByHabit[id]?.has(today) ?? false;

  // Open quests first (urgent → by time), cleared last
  const sorted = useMemo(() => {
    const order = (h: Habit) => {
      if (isDone(h.id)) return 3;
      return questTiming(h, false).urgent ? 0 : h.scheduleType === 'anytime' ? 2 : 1;
    };
    return [...habits].sort((a, b) =>
      order(a) - order(b) || (parseHHMM(a.scheduledTime) ?? 9999) - (parseHHMM(b.scheduledTime) ?? 9999));
  }, [habits, completedByHabit]);

  const clearedCount = habits.filter((h) => isDone(h.id)).length;

  // Notification buttons arrive as deep links: habitforge://today?start=<id> etc.
  useEffect(() => {
    if (!loaded) return;
    const find = (id?: string) => (id ? habits.find((h) => h.id === id) : undefined);
    let handled = false;
    if (find(params.start)) {
      const h = find(params.start)!;
      SystemGuard.markHandled(h.id);
      setTimer({ habit: h, autoStart: true });
      handled = true;
    } else if (find(params.snooze)) {
      setSnoozeHabit(find(params.snooze)!);
      handled = true;
    } else if (find(params.quest)) {
      if (!isDone(params.quest!)) setPromptHabit(find(params.quest)!);
      handled = true;
    } else if (find(params.timer)) {
      setTimer({ habit: find(params.timer)!, autoStart: false });
      handled = true;
    }
    if (handled) router.setParams({ start: undefined, snooze: undefined, quest: undefined, timer: undefined });
  }, [loaded, params.start, params.snooze, params.quest, params.timer]);

  // A timer session left over from a previous day is awarded for that day
  useEffect(() => {
    if (!loaded) return;
    loadTimerSession().then(async (s) => {
      if (!s || s.date >= today) return;
      await clearTimerSession();
      const habit = habits.find((h) => h.id === s.habitId);
      const elapsed = s.totalSec - remainingSec(s);
      if (!habit || elapsed < 60) return;
      const [y, m, d] = s.date.split('-').map(Number);
      await completeQuest(habit, Math.round(elapsed / 60), true, new Date(y, m - 1, d, 23, 0));
      Alert.alert('Progress recorded', `${s.date}'s ${habit.name} session (${Math.round(elapsed / 60)} min) was saved.`);
    });
  }, [loaded]);

  const showToast = (title: string, lines: string[]) => {
    setToast({ title, lines });
    setTimeout(() => setToast(null), 3500);
  };

  const onTimerComplete = async (habit: Habit, minutes: number) => {
    setTimer(null);
    const r = await completeQuest(habit, minutes, true);
    showToast('QUEST CLEARED', [`+${r.points} PTS · 🔥 ${r.streak}`, ...r.bonuses]);
  };

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Player header */}
        <View style={styles.header}>
          <RankEmblem level={level} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.player}>{settings.displayName.toUpperCase()}</Text>
            <Text style={[styles.rank, { color: rank.color }]}>LV {level} · {rank.title.toUpperCase()}</Text>
          </View>
          <View style={styles.points}>
            <Text style={styles.pointsVal}>{Math.round(spendable)}</Text>
            <Text style={styles.pointsLabel}>POINTS</Text>
          </View>
        </View>

        {/* Daily quest summary */}
        <SystemPanel title="DAILY QUEST" glowing={clearedCount === habits.length && habits.length > 0}
          tone={clearedCount === habits.length && habits.length > 0 ? 'success' : 'system'}>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              CLEARED <Text style={{ color: Colors.system }}>{clearedCount}</Text> / {habits.length}
            </Text>
            {clearedCount === habits.length && habits.length > 0 && (
              <Text style={styles.perfect}>⚡ PERFECT DAY</Text>
            )}
          </View>
          <Bar progress={habits.length ? clearedCount / habits.length : 0}
            color={clearedCount === habits.length ? Colors.success : Colors.system} />
        </SystemPanel>

        {habits.length === 0 && (
          <Body muted style={{ textAlign: 'center', marginTop: Space.xl }}>
            No quests yet. Add your first one in the QUESTS tab.
          </Body>
        )}

        {sorted.map((habit, i) => {
          const done = isDone(habit.id);
          const prevDone = i > 0 && isDone(sorted[i - 1].id);
          return (
            <React.Fragment key={habit.id}>
              {done && !prevDone && <SectionLabel>CLEARED</SectionLabel>}
              <QuestCard
                habit={habit}
                completedKeys={completedByHabit[habit.id] ?? new Set()}
                streak={getStreakState(habit.id)}
                completionCount={getCompletionCount(habit.id)}
                done={done}
                snoozedTo={snoozes.date === today ? snoozes.until[habit.id] : null}
                onStart={() => {
                  SystemGuard.markHandled(habit.id);
                  setTimer({ habit, autoStart: false });
                }}
              />
            </React.Fragment>
          );
        })}
      </ScrollView>

      {timer && (
        <HabitTimer
          habit={timer.habit}
          visible
          autoStart={timer.autoStart}
          onComplete={(mins) => onTimerComplete(timer.habit, mins)}
          onClose={() => setTimer(null)}
        />
      )}

      {/* Reminder tapped: Start or Snooze, nothing else */}
      {!snoozeHabit && (
        <QuestPrompt
          habit={promptHabit}
          onStart={() => {
            const h = promptHabit!;
            setPromptHabit(null);
            SystemGuard.markHandled(h.id);
            setTimer({ habit: h, autoStart: true });
          }}
          onSnooze={() => setSnoozeHabit(promptHabit)}
        />
      )}

      <SnoozeSheet
        habit={snoozeHabit}
        onClose={() => setSnoozeHabit(null)}
        onSnoozed={() => {
          const h = snoozeHabit;
          setSnoozeHabit(null);
          setPromptHabit(null);
          if (h) showToast('QUEST RESCHEDULED', [h.name]);
        }}
      />

      {toast && (
        <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.toast} pointerEvents="none">
          <SystemPanel title="SYSTEM" glowing tone="success" style={{ marginBottom: 0 }}>
            <Text style={styles.toastTitle}>[{toast.title}]</Text>
            {toast.lines.map((l) => <Text key={l} style={styles.toastLine}>{l}</Text>)}
          </SystemPanel>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginBottom: Space.lg },
  player: { fontFamily: Fonts.display, fontSize: 20, letterSpacing: 2, color: Colors.textPrimary },
  rank: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 1.5, marginTop: 2 },
  points: { alignItems: 'flex-end' },
  pointsVal: { fontFamily: Fonts.display, fontSize: 28, color: Colors.gold },
  pointsLabel: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 2, color: Colors.textMuted },
  date: { fontFamily: Fonts.displaySemi, fontSize: 12, letterSpacing: 1.5, color: Colors.textSecondary },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.sm, marginBottom: Space.sm },
  progressText: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 1.5, color: Colors.textPrimary },
  perfect: { fontFamily: Fonts.display, fontSize: 13, letterSpacing: 1.5, color: Colors.success },
  toast: { position: 'absolute', top: 60, left: Space.lg, right: Space.lg },
  toastTitle: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 2, color: Colors.success },
  toastLine: { fontFamily: Fonts.displaySemi, fontSize: 13, letterSpacing: 1, color: Colors.textPrimary, marginTop: 4 },
});
