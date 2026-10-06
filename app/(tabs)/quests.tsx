import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Space, URGENCY, glow } from '@/constants/theme';
import { SystemPanel, ScreenHeader, SectionLabel, Body, SystemButton, sharedStyles } from '@/components/ui/System';
import { AddHabitModal } from '@/components/habits/AddHabitModal';
import { useHabitStore, Habit, HabitInput, TRASH_DAYS } from '@/store/habitStore';
import { dateKeyOf, daysBetweenKeys, todayKey } from '@/lib/dates';

function scheduleLabel(h: Habit) {
  if (h.scheduleType === 'window') return `${h.scheduledTime}–${h.windowEnd}`;
  if (h.scheduleType === 'fixed') return h.scheduledTime ?? '';
  return 'ANY TIME';
}

export default function QuestsTab() {
  const habits = useHabitStore((s) => s.habits);
  const trash = useHabitStore((s) => s.trash);
  const { addHabit, updateHabit, trashHabit, restoreHabit, purgeHabit, getStreakState } = useHabitStore.getState();
  const [editing, setEditing] = useState<Habit | undefined>();
  const [modal, setModal] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [undo, setUndo] = useState<Habit | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const save = async (data: HabitInput) => {
    if (editing) await updateHabit(editing.id, data);
    else await addHabit(data);
    setEditing(undefined);
  };

  const remove = async (h: Habit) => {
    await trashHabit(h.id);
    setUndo(h);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const purge = (h: Habit) => {
    Alert.alert('Delete forever?', `"${h.name}" and all of its history will be erased. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => purgeHabit(h.id) },
    ]);
  };

  const sorted = [...habits].sort((a, b) => (a.scheduledTime ?? '99').localeCompare(b.scheduledTime ?? '99'));

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader kicker={`${habits.length} ACTIVE`} title="QUESTS" />
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: 0, paddingBottom: 120 }}>
        {habits.length === 0 && (
          <Body muted style={{ textAlign: 'center', marginTop: Space.xl }}>No quests yet. Tap + to create one.</Body>
        )}

        {sorted.map((h) => {
          const s = getStreakState(h.id);
          return (
            <SystemPanel key={h.id} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.urgency, { backgroundColor: URGENCY[h.urgencyLevel].color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{h.name}</Text>
                  <Text style={styles.meta}>
                    {scheduleLabel(h)} · {h.dailyDurationMinutes}M · +{h.pointsPerCompletion} PTS
                    {h.totalDays ? ` · ${h.totalDays}D GOAL` : ''}
                  </Text>
                  <Text style={styles.meta}>🔥 {s.streak}   ❄ {s.freezes}</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditing(h); setModal(true); }} style={styles.icon}>
                  <Ionicons name="create-outline" size={20} color={Colors.system} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(h)} style={styles.icon}>
                  <Ionicons name="trash-outline" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </SystemPanel>
          );
        })}

        {trash.length > 0 && (
          <>
            <TouchableOpacity onPress={() => setShowTrash((v) => !v)} style={styles.trashToggle}>
              <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>{`TRASH (${trash.length})`}</SectionLabel>
              <Ionicons name={showTrash ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            {showTrash && (
              <>
                <Body muted style={{ fontSize: 12, marginBottom: Space.sm }}>
                  Deleted quests keep their history here for {TRASH_DAYS} days.
                </Body>
                {trash.map((h) => {
                  const left = TRASH_DAYS - daysBetweenKeys(dateKeyOf(h.deletedAt!), todayKey());
                  return (
                    <SystemPanel key={h.id} dim style={styles.card}>
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{h.name}</Text>
                          <Text style={styles.meta}>{left} DAYS LEFT</Text>
                        </View>
                        <SystemButton label="RESTORE" small variant="outline" onPress={() => restoreHabit(h.id)} />
                        <TouchableOpacity onPress={() => purge(h)} style={styles.icon}>
                          <Ionicons name="close" size={20} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </SystemPanel>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      {undo && (
        <View style={styles.undo}>
          <Text style={styles.undoText} numberOfLines={1}>Moved "{undo.name}" to trash</Text>
          <TouchableOpacity onPress={() => { restoreHabit(undo.id); setUndo(null); }}>
            <Text style={styles.undoBtn}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[styles.fab, glow(Colors.system, 'strong')]} onPress={() => { setEditing(undefined); setModal(true); }}>
        <View style={{ transform: [{ rotate: '-45deg' }] }}>
          <Ionicons name="add" size={30} color={Colors.background} />
        </View>
      </TouchableOpacity>

      <AddHabitModal visible={modal} initial={editing} onSave={save} onClose={() => { setModal(false); setEditing(undefined); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  urgency: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  name: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.textPrimary },
  meta: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.textMuted, marginTop: 3 },
  icon: { padding: 6 },
  trashToggle: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: Space.xl, marginBottom: Space.sm },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 4,
    backgroundColor: Colors.system, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }],
  },
  undo: {
    position: 'absolute', left: Space.lg, right: 96, bottom: 24,
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    backgroundColor: Colors.surfaceHigh, borderColor: Colors.systemDim, borderWidth: 1, borderRadius: 4,
    paddingHorizontal: Space.md, paddingVertical: Space.md,
  },
  undoText: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary },
  undoBtn: { fontFamily: Fonts.display, fontSize: 13, letterSpacing: 1.5, color: Colors.system },
});
