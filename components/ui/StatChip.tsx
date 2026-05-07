import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface Props {
  label: string;
  value: string | number;
  color?: string;
}

export function StatChip({ label, value, color = Colors.accent }: Props) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  value: {
    fontFamily: 'BebasNeue',
    fontSize: 20,
  },
  label: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
