import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body } from '@/components/ui/System';
import { Habit } from '@/store/habitStore';

/**
 * Shown when the reminder itself is tapped: the same choices as its buttons, nothing else.
 * Avoid habits get the evening check-in instead: stayed clean, or slipped.
 */
export function QuestPrompt({ habit, onStart, onSnooze, onSlip }: {
  habit: Habit | null;
  onStart: () => void;
  onSnooze: () => void;
  /** Avoid habits only: dismisses the check-in without credit for today. */
  onSlip?: () => void;
}) {
  if (!habit) return null;
  const avoid = habit.scheduleType === 'avoid';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <SystemPanel title="NOTIFICATION" glowing tone={avoid ? 'shadow' : 'system'}>
          <Text style={[styles.kicker, avoid && { color: Colors.shadow }]}>
            {avoid ? '[EVENING CHECK-IN]' : '[DAILY QUEST HAS ARRIVED]'}
          </Text>
          <Text style={styles.name}>{habit.name}</Text>
          <Body muted style={{ textAlign: 'center' }}>
            {avoid ? 'Did you stay clean today?' : `${habit.dailyDurationMinutes} minutes`} · +{habit.pointsPerCompletion} points
          </Body>
          <Body style={styles.warning}>Failure to act will not make this alert go away.</Body>
          {avoid ? (
            <>
              <SystemButton label="✓  I STAYED CLEAN" tone="shadow" onPress={onStart} />
              <SystemButton label="I SLIPPED" tone="danger" variant="outline" onPress={onSlip ?? onSnooze} style={{ marginTop: Space.sm }} />
              <SystemButton label="ASK ME LATER" variant="ghost" onPress={onSnooze} style={{ marginTop: Space.sm }} />
            </>
          ) : (
            <>
              <SystemButton label="▶  START QUEST" onPress={onStart} />
              <SystemButton label="SNOOZE" onPress={onSnooze} variant="outline" style={{ marginTop: Space.sm }} />
            </>
          )}
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
