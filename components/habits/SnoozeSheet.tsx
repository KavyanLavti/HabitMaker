import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body } from '@/components/ui/System';
import { Habit } from '@/store/habitStore';
import { useSnoozeStore } from '@/store/snoozeStore';
import { atMinutes, formatHHMM, minutesNow, parseHHMM } from '@/lib/dates';
import { SystemGuard } from '@/modules/system-guard';

const QUICK = [15, 30, 60, 120];

interface Props {
  habit: Habit | null;
  onClose: () => void;
  /** Called after a snooze is set, instead of the sheet just closing. */
  onSnoozed?: () => void;
}

/** "For today, shift it to this time." Window quests can only be pushed to the end of their window. */
export function SnoozeSheet({ habit, onClose, onSnoozed }: Props) {
  const setSnooze = useSnoozeStore((s) => s.setUntil);
  if (!habit) return null;

  const latest = habit.scheduleType === 'window' ? parseHHMM(habit.windowEnd) ?? 24 * 60 - 1 : 24 * 60 - 1;
  const now = minutesNow();

  const apply = (minutes: number) => {
    if (minutes <= now) {
      Alert.alert('Pick a later time', 'Snooze has to be later today.');
      return;
    }
    if (minutes > latest) {
      Alert.alert('Outside the window', `${habit.name} must happen before ${habit.windowEnd}.`);
      return;
    }
    SystemGuard.snoozeReminder(habit.id, atMinutes(minutes));
    setSnooze(habit.id, formatHHMM(minutes));
    (onSnoozed ?? onClose)();
  };

  const pick = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type === 'set' && date) apply(date.getHours() * 60 + date.getMinutes());
      },
    });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SystemPanel title="RESCHEDULE FOR TODAY" glowing>
          <Text style={styles.name}>{habit.name}</Text>
          {habit.scheduleType === 'window' && (
            <Body muted style={{ marginBottom: Space.sm }}>Window closes at {habit.windowEnd}.</Body>
          )}
          <View style={styles.grid}>
            {QUICK.map((m) => {
              const at = now + m;
              const ok = at <= latest;
              return (
                <TouchableOpacity
                  key={m}
                  disabled={!ok}
                  onPress={() => apply(at)}
                  style={[styles.chip, !ok && { opacity: 0.3 }]}
                >
                  <Text style={styles.chipMain}>+{m >= 60 ? `${m / 60}H` : `${m}M`}</Text>
                  <Text style={styles.chipSub}>{formatHHMM(at)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <SystemButton label="PICK A TIME" onPress={pick} variant="outline" />
          <SystemButton label="BACK" onPress={onClose} variant="ghost" style={{ marginTop: Space.sm }} />
        </SystemPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.9)', justifyContent: 'center', padding: Space.xl },
  name: { fontFamily: Fonts.display, fontSize: 20, color: Colors.textPrimary, letterSpacing: 1, marginBottom: Space.sm },
  grid: { flexDirection: 'row', gap: Space.sm, marginVertical: Space.md },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.systemDim,
    backgroundColor: Colors.surfaceHigh,
    paddingVertical: Space.md,
    alignItems: 'center',
    borderRadius: 3,
  },
  chipMain: { fontFamily: Fonts.display, fontSize: 16, color: Colors.system },
  chipSub: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
