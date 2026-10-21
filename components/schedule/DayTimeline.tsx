import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, GestureResponderEvent } from 'react-native';
import Animated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import { Colors, Fonts, glow } from '@/constants/theme';
import { Busy, Slot, overlaps, fmt } from '@/lib/scheduling';

const START_H = 5;
const END_H = 24;
const PX_PER_MIN = 1.1;
const SNAP = 15;
const top = (min: number) => (min - START_H * 60) * PX_PER_MIN;

interface Props {
  busy: Busy[];
  /** The habit's block for this day. */
  slot: Slot;
  label: string;
  /** Window habits: the allowed range, shaded. */
  window?: Slot | null;
  /** Suggested starts, marked on the timeline. */
  suggestions?: number[];
  onPick: (startMin: number) => void;
}

/** A Google-Calendar-style day view: your events, the habit block, and tap-anywhere to move it. */
export function DayTimeline({ busy, slot, label, window, suggestions = [], onPick }: Props) {
  const scroll = useRef<ScrollView>(null);
  const height = (END_H - START_H) * 60 * PX_PER_MIN;
  const clash = busy.some((b) => overlaps(slot, b));

  useEffect(() => {
    const y = Math.max(0, top(slot.start) - 120);
    setTimeout(() => scroll.current?.scrollTo({ y, animated: true }), 50);
  }, [slot.start]);

  const onPress = (e: GestureResponderEvent) => {
    const min = e.nativeEvent.locationY / PX_PER_MIN + START_H * 60;
    const dur = slot.end - slot.start;
    const snapped = Math.round(min / SNAP) * SNAP;
    onPick(Math.max(START_H * 60, Math.min(snapped, END_H * 60 - dur)));
  };

  return (
    <ScrollView ref={scroll} style={styles.scroll} nestedScrollEnabled>
      <Pressable onPress={onPress} style={{ height }}>
        {/* Hour grid */}
        {Array.from({ length: END_H - START_H + 1 }, (_, i) => (
          <View key={i} style={[styles.hour, { top: i * 60 * PX_PER_MIN }]} pointerEvents="none">
            <Text style={styles.hourText}>{String(START_H + i).padStart(2, '0')}:00</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {window && (
          <View pointerEvents="none" style={[styles.window, { top: top(window.start), height: (window.end - window.start) * PX_PER_MIN }]}>
            <Text style={styles.windowText}>WINDOW</Text>
          </View>
        )}

        {/* Your calendar */}
        {busy.map((b, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[styles.busy, { top: top(b.start), height: Math.max(18, (b.end - b.start) * PX_PER_MIN) }]}
          >
            <Text style={styles.busyText} numberOfLines={1}>{b.title}</Text>
            <Text style={styles.busyTime}>{fmt(b.start)}–{fmt(b.end)}</Text>
          </View>
        ))}

        {suggestions.map((s) => (
          <View key={s} pointerEvents="none" style={[styles.sugMark, { top: top(s) - 5 }]}>
            <Text style={styles.sugText}>★</Text>
          </View>
        ))}

        {/* The habit block — animates to wherever you tap */}
        <Animated.View
          layout={LinearTransition.springify().damping(16)}
          entering={FadeIn}
          pointerEvents="none"
          style={[
            styles.habit,
            { top: top(slot.start), height: Math.max(22, (slot.end - slot.start) * PX_PER_MIN) },
            { borderColor: clash ? Colors.danger : Colors.system, backgroundColor: (clash ? Colors.danger : Colors.system) + '33' },
            glow(clash ? Colors.danger : Colors.system),
          ]}
        >
          <Text style={[styles.habitText, { color: clash ? Colors.danger : Colors.system }]} numberOfLines={1}>
            {clash ? '⚠ ' : '⚔ '}{label}
          </Text>
          <Text style={styles.habitTime}>{fmt(slot.start)}–{fmt(slot.end)}</Text>
        </Animated.View>
      </Pressable>
    </ScrollView>
  );
}

const LEFT = 46;

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.surface, borderRadius: 4, borderWidth: 1, borderColor: Colors.border },
  hour: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  hourText: { width: LEFT, fontFamily: Fonts.displaySemi, fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  hourLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  window: {
    position: 'absolute', left: LEFT, right: 0, backgroundColor: Colors.shadow + '14',
    borderLeftWidth: 2, borderLeftColor: Colors.shadow, paddingLeft: 4,
  },
  windowText: { fontFamily: Fonts.displaySemi, fontSize: 8, letterSpacing: 1.5, color: Colors.shadow },
  busy: {
    position: 'absolute', left: LEFT + 4, right: 70, backgroundColor: Colors.surfaceHigh,
    borderLeftWidth: 3, borderLeftColor: Colors.textMuted, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2,
  },
  busyText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textPrimary },
  busyTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  sugMark: { position: 'absolute', right: 6 },
  sugText: { color: Colors.gold, fontSize: 12 },
  habit: {
    position: 'absolute', left: LEFT + 30, right: 8, borderWidth: 1.5, borderRadius: 3,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  habitText: { fontFamily: Fonts.display, fontSize: 12, letterSpacing: 1 },
  habitTime: { fontFamily: Fonts.displaySemi, fontSize: 10, color: Colors.textSecondary },
});
