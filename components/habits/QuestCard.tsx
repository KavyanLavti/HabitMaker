import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Space, URGENCY, glow } from '@/constants/theme';
import { SystemPanel } from '@/components/ui/System';
import { Habit } from '@/store/habitStore';
import { StreakState, MAX_FREEZES } from '@/lib/streaks';
import { addDaysKey, minutesNow, parseHHMM, todayKey } from '@/lib/dates';

export type QuestTiming = { label: string; color: string; urgent: boolean };

/** Where a quest sits in the day right now: upcoming, open, overdue... */
export function questTiming(habit: Habit, done: boolean): QuestTiming {
  if (done) return { label: 'CLEARED', color: Colors.success, urgent: false };
  const now = minutesNow();
  const start = parseHHMM(habit.scheduledTime);
  if (habit.scheduleType === 'anytime' || start == null) {
    return { label: 'ANY TIME', color: Colors.textSecondary, urgent: false };
  }
  if (habit.scheduleType === 'window') {
    const end = parseHHMM(habit.windowEnd) ?? 24 * 60 - 1;
    if (now < start) return { label: `OPENS ${habit.scheduledTime}`, color: Colors.textSecondary, urgent: false };
    if (now <= end) return { label: `OPEN · UNTIL ${habit.windowEnd}`, color: Colors.system, urgent: true };
    return { label: 'WINDOW MISSED', color: Colors.danger, urgent: false };
  }
  if (now < start) return { label: habit.scheduledTime!, color: Colors.textSecondary, urgent: false };
  return { label: `OVERDUE · ${habit.scheduledTime}`, color: Colors.ember, urgent: true };
}

interface Props {
  habit: Habit;
  completedKeys: Set<string>;
  streak: StreakState;
  completionCount: number;
  done: boolean;
  snoozedTo?: string | null;
  onStart: () => void;
  onLongPress?: () => void;
}

export function QuestCard({ habit, completedKeys, streak, completionCount, done, snoozedTo, onStart, onLongPress }: Props) {
  const timing: QuestTiming = !done && snoozedTo
    ? { label: `SNOOZED → ${snoozedTo}`, color: Colors.shadow, urgent: false }
    : questTiming(habit, done);
  const urgency = URGENCY[habit.urgencyLevel];
  const frozen = new Set(streak.frozenDays);
  const today = todayKey();

  return (
    <SystemPanel
      tone={timing.urgent ? (timing.color === Colors.ember ? 'ember' : 'system') : 'system'}
      glowing={timing.urgent}
      dim={done}
      style={styles.panel}
    >
      <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress} delayLongPress={350}>
        <View style={styles.row}>
          <View style={[styles.urgencyBar, { backgroundColor: urgency.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.timing, { color: timing.color }]}>{timing.label}</Text>
            <Text style={[styles.name, done && styles.nameDone]} numberOfLines={1}>{habit.name}</Text>
            <Text style={styles.meta}>
              {habit.dailyDurationMinutes} MIN · +{habit.pointsPerCompletion} PTS
              {habit.totalDays ? ` · ${completionCount}/${habit.totalDays} DAYS` : ''}
            </Text>
          </View>

          {done ? (
            <View style={[styles.check, glow(Colors.success)]}>
              <Ionicons name="checkmark" size={20} color={Colors.background} />
            </View>
          ) : (
            <TouchableOpacity onPress={onStart} style={[styles.start, glow(Colors.system)]} activeOpacity={0.8}>
              <Ionicons name="play" size={14} color={Colors.background} />
              <Text style={styles.startText}>START</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.week}>
            {Array.from({ length: 7 }, (_, i) => {
              const k = addDaysKey(today, i - 6);
              const isDone = completedKeys.has(k);
              const isFrozen = frozen.has(k);
              return (
                <View
                  key={k}
                  style={[
                    styles.dot,
                    isDone && { backgroundColor: Colors.system, ...glow(Colors.system) },
                    isFrozen && { backgroundColor: Colors.frost },
                    k === today && !isDone && { borderColor: Colors.system, borderWidth: 1 },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.badges}>
            <Text style={[styles.streak, { color: streak.streak > 0 ? Colors.ember : Colors.textMuted }]}>
              🔥 {streak.streak}
            </Text>
            <View style={styles.freezes}>
              {Array.from({ length: MAX_FREEZES }, (_, i) => (
                <Ionicons
                  key={i}
                  name="snow"
                  size={13}
                  color={i < streak.freezes ? Colors.frost : Colors.border}
                />
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </SystemPanel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Space.md, paddingLeft: Space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  urgencyBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  timing: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.5 },
  name: { fontFamily: Fonts.bodyBold, fontSize: 17, color: Colors.textPrimary, marginTop: 2 },
  nameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  meta: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.textMuted, marginTop: 3 },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.system,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 3,
  },
  startText: { fontFamily: Fonts.display, fontSize: 12, letterSpacing: 1.5, color: Colors.background },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.md,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  week: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.surfaceHigh },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  streak: { fontFamily: Fonts.display, fontSize: 13 },
  freezes: { flexDirection: 'row', gap: 2 },
});
