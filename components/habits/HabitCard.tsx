import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Habit } from '@/store/habitStore';
import { WeekStrip } from './WeekStrip';
import { HabitCalendar } from './HabitCalendar';

const URGENCY_COLOR: Record<number, string> = {
  1: Colors.textMuted,
  2: '#A3C4F3',
  3: Colors.accent,
  4: Colors.accentRed,
};

interface Props {
  habit: Habit;
  completedDates: string[];
  streakDays: number;
  completionCount: number;
  completedToday: boolean;
  nearPenalty: boolean;
  onStart: () => void;
}

export function HabitCard({
  habit,
  completedDates,
  streakDays,
  completionCount,
  completedToday,
  nearPenalty,
  onStart,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const glowColor = completedToday
    ? Colors.accentBlue
    : nearPenalty
    ? Colors.accentRed
    : streakDays >= 3
    ? Colors.accentBlue
    : 'transparent';

  const glowStyle = glowColor !== 'transparent'
    ? {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
        elevation: 8,
      }
    : {};

  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.85}
      style={[styles.card, glowStyle, completedToday && styles.cardDimmed]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.urgencyBadge, { backgroundColor: URGENCY_COLOR[habit.urgencyLevel] }]}>
            <Text style={styles.urgencyText}>U{habit.urgencyLevel}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, completedToday && styles.nameDone]} numberOfLines={1}>
              {habit.name}
            </Text>
            <Text style={styles.meta}>
              {habit.scheduledTime ?? 'Any time'} · {habit.dailyDurationMinutes}m · {habit.pointsPerCompletion}pts
              {habit.totalDays ? ` · ${completionCount}/${habit.totalDays}d` : ''}
            </Text>
            <WeekStrip completedDates={completedDates} />
          </View>
        </View>

        {streakDays > 0 && (
          <Text style={styles.streak}>🔥{streakDays}</Text>
        )}

        {!completedToday && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onStart(); }}
            style={styles.startBtn}
          >
            <Text style={styles.startLabel}>START</Text>
          </TouchableOpacity>
        )}

        {completedToday && (
          <View style={styles.checkBadge}>
            <Text style={styles.check}>✓</Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <HabitCalendar completedDates={completedDates} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardDimmed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  left: { flexDirection: 'row', flex: 1, gap: 10, alignItems: 'flex-start' },
  urgencyBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  urgencyText: { fontFamily: 'DMSansBold', fontSize: 10, color: Colors.background },
  name: {
    fontFamily: 'DMSansBold',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  nameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  meta: {
    fontFamily: 'DMSans',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  streak: {
    fontFamily: 'DMSansBold',
    fontSize: 13,
    color: Colors.accent,
  },
  startBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  startLabel: { fontFamily: 'DMSansBold', fontSize: 11, color: Colors.textPrimary },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: Colors.background, fontFamily: 'DMSansBold', fontSize: 14 },
  expanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
