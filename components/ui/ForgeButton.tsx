import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export function ForgeButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const bg =
    variant === 'primary' ? Colors.accent :
    variant === 'danger' ? Colors.accentRed :
    'transparent';
  const border = variant === 'ghost' ? Colors.border : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }, style]}
      activeOpacity={0.75}
    >
      <Text style={[styles.label, variant === 'ghost' && { color: Colors.textMuted }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  label: {
    fontFamily: 'DMSansBold',
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
});
