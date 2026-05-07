import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useHabitStore, Habit } from '@/store/habitStore';
import { useSettingsStore } from '@/store/settingsStore';
import { AddHabitModal } from '@/components/habits/AddHabitModal';
import { scheduleHabitNotification, cancelHabitNotification, requestPermissions } from '@/lib/notificationScheduler';

const URGENCY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Med', 3: 'High', 4: 'Max' };
const URGENCY_COLOR: Record<number, string> = {
  1: Colors.textMuted,
  2: '#A3C4F3',
  3: Colors.accent,
  4: Colors.accentRed,
};

export default function QuestsTab() {
  const { habits, loaded, loadAll, addHabit, updateHabit, deleteHabit } = useHabitStore();
  const { settings } = useSettingsStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | undefined>();

  useEffect(() => {
    if (!loaded) loadAll();
    requestPermissions();
  }, []);

  const handleSave = async (data: Omit<Habit, 'id' | 'createdAt' | 'archivedAt'>) => {
    if (editHabit) {
      await updateHabit(editHabit.id, data);
      if (settings.notificationsEnabled && data.scheduledTime) {
        await scheduleHabitNotification({ ...editHabit, ...data }, settings.notifyMinutesBefore);
      }
    } else {
      const habit = await addHabit(data);
      if (settings.notificationsEnabled && data.scheduledTime) {
        await scheduleHabitNotification(habit, settings.notifyMinutesBefore);
      }
    }
    setEditHabit(undefined);
  };

  const handleDelete = (habit: Habit) => {
    Alert.alert('Delete habit?', `"${habit.name}" and all its history will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteHabit(habit.id);
          await cancelHabitNotification(habit.id);
        }
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>QUESTS</Text>
        <Text style={styles.sub}>{habits.length} active</Text>
      </View>

      <FlatList
        data={habits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No habits yet. Tap + to add your first quest.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={[styles.urgencyDot, { backgroundColor: URGENCY_COLOR[item.urgencyLevel] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.habitName}>{item.name}</Text>
                <Text style={styles.habitMeta}>
                  {URGENCY_LABEL[item.urgencyLevel]} · {item.pointsPerCompletion}pts · {item.dailyDurationMinutes}m
                  {item.scheduledTime ? ` · ${item.scheduledTime}` : ''}
                  {item.totalDays ? ` · ${item.totalDays}d goal` : ' · Daily'}
                </Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => { setEditHabit(item); setModalVisible(true); }} style={styles.actionBtn}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn]}>
                <Text style={[styles.actionText, { color: Colors.accentRed }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setEditHabit(undefined); setModalVisible(true); }}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddHabitModal
        visible={modalVisible}
        initial={editHabit}
        onSave={handleSave}
        onClose={() => { setModalVisible(false); setEditHabit(undefined); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: { fontFamily: 'BebasNeue', fontSize: 28, color: Colors.textPrimary, letterSpacing: 1 },
  sub: { fontFamily: 'DMSans', fontSize: 12, color: Colors.textMuted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  urgencyDot: { width: 10, height: 10, borderRadius: 5 },
  habitName: { fontFamily: 'DMSansBold', fontSize: 14, color: Colors.textPrimary },
  habitMeta: { fontFamily: 'DMSans', fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.surfaceHigh,
  },
  deleteBtn: { backgroundColor: 'transparent' },
  actionText: { fontFamily: 'DMSans', fontSize: 12, color: Colors.textMuted },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { fontSize: 30, color: Colors.textPrimary, lineHeight: 36 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontFamily: 'DMSans', fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
