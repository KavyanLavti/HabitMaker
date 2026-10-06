import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView,
} from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Colors, Fonts, Space, URGENCY } from '@/constants/theme';
import { SystemPanel, SystemButton, sharedStyles } from '@/components/ui/System';
import { Habit, HabitInput, ScheduleType } from '@/store/habitStore';
import { formatHHMM, parseHHMM } from '@/lib/dates';

interface Props {
  visible: boolean;
  initial?: Habit;
  onSave: (data: HabitInput) => void;
  onClose: () => void;
}

const TYPES: { key: ScheduleType; label: string; hint: string }[] = [
  { key: 'fixed', label: 'FIXED TIME', hint: 'Alert at an exact time every day.' },
  { key: 'window', label: 'TIME WINDOW', hint: 'Alert when the window opens. Do it any time before it closes.' },
  { key: 'anytime', label: 'ANY TIME', hint: 'No alert. Just needs to be done today.' },
];

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const open = () => {
    const mins = parseHHMM(value) ?? 7 * 60;
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    DateTimePickerAndroid.open({
      value: d,
      mode: 'time',
      is24Hour: true,
      onChange: (e, date) => {
        if (e.type === 'set' && date) onChange(formatHHMM(date.getHours() * 60 + date.getMinutes()));
      },
    });
  };
  return (
    <View style={{ flex: 1 }}>
      <Text style={sharedStyles.inputLabel}>{label}</Text>
      <TouchableOpacity onPress={open} style={[sharedStyles.input, styles.timeBtn]}>
        <Text style={[styles.timeText, !value && { color: Colors.textMuted }]}>{value || '--:--'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function AddHabitModal({ visible, initial, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [urgency, setUrgency] = useState<1 | 2 | 3 | 4>(2);
  const [points, setPoints] = useState('');
  const [duration, setDuration] = useState('');
  const [type, setType] = useState<ScheduleType>('fixed');
  const [time, setTime] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [hasGoal, setHasGoal] = useState(false);
  const [totalDays, setTotalDays] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setUrgency(initial?.urgencyLevel ?? 2);
    setPoints(initial ? String(initial.pointsPerCompletion) : '');
    setDuration(initial ? String(initial.dailyDurationMinutes) : '');
    setType(initial?.scheduleType ?? 'fixed');
    setTime(initial?.scheduledTime ?? '');
    setWindowEnd(initial?.windowEnd ?? '');
    setHasGoal(!!initial?.totalDays);
    setTotalDays(initial?.totalDays ? String(initial.totalDays) : '');
    setError(null);
  }, [visible]);

  const save = () => {
    if (!name.trim()) return setError('Give the quest a name.');
    if (type !== 'anytime' && !time) return setError(type === 'window' ? 'Set when the window opens.' : 'Set a time.');
    if (type === 'window') {
      if (!windowEnd) return setError('Set when the window closes.');
      if ((parseHHMM(windowEnd) ?? 0) <= (parseHHMM(time) ?? 0)) return setError('The window must close after it opens.');
    }
    onSave({
      name: name.trim(),
      urgencyLevel: urgency,
      pointsPerCompletion: Number(points) || 10,
      dailyDurationMinutes: Number(duration) || 30,
      scheduleType: type,
      scheduledTime: type === 'anytime' ? null : time,
      windowEnd: type === 'window' ? windowEnd : null,
      totalDays: hasGoal ? Number(totalDays) || null : null,
      isDaily: !hasGoal,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="height">
        <SystemPanel title={initial ? 'EDIT QUEST' : 'NEW QUEST'} glowing style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={sharedStyles.inputLabel}>NAME</Text>
            <TextInput
              style={[sharedStyles.input, error?.includes('name') && { borderColor: Colors.danger }]}
              value={name}
              onChangeText={(t) => { setName(t); setError(null); }}
              placeholder="e.g. Morning run"
              placeholderTextColor={Colors.textMuted}
              autoFocus={!initial}
            />

            <Text style={sharedStyles.inputLabel}>SCHEDULE</Text>
            <View style={styles.segment}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => { setType(t.key); setError(null); }}
                  style={[styles.segBtn, type === t.key && styles.segBtnOn]}
                >
                  <Text style={[styles.segText, type === t.key && { color: Colors.background }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>{TYPES.find((t) => t.key === type)!.hint}</Text>

            {type !== 'anytime' && (
              <View style={styles.row}>
                <TimeField label={type === 'window' ? 'OPENS' : 'TIME'} value={time} onChange={(v) => { setTime(v); setError(null); }} />
                {type === 'window' && (
                  <TimeField label="CLOSES" value={windowEnd} onChange={(v) => { setWindowEnd(v); setError(null); }} />
                )}
              </View>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={sharedStyles.inputLabel}>DURATION (MIN)</Text>
                <TextInput style={sharedStyles.input} value={duration} onChangeText={setDuration}
                  keyboardType="numeric" placeholder="30" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sharedStyles.inputLabel}>POINTS</Text>
                <TextInput style={sharedStyles.input} value={points} onChangeText={setPoints}
                  keyboardType="numeric" placeholder="10" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            <Text style={sharedStyles.inputLabel}>URGENCY</Text>
            <View style={styles.segment}>
              {([1, 2, 3, 4] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUrgency(u)}
                  style={[styles.segBtn, urgency === u && { backgroundColor: URGENCY[u].color, borderColor: URGENCY[u].color }]}
                >
                  <Text style={[styles.segText, { color: urgency === u ? Colors.background : URGENCY[u].color }]}>
                    {URGENCY[u].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.row, { alignItems: 'center', marginTop: Space.md }]}>
              <Text style={[sharedStyles.inputLabel, { flex: 1, marginTop: 0 }]}>FIXED-LENGTH QUEST (DAYS GOAL)</Text>
              <Switch value={hasGoal} onValueChange={setHasGoal}
                trackColor={{ true: Colors.system, false: Colors.border }} thumbColor={Colors.textPrimary} />
            </View>
            {hasGoal && (
              <TextInput style={sharedStyles.input} value={totalDays} onChangeText={setTotalDays}
                keyboardType="numeric" placeholder="30" placeholderTextColor={Colors.textMuted} />
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={[styles.row, { marginTop: Space.xl }]}>
              <SystemButton label="CANCEL" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
              <SystemButton label="SAVE" onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </SystemPanel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.88)', justifyContent: 'flex-end', padding: Space.sm },
  sheet: { maxHeight: '94%', marginBottom: Space.sm },
  row: { flexDirection: 'row', gap: Space.sm },
  segment: { flexDirection: 'row', gap: 6 },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 3,
  },
  segBtnOn: { backgroundColor: Colors.system, borderColor: Colors.system },
  segText: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.textSecondary },
  hint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  timeBtn: { justifyContent: 'center' },
  timeText: { fontFamily: Fonts.display, fontSize: 18, color: Colors.system, letterSpacing: 2 },
  error: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.danger, marginTop: Space.md },
});
