import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body } from '@/components/ui/System';
import { Habit } from '@/store/habitStore';

/** Shown when the reminder itself is tapped: the same two choices as its buttons, nothing else. */
export function QuestPrompt({ habit, onStart, onSnooze }: { habit: Habit | null; onStart: () => void; onSnooze: () => void }) {
  if (!habit) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <SystemPanel title="NOTIFICATION" glowing>
          <Text style={styles.kicker}>[DAILY QUEST HAS ARRIVED]</Text>
          <Text style={styles.name}>{habit.name}</Text>
          <Body muted style={{ textAlign: 'center' }}>
            {habit.dailyDurationMinutes} minutes · +{habit.pointsPerCompletion} points
          </Body>
          <Body style={styles.warning}>Failure to act will not make this alert go away.</Body>
          <SystemButton label="▶  START QUEST" onPress={onStart} />
          <SystemButton label="SNOOZE" onPress={onSnooze} variant="outline" style={{ marginTop: Space.sm }} />
        </SystemPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.94)', justifyContent: 'center', padding: Space.xl },
  kicker: { fontFamily: Fonts.displaySemi, fontSize: 12, letterSpacing: 2, color: Colors.system, textAlign: 'center' },
  name: {
    fontFamily: Fonts.display, fontSize: 26, letterSpacing: 1.5, color: Colors.textPrimary,
    textAlign: 'center', marginVertical: Space.md,
  },
  warning: { color: Colors.ember, textAlign: 'center', fontSize: 12, marginVertical: Space.lg },
});
