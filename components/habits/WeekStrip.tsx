import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface Props {
  completedDates: string[];
}

export function WeekStrip({ completedDates }: Props) {
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return completedDates.includes(ds);
  });

  return (
    <View style={styles.row}>
      {dots.map((done, i) => (
        <View
          key={i}
          style={[styles.dot, done ? styles.dotDone : styles.dotMissed]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotDone: { backgroundColor: Colors.accentBlue },
  dotMissed: { backgroundColor: Colors.surfaceHigh },
});
