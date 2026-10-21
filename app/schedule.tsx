import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { ScreenHeader, SystemButton, SystemPanel, Body, sharedStyles } from '@/components/ui/System';
import { DayTimeline } from '@/components/schedule/DayTimeline';
import { useHabitStore, Habit } from '@/store/habitStore';
import { useScheduleStore, conflictKey } from '@/store/scheduleStore';
import { SYNC_DAYS } from '@/lib/calendarSync';
import { addDaysKey, describeKey, todayKey } from '@/lib/dates';
import { clashesWith, fmt, hhmm, plannedSlot, suggestSlots, SchedHabit } from '@/lib/scheduling';

const toSched = (h: Habit): SchedHabit => ({
  id: h.id, name: h.name, scheduleType: h.scheduleType, scheduledTime: h.scheduledTime,
  windowEnd: h.windowEnd, dailyDurationMinutes: h.dailyDurationMinutes,
});

/** Move one day of a habit, with your calendar and smart suggestions in view. */
export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ habit?: string; date?: string }>();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const { busyByDate, overrides, conflicts, calendarEnabled, setOverride, clearOverride, markConflictsSeen } = useScheduleStore();

  const schedulable = habits.filter((h) => h.scheduleType === 'fixed' || h.scheduleType === 'window');
  const [habitId, setHabitId] = useState<string | undefined>(params.habit ?? conflicts[0]?.habitId ?? schedulable[0]?.id);
  const [date, setDate] = useState<string>(params.date ?? conflicts.find((c) => c.habitId === habitId)?.date ?? todayKey());
  const habit = habits.find((h) => h.id === habitId);

  useEffect(() => { markConflictsSeen(conflicts.map(conflictKey)); }, [conflicts]);

  const sched = habit ? toSched(habit) : null;
  const busy = busyByDate[date] ?? [];
  const current = sched ? plannedSlot(sched, busy, overrides[habit!.id]?.[date]) : null;
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => setPick(null), [habitId, date]);

  const duration = Math.max(5, habit?.dailyDurationMinutes || 30);
  const slot = current ? (pick != null ? { start: pick, end: pick + duration } : current) : null;

  // Past completion start times feed the "when you actually do it" rule
  const history = useMemo(() => {
    if (!habit) return [];
    return completions
      .filter((c) => c.habitId === habit.id)
      .slice(0, 30)
      .map((c) => {
        const d = new Date(c.completedAt);
        return Math.max(0, d.getHours() * 60 + d.getMinutes() - Math.round(c.durationMinutes || 0));
      });
  }, [habit?.id, completions]);
  const suggestions = useMemo(() => (sched ? suggestSlots(sched, busy, history) : []), [sched?.id, busy, history]);

  const dates = Array.from({ length: SYNC_DAYS }, (_, i) => addDaysKey(todayKey(), i));
  const conflictDates = new Set(conflicts.filter((c) => c.habitId === habitId).map((c) => c.date));
  const clashes = slot ? clashesWith(slot, busy) : [];
  const isOverridden = habit ? overrides[habit.id]?.[date] != null : false;
  const { day, date: dateText } = describeKey(date);

  const save = async () => {
    if (!habit || !slot) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setOverride(habit.id, date, fmt(slot.start));
    setPick(null);
    // Jump to the next remaining conflict, if any
    const next = useScheduleStore.getState().conflicts[0];
    if (next) {
      setHabitId(next.habitId);
      setDate(next.date);
    } else {
      Alert.alert('[SYSTEM]', `${habit.name} moved to ${fmt(slot.start)} on ${day.toLowerCase()}. No conflicts left.`);
    }
  };

  if (!schedulable.length) {
    return (
      <SafeAreaView style={sharedStyles.screen}>
        <Header onClose={() => router.back()} />
        <Body muted style={{ padding: Space.lg }}>Only fixed-time and window quests can be rescheduled.</Body>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top', 'bottom']}>
      <Header onClose={() => router.back()} />
      <View style={styles.body}>
        {!calendarEnabled && (
          <SystemPanel tone="ember" style={{ marginBottom: Space.sm }}>
            <Body style={{ fontSize: 12 }}>Connect Google Calendar in Settings to see your events here.</Body>
          </SystemPanel>
        )}

        {/* Which habit */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 6 }}>
          {schedulable.map((h) => {
            const n = conflicts.filter((c) => c.habitId === h.id).length;
            const on = h.id === habitId;
            return (
              <TouchableOpacity key={h.id} onPress={() => setHabitId(h.id)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && { color: Colors.background }]}>{h.name}{n ? `  ⚠${n}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Which day: a two-week strip, conflicts marked */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow} contentContainerStyle={{ gap: 6 }}>
          {dates.map((d) => {
            const info = describeKey(d);
            const on = d === date;
            const bad = conflictDates.has(d);
            return (
              <TouchableOpacity key={d} onPress={() => setDate(d)}
                style={[styles.day, on && { borderColor: Colors.system, ...glow(Colors.system) }, bad && !on && { borderColor: Colors.danger }]}>
                <Text style={[styles.dayName, bad && { color: Colors.danger }]}>{info.day.slice(0, 3)}</Text>
                <Text style={[styles.dayNum, on && { color: Colors.system }]}>{Number(d.slice(8))}</Text>
                {habit && overrides[habit.id]?.[d] != null && <View style={styles.movedDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {habit && slot ? (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusDay}>{day} · {dateText}</Text>
              {clashes.length ? (
                <Text style={[styles.status, { color: Colors.danger }]}>⚠ CLASHES WITH {clashes.map((c) => c.title).join(', ').toUpperCase()}</Text>
              ) : (
                <Text style={[styles.status, { color: Colors.success }]}>✓ FREE · {fmt(slot.start)}–{fmt(slot.end)}</Text>
              )}
            </View>

            {/* Smart suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0, marginBottom: Space.sm }}>
              {suggestions.map((s, i) => (
                <TouchableOpacity key={s.start} onPress={() => { Haptics.selectionAsync(); setPick(s.start); }}
                  style={[styles.sug, pick === s.start && { borderColor: Colors.gold, ...glow(Colors.gold) }]}>
                  <Text style={styles.sugTime}>{i === 0 ? '★ ' : ''}{fmt(s.start)}</Text>
                  <Text style={styles.sugReason} numberOfLines={2}>{s.reason}</Text>
                </TouchableOpacity>
              ))}
              {!suggestions.length && <Body muted style={{ fontSize: 12 }}>No free slot long enough today.</Body>}
            </ScrollView>

            <DayTimeline
              busy={busy}
              slot={slot}
              label={habit.name}
              window={habit.scheduleType === 'window' ? { start: hhmm(habit.scheduledTime)!, end: hhmm(habit.windowEnd)! } : null}
              suggestions={suggestions.map((s) => s.start)}
              onPick={(m) => { Haptics.selectionAsync(); setPick(m); }}
            />
            <Text style={styles.tapHint}>Tap the timeline to place it · ★ = suggested</Text>

            <View style={styles.actions}>
              {isOverridden && (
                <SystemButton label="RESET TO USUAL" variant="ghost" small style={{ flex: 1 }}
                  onPress={() => clearOverride(habit.id, date)} />
              )}
              <SystemButton
                label={`SAVE FOR ${day.slice(0, 3)}`}
                tone={clashes.length ? 'ember' : 'system'}
                disabled={pick == null && !conflictDates.has(date)}
                onPress={() => (clashes.length
                  ? Alert.alert('Still clashes', 'Save anyway?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: save }])
                  : save())}
                style={{ flex: 2 }}
              />
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <ScreenHeader
      kicker="SCHEDULE"
      title="RESCHEDULE"
      right={<TouchableOpacity onPress={onClose} style={{ padding: 6 }}><Ionicons name="close" size={26} color={Colors.textSecondary} /></TouchableOpacity>}
    />
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: Space.lg, paddingBottom: Space.md },
  chipsRow: { flexGrow: 0, marginBottom: Space.sm },
  chip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceHigh, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: Colors.system, borderColor: Colors.system },
  chipText: { fontFamily: Fonts.displaySemi, fontSize: 12, letterSpacing: 1, color: Colors.textSecondary },
  daysRow: { flexGrow: 0, marginBottom: Space.md },
  day: {
    width: 48, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 3, backgroundColor: Colors.surface,
  },
  dayName: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1, color: Colors.textMuted },
  dayNum: { fontFamily: Fonts.display, fontSize: 18, color: Colors.textPrimary },
  movedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.gold, marginTop: 2 },
  statusRow: { marginBottom: Space.sm },
  statusDay: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 1.5, color: Colors.textPrimary },
  status: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  sug: { width: 140, borderWidth: 1, borderColor: Colors.gold + '66', backgroundColor: Colors.surfaceHigh, borderRadius: 3, padding: 8 },
  sugTime: { fontFamily: Fonts.display, fontSize: 16, color: Colors.gold },
  sugReason: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  tapHint: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
  actions: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm },
});
