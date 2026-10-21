import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeInDown, FadeOutUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat, withSequence,
} from 'react-native-reanimated';
import { Colors, Fonts, Space, rankFor, glow } from '@/constants/theme';
import { SystemPanel, SectionLabel, Body, SystemButton, sharedStyles } from '@/components/ui/System';
import { RankEmblem } from '@/components/aura/RankEmblem';
import { QuestCard, questTiming } from '@/components/habits/QuestCard';
import { HabitTimer, loadTimerSession, clearTimerSession, remainingSec } from '@/components/habits/HabitTimer';
import { SnoozeSheet } from '@/components/habits/SnoozeSheet';
import { QuestPrompt } from '@/components/habits/QuestPrompt';
import { useHabitStore, Habit } from '@/store/habitStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSnoozeStore } from '@/store/snoozeStore';
import { useScheduleStore, conflictKey } from '@/store/scheduleStore';
import { completeQuest, logSlip } from '@/lib/quests';
import { describeKey, parseHHMM, todayKey } from '@/lib/dates';
import { fmt } from '@/lib/scheduling';
import { useTestMode } from '@/lib/testMode';
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
  const { overrides, conflicts, seenConflicts, markConflictsSeen } = useScheduleStore();

  const [timer, setTimer] = useState<{ habit: Habit; autoStart: boolean } | null>(null);
  const [snoozeHabit, setSnoozeHabit] = useState<Habit | null>(null);
  const [promptHabit, setPromptHabit] = useState<Habit | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conflictPopup, setConflictPopup] = useState(false);

  const today = todayKey();
  const dayInfo = describeKey(today);
  const testMode = useTestMode((s) => s.enabled);
  useTestMode((s) => s.offsetMs); // re-render when simulated time moves
  const level = Math.floor(lifetime / settings.pointsPerLevel) + 1;
  const rank = rankFor(level);

  const completedByHabit = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const c of completions) (m[c.habitId] ??= new Set()).add(c.date);
    return m;
  }, [completions]);
  const isDone = (id: string) => completedByHabit[id]?.has(today) ?? false;
  const movedTo = (id: string) => overrides[id]?.[today] ?? null;
  const todayClash = new Set(conflicts.filter((c) => c.date === today).map((c) => c.habitId));

  // Open quests first (urgent → by time), avoid check-ins after timed ones, cleared last
  const sorted = useMemo(() => {
    const order = (h: Habit) => {
      if (isDone(h.id)) return 4;
      if (questTiming(h, false, movedTo(h.id)).urgent) return 0;
      return h.scheduleType === 'avoid' ? 3 : h.scheduleType === 'anytime' ? 2 : 1;
    };
    const time = (h: Habit) => parseHHMM(movedTo(h.id) ?? h.scheduledTime) ?? 9999;
    return [...habits].sort((a, b) => order(a) - order(b) || time(a) - time(b));
  }, [habits, completedByHabit, overrides]);

  const clearedCount = habits.filter((h) => isDone(h.id)).length;
  const allClear = habits.length > 0 && clearedCount === habits.length;

  // New calendar conflicts pop up once
  const unseen = conflicts.filter((c) => !seenConflicts.includes(conflictKey(c)));
  useEffect(() => {
    if (loaded && unseen.length && !timer && !promptHabit) setConflictPopup(true);
  }, [loaded, unseen.length]);

  /** Start for timed quests opens the timer; for avoid habits it opens the evening check-in. */
  const begin = (h: Habit, autoStart: boolean) => {
    if (h.scheduleType === 'avoid') {
      setPromptHabit(h);
      return;
    }
    SystemGuard.markHandled(h.id);
    setTimer({ habit: h, autoStart });
  };

  // Notification buttons arrive as deep links: habitforge://today?start=<id> etc.
  useEffect(() => {
    if (!loaded) return;
    const find = (id?: string) => (id ? habits.find((h) => h.id === id) : undefined);
    let handled = false;
    if (find(params.start)) {
      begin(find(params.start)!, true);
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openSchedule = (habitId?: string, date?: string) => {
    setConflictPopup(false);
    markConflictsSeen(conflicts.map(conflictKey));
    router.push({ pathname: '/schedule', params: { ...(habitId ? { habit: habitId } : {}), ...(date ? { date } : {}) } });
  };

  const nameOf = (id: string) => habits.find((h) => h.id === id)?.name ?? 'Quest';

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, testMode && { paddingBottom: 110 }]}>
        {/* Today's day and date */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.dateBar}>
          <Text style={styles.dayName}>{dayInfo.day}</Text>
          <Text style={styles.dateText}>{dayInfo.date}</Text>
          {testMode && <Text style={styles.simTag}>SIMULATED</Text>}
        </Animated.View>

        {/* Player header */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.header}>
          <RankEmblem level={level} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.player}>{settings.displayName.toUpperCase()}</Text>
            <Text style={[styles.rank, { color: rank.color }]}>LV {level} · {rank.title.toUpperCase()}</Text>
          </View>
          <View style={styles.points}>
            <Text style={styles.pointsVal}>{Math.round(spendable)}</Text>
            <Text style={styles.pointsLabel}>POINTS</Text>
          </View>
        </Animated.View>

        {/* Daily quest summary */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <SystemPanel title="DAILY QUEST" glowing={allClear} tone={allClear ? 'success' : 'system'}>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                CLEARED <Text style={{ color: Colors.system }}>{clearedCount}</Text> / {habits.length}
              </Text>
              {allClear && <PerfectBadge />}
            </View>
            <AnimatedBar progress={habits.length ? clearedCount / habits.length : 0} color={allClear ? Colors.success : Colors.system} />
          </SystemPanel>
        </Animated.View>

        {conflicts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160)}>
            <TouchableOpacity onPress={() => openSchedule()} activeOpacity={0.85}>
              <SystemPanel tone="danger" glowing style={styles.conflictBanner}>
                <Text style={styles.conflictText}>
                  ⚠ {conflicts.length} SCHEDULE CONFLICT{conflicts.length > 1 ? 'S' : ''} IN THE NEXT 2 WEEKS
                </Text>
                <Text style={styles.conflictFix}>FIX ›</Text>
              </SystemPanel>
            </TouchableOpacity>
          </Animated.View>
        )}

        {habits.length === 0 && (
          <Body muted style={{ textAlign: 'center', marginTop: Space.xl }}>
            No quests yet. Add your first one in the QUESTS tab.
          </Body>
        )}

        {sorted.map((habit, i) => {
          const done = isDone(habit.id);
          const prevDone = i > 0 && isDone(sorted[i - 1].id);
          return (
            <Animated.View key={habit.id} entering={FadeInDown.delay(180 + i * 55).springify().damping(16)} layout={LinearTransition.springify().damping(18)}>
              {done && !prevDone && <SectionLabel>CLEARED</SectionLabel>}
              <QuestCard
                habit={habit}
                completedKeys={completedByHabit[habit.id] ?? new Set()}
                streak={getStreakState(habit.id)}
                completionCount={getCompletionCount(habit.id)}
                done={done}
                snoozedTo={snoozes.date === today ? snoozes.until[habit.id] : null}
                movedTo={movedTo(habit.id)}
                conflict={todayClash.has(habit.id)}
                onConflict={() => openSchedule(habit.id, today)}
                onStart={() => begin(habit, false)}
                onLongPress={habit.scheduleType === 'fixed' || habit.scheduleType === 'window' ? () => openSchedule(habit.id, today) : undefined}
              />
            </Animated.View>
          );
        })}
        {sorted.some((h) => h.scheduleType === 'fixed' || h.scheduleType === 'window') && (
          <Text style={styles.hint}>Long-press a quest to move it for one day.</Text>
        )}
      </ScrollView>

      {timer && (
        <HabitTimer
          habit={timer.habit}
          visible
          autoStart={timer.autoStart}
          onComplete={async (mins) => { const h = timer.habit; setTimer(null); await completeQuest(h, mins, true); }}
          onClose={() => setTimer(null)}
        />
      )}

      {/* Reminder tapped: Start or Snooze (avoid habits: stayed clean / slipped) */}
      {!snoozeHabit && (
        <QuestPrompt
          habit={promptHabit}
          onStart={async () => {
            const h = promptHabit!;
            setPromptHabit(null);
            if (h.scheduleType === 'avoid') {
              if (!isDone(h.id)) await completeQuest(h, 0, false);
              return;
            }
            SystemGuard.markHandled(h.id);
            setTimer({ habit: h, autoStart: true });
          }}
          onSlip={() => { const h = promptHabit!; setPromptHabit(null); logSlip(h); }}
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
          if (h) showToast(`${h.name} rescheduled`);
        }}
      />

      {/* New conflicts found in your calendar */}
      <Modal visible={conflictPopup} transparent animationType="fade" onRequestClose={() => setConflictPopup(false)}>
        <View style={styles.overlay}>
          <SystemPanel tone="danger" title="[SCHEDULE CONFLICT]" glowing>
            {unseen.slice(0, 4).map((c) => {
              const d = describeKey(c.date);
              return (
                <View key={conflictKey(c)} style={styles.popRow}>
                  <Text style={styles.popHabit}>{nameOf(c.habitId)} · {d.day.slice(0, 3)} {d.date.slice(0, -5)}</Text>
                  <Text style={styles.popClash}>
                    {fmt(c.slot.start)}–{fmt(c.slot.end)} clashes with {c.clashes.map((x) => `${x.title} (${fmt(x.start)}–${fmt(x.end)})`).join(', ')}
                  </Text>
                </View>
              );
            })}
            {unseen.length > 4 && <Body muted style={{ fontSize: 12 }}>+{unseen.length - 4} more</Body>}
            <SystemButton label="PICK NEW TIMES" tone="danger" style={{ marginTop: Space.md }}
              onPress={() => openSchedule(unseen[0]?.habitId, unseen[0]?.date)} />
            <SystemButton label="LATER" variant="ghost" style={{ marginTop: Space.sm }}
              onPress={() => { setConflictPopup(false); markConflictsSeen(unseen.map(conflictKey)); }} />
          </SystemPanel>
        </View>
      </Modal>

      {toast && (
        <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

/** Progress bar that springs to its new value. */
function AnimatedBar({ progress, color }: { progress: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withSpring(progress, { damping: 18, stiffness: 90 }); }, [progress]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%` }));
  return (
    <View style={styles.barBg}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, glow(color), style]} />
    </View>
  );
}

function PerfectBadge() {
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withRepeat(withSequence(withTiming(1.12, { duration: 600 }), withTiming(1, { duration: 600 })), -1);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  return <Animated.Text style={[styles.perfect, style]}>⚡ PERFECT DAY</Animated.Text>;
}

const styles = StyleSheet.create({
  content: { padding: Space.lg, paddingBottom: 40 },
  dateBar: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm, marginBottom: Space.md, flexWrap: 'wrap' },
  dayName: { fontFamily: Fonts.display, fontSize: 24, letterSpacing: 3, color: Colors.system },
  dateText: { fontFamily: Fonts.displaySemi, fontSize: 14, letterSpacing: 1.5, color: Colors.textSecondary },
  simTag: {
    fontFamily: Fonts.display, fontSize: 9, letterSpacing: 2, color: Colors.ember,
    borderColor: Colors.ember, borderWidth: 1, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginBottom: Space.lg },
  player: { fontFamily: Fonts.display, fontSize: 20, letterSpacing: 2, color: Colors.textPrimary },
  rank: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 1.5, marginTop: 2 },
  points: { alignItems: 'flex-end' },
  pointsVal: { fontFamily: Fonts.display, fontSize: 28, color: Colors.gold },
  pointsLabel: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 2, color: Colors.textMuted },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Space.sm },
  progressText: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 1.5, color: Colors.textPrimary },
  perfect: { fontFamily: Fonts.display, fontSize: 13, letterSpacing: 1.5, color: Colors.success },
  barBg: { height: 6, backgroundColor: Colors.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 2 },
  conflictBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.md },
  conflictText: { flex: 1, fontFamily: Fonts.display, fontSize: 11, letterSpacing: 1.2, color: Colors.danger },
  conflictFix: { fontFamily: Fonts.display, fontSize: 13, letterSpacing: 1.5, color: Colors.danger },
  hint: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: Space.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.92)', justifyContent: 'center', padding: Space.xl },
  popRow: { marginBottom: Space.md },
  popHabit: { fontFamily: Fonts.display, fontSize: 15, letterSpacing: 1, color: Colors.textPrimary },
  popClash: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  toast: {
    position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.system, borderWidth: 1, borderRadius: 4, paddingHorizontal: Space.lg, paddingVertical: Space.sm,
  },
  toastText: { fontFamily: Fonts.displaySemi, fontSize: 12, letterSpacing: 1.5, color: Colors.system },
});
