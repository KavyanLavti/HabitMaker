// Shared "System window" building blocks. Screens should compose these instead of styling from scratch.
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp, TextStyle, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Radius, Space, glow } from '@/constants/theme';

type Tone = 'system' | 'shadow' | 'ember' | 'danger' | 'success' | 'gold';

const TONE_COLOR: Record<Tone, string> = {
  system: Colors.system,
  shadow: Colors.shadow,
  ember: Colors.ember,
  danger: Colors.danger,
  success: Colors.success,
  gold: Colors.gold,
};

/** A glowing quest window with corner brackets. */
export function SystemPanel({
  children, tone = 'system', title, style, glowing = false, dim = false,
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
  style?: StyleProp<ViewStyle>;
  glowing?: boolean;
  dim?: boolean;
}) {
  const color = TONE_COLOR[tone];
  return (
    <View
      style={[
        styles.panel,
        { borderColor: dim ? Colors.border : color + '88' },
        glowing && glow(color),
        dim && { opacity: 0.55 },
        style,
      ]}
    >
      <LinearGradient
        colors={[color + '1F', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Corner color={color} position="tl" />
      <Corner color={color} position="tr" />
      <Corner color={color} position="bl" />
      <Corner color={color} position="br" />
      {title ? (
        <View style={styles.panelTitleRow}>
          <Text style={[styles.panelTitle, { color }]}>{title}</Text>
          <View style={[styles.panelTitleLine, { backgroundColor: color + '55' }]} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Corner({ color, position }: { color: string; position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s: ViewStyle = { position: 'absolute', width: 10, height: 10, borderColor: color };
  if (position === 'tl') Object.assign(s, { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 });
  if (position === 'tr') Object.assign(s, { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 });
  if (position === 'bl') Object.assign(s, { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 });
  if (position === 'br') Object.assign(s, { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 });
  return <View style={s} pointerEvents="none" />;
}

export function SystemButton({
  label, onPress, tone = 'system', variant = 'solid', disabled, loading, style, small,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  variant?: 'solid' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const color = TONE_COLOR[tone];
  const solid = variant === 'solid';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        small && styles.btnSmall,
        {
          backgroundColor: solid ? color : variant === 'outline' ? color + '14' : 'transparent',
          borderColor: variant === 'ghost' ? Colors.border : color,
        },
        solid && !disabled && glow(color),
        (disabled || loading) && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? Colors.background : color} size="small" />
      ) : (
        <Text
          style={[
            styles.btnLabel,
            small && styles.btnLabelSmall,
            { color: solid ? Colors.background : variant === 'ghost' ? Colors.textSecondary : color },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function ScreenHeader({ kicker, title, right }: { kicker?: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function Bar({ progress, color = Colors.system, height = 6 }: { progress: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={[styles.barBg, { height }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color, height }, glow(color)]} />
    </View>
  );
}

export function Stat({ label, value, color = Colors.system }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: Colors.textMuted }, style]}>{children}</Text>;
}

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  input: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  inputLabel: {
    fontFamily: Fonts.displaySemi,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    marginTop: Space.md,
    marginBottom: Space.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.surfaceGlass,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Space.lg,
    marginBottom: Space.md,
    overflow: 'visible',
  },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.md },
  panelTitle: { fontFamily: Fonts.display, fontSize: 12, letterSpacing: 2.5 },
  panelTitleLine: { flex: 1, height: 1 },
  btn: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    paddingHorizontal: Space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: Space.md, minHeight: 32 },
  btnLabel: { fontFamily: Fonts.display, fontSize: 14, letterSpacing: 2 },
  btnLabelSmall: { fontSize: 11, letterSpacing: 1.5 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  kicker: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 3, color: Colors.system },
  title: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 2, color: Colors.textPrimary },
  sectionLabel: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 2.5,
    color: Colors.textSecondary,
    marginTop: Space.lg,
    marginBottom: Space.sm,
  },
  barBg: { backgroundColor: Colors.surfaceHigh, borderRadius: 2, overflow: 'hidden', width: '100%' },
  barFill: { borderRadius: 2 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontFamily: Fonts.display, fontSize: 22 },
  statLabel: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted, marginTop: 2 },
  body: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
});
