import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface Props {
  completedDates: string[];
}

export function HabitCalendar({ completedDates }: Props) {
  const cells = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const ds = d.toISOString().slice(0, 10);
    return { date: ds, done: completedDates.includes(ds) };
  });

  return (
    <View>
      <Text style={styles.title}>Last 30 days</Text>
      <View style={styles.grid}>
        {cells.map(({ date, done }) => (
          <View
            key={date}
            style={[styles.cell, done ? styles.cellDone : styles.cellEmpty]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'DMSans',
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  cellDone: { backgroundColor: Colors.accentBlue },
  cellEmpty: { backgroundColor: Colors.surfaceHigh },
});
