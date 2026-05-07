import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Habit } from '@/store/habitStore';
import { ForgeButton } from '@/components/ui/ForgeButton';

interface Props {
  visible: boolean;
  initial?: Partial<Habit>;
  onSave: (data: Omit<Habit, 'id' | 'createdAt' | 'archivedAt'>) => void;
  onClose: () => void;
}

export function AddHabitModal({ visible, initial, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [urgency, setUrgency] = useState<1 | 2 | 3 | 4>(2);
  const [points, setPoints] = useState('');
  const [duration, setDuration] = useState('');
  const [totalDays, setTotalDays] = useState('');
  const [isDaily, setIsDaily] = useState(true);
  const [scheduledTime, setScheduledTime] = useState('');
  const [nameError, setNameError] = useState(false);

  // Reset all fields every time the modal opens, pulling fresh values from `initial`
  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setUrgency((initial?.urgencyLevel ?? 2) as 1 | 2 | 3 | 4);
    setPoints(initial?.pointsPerCompletion != null ? String(initial.pointsPerCompletion) : '');
    setDuration(initial?.dailyDurationMinutes != null ? String(initial.dailyDurationMinutes) : '');
    setTotalDays(initial?.totalDays != null ? String(initial.totalDays) : '');
    setIsDaily(initial?.isDaily ?? true);
    setScheduledTime(initial?.scheduledTime ?? '');
    setNameError(false);
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    onSave({
      name: name.trim(),
      urgencyLevel: urgency,
      pointsPerCompletion: Number(points) || 10,
      dailyDurationMinutes: Number(duration) || 30,
      totalDays: isDaily ? null : Number(totalDays) || null,
      isDaily,
      scheduledTime: scheduledTime || null,
    });
    onClose();
  };

  const isEditing = !!initial?.name;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{isEditing ? 'EDIT HABIT' : 'NEW HABIT'}</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputError]}
              value={name}
              onChangeText={(t) => { setName(t); if (t.trim()) setNameError(false); }}
              placeholder="e.g. Morning run"
              placeholderTextColor={Colors.textMuted}
              autoFocus={!isEditing}
            />
            {nameError && <Text style={styles.errorText}>Name is required</Text>}

            <Text style={styles.label}>Urgency Level</Text>
            <View style={styles.urgencyRow}>
              {([1, 2, 3, 4] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUrgency(u)}
                  style={[
                    styles.urgencyBtn,
                    urgency === u && { backgroundColor: Colors.accent, borderColor: Colors.accent }
                  ]}
                >
                  <Text style={[styles.urgencyBtnText, urgency === u && { color: Colors.background }]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Points / completion</Text>
                <TextInput
                  style={styles.input}
                  value={points}
                  onChangeText={setPoints}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput
                  style={styles.input}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>Scheduled Time (HH:MM, optional)</Text>
            <TextInput
              style={styles.input}
              value={scheduledTime}
              onChangeText={setScheduledTime}
              placeholder="07:00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Daily / Ongoing</Text>
              <Switch
                value={isDaily}
                onValueChange={setIsDaily}
                trackColor={{ true: Colors.accent, false: Colors.border }}
                thumbColor={Colors.textPrimary}
              />
            </View>

            {!isDaily && (
              <>
                <Text style={styles.label}>Total Days Goal</Text>
                <TextInput
                  style={styles.input}
                  value={totalDays}
                  onChangeText={setTotalDays}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}

            <View style={styles.btnRow}>
              <ForgeButton label="SAVE" onPress={handleSave} style={{ flex: 1 }} />
              <ForgeButton label="CANCEL" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '92%',
  },
  title: {
    fontFamily: 'BebasNeue',
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 16,
    letterSpacing: 1,
  },
  label: {
    fontFamily: 'DMSansMedium',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 8,
    padding: 10,
    color: Colors.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: Colors.accentRed,
    shadowColor: Colors.accentRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 5,
  },
  errorText: {
    fontFamily: 'DMSans',
    fontSize: 11,
    color: Colors.accentRed,
    marginTop: 3,
  },
  row: { flexDirection: 'row', gap: 0 },
  urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  urgencyBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urgencyBtnText: {
    fontFamily: 'DMSansBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 8 },
});
