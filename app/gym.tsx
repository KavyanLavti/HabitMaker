import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, Alert, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { ScreenHeader, SystemPanel, SystemButton, Body, sharedStyles } from '@/components/ui/System';
import { useGymStore, Exercise, WorkoutSet } from '@/store/gymStore';
import { addDaysKey, describeKey, todayKey } from '@/lib/dates';
import { estimate1RM, prSetIds, recentExerciseOrder, setVolume } from '@/lib/gymAnalytics';

const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function GymScreen() {
  const router = useRouter();
  const { exercises, sets, addExercise, addSet, updateSet, deleteSet, removeExerciseFromDay } = useGymStore();
  const [date, setDate] = useState(todayKey());
  const [picking, setPicking] = useState(false);

  const daySets = sets.filter((s) => s.date === date);
  const exerciseIds = [...new Set(daySets.map((s) => s.exerciseId))];
  const prs = useMemo(() => prSetIds(sets), [sets]);
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercise';
  const { day, date: dateText } = describeKey(date);
  const totalVolume = daySets.reduce((n, s) => n + setVolume(s), 0);

  /** Starts an exercise for the day with one set, pre-filled from the last time you did it. */
  const startExercise = async (ex: Exercise) => {
    setPicking(false);
    if (daySets.some((s) => s.exerciseId === ex.id)) return;
    const last = [...sets].filter((s) => s.exerciseId === ex.id).sort((a, b) => b.date.localeCompare(a.date) || b.setIndex - a.setIndex)[0];
    await addSet(date, ex.id, last?.reps ?? 10, last?.weightKg ?? 20);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader
        kicker="TRAINING LOG"
        title="GYM"
        right={<TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}><Ionicons name="close" size={26} color={Colors.textSecondary} /></TouchableOpacity>}
      />

      {/* Date navigation */}
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => setDate(addDaysKey(date, -1))} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={Colors.system} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(todayKey())} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.dayName}>{date === todayKey() ? 'TODAY' : day}</Text>
          <Text style={styles.dateText}>{dateText}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(addDaysKey(date, 1))} style={styles.arrow} disabled={date >= todayKey()}>
          <Ionicons name="chevron-forward" size={22} color={date >= todayKey() ? Colors.border : Colors.system} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: Space.sm, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {daySets.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.sumItem}>{exerciseIds.length} EXERCISES</Text>
              <Text style={styles.sumItem}>{daySets.length} SETS</Text>
              <Text style={[styles.sumItem, { color: Colors.gold }]}>{Math.round(totalVolume).toLocaleString()} KG VOLUME</Text>
            </View>
          )}

          {exerciseIds.length === 0 && (
            <Body muted style={{ textAlign: 'center', marginTop: Space.xl }}>
              Nothing logged {date === todayKey() ? 'today' : 'on this day'}. Tap ADD EXERCISE to start.
            </Body>
          )}

          {exerciseIds.map((exId, i) => {
            const rows = daySets.filter((s) => s.exerciseId === exId).sort((a, b) => a.setIndex - b.setIndex);
            const best = Math.max(...rows.map((r) => estimate1RM(r.weightKg, r.reps)));
            return (
              <Animated.View key={exId} entering={FadeInDown.delay(i * 60).springify()} layout={LinearTransition}>
                <SystemPanel title={nameOf(exId).toUpperCase()}>
                  <View style={styles.headRow}>
                    <Text style={[styles.col, styles.colSet]}>SET</Text>
                    <Text style={[styles.col, styles.colIn]}>KG</Text>
                    <Text style={[styles.col, styles.colIn]}>REPS</Text>
                    <Text style={[styles.col, { flex: 1 }]}>EST. 1RM</Text>
                  </View>
                  {rows.map((r, idx) => (
                    <SetLine key={r.id} row={r} n={idx + 1} pr={prs.has(r.id)}
                      onChange={(c) => updateSet(r.id, c)} onDelete={() => deleteSet(r.id)} />
                  ))}
                  <View style={styles.exFooter}>
                    <TouchableOpacity
                      style={styles.addSet}
                      onPress={() => {
                        const last = rows[rows.length - 1];
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        addSet(date, exId, last?.reps ?? 10, last?.weightKg ?? 20);
                      }}
                    >
                      <Ionicons name="add" size={16} color={Colors.system} />
                      <Text style={styles.addSetText}>ADD SET</Text>
                    </TouchableOpacity>
                    <Text style={styles.exStat}>BEST {fmtKg(Math.round(best * 10) / 10)} KG</Text>
                    <TouchableOpacity onPress={() => Alert.alert(`Remove ${nameOf(exId)}?`, 'All its sets on this day are deleted.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeExerciseFromDay(date, exId) },
                    ])}>
                      <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </SystemPanel>
              </Animated.View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottom}>
        <SystemButton label="+ ADD EXERCISE" onPress={() => setPicking(true)} />
      </View>

      <ExercisePicker
        visible={picking}
        exercises={exercises}
        order={recentExerciseOrder(sets)}
        onPick={startExercise}
        onCreate={async (name) => startExercise(await addExercise(name))}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

function SetLine({ row, n, pr, onChange, onDelete }: {
  row: WorkoutSet; n: number; pr: boolean;
  onChange: (c: { reps?: number; weightKg?: number }) => void; onDelete: () => void;
}) {
  const [kg, setKg] = useState(fmtKg(row.weightKg));
  const [reps, setReps] = useState(String(row.reps));
  const commit = () => {
    const w = parseFloat(kg.replace(',', '.'));
    const r = parseInt(reps, 10);
    if (!isNaN(w) && w >= 0 && !isNaN(r) && r >= 0) onChange({ weightKg: w, reps: r });
    else { setKg(fmtKg(row.weightKg)); setReps(String(row.reps)); }
  };
  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOut} layout={LinearTransition} style={styles.setRow}>
      <Text style={[styles.cell, styles.colSet]}>{n}</Text>
      <TextInput style={[styles.input, styles.colIn]} value={kg} onChangeText={setKg} onEndEditing={commit}
        keyboardType="decimal-pad" selectTextOnFocus />
      <TextInput style={[styles.input, styles.colIn]} value={reps} onChangeText={setReps} onEndEditing={commit}
        keyboardType="number-pad" selectTextOnFocus />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.cell}>{fmtKg(Math.round(estimate1RM(row.weightKg, row.reps) * 10) / 10)}</Text>
        {pr && (
          <Animated.View entering={ZoomIn.springify()} style={[styles.pr, glow(Colors.gold)]}>
            <Text style={styles.prText}>PR</Text>
          </Animated.View>
        )}
      </View>
      <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function ExercisePicker({ visible, exercises, order, onPick, onCreate, onClose }: {
  visible: boolean; exercises: Exercise[]; order: string[];
  onPick: (e: Exercise) => void; onCreate: (name: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  // Recently used first, then alphabetical
  const rank = (e: Exercise) => { const i = order.indexOf(e.id); return i === -1 ? 9999 : i; };
  const list = exercises
    .filter((e) => !query || e.name.toLowerCase().includes(query))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const exact = exercises.some((e) => e.name.toLowerCase() === query);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="height" style={styles.overlay}>
        <SystemPanel title="ADD EXERCISE" glowing style={{ maxHeight: '85%' }}>
          <TextInput style={sharedStyles.input} value={q} onChangeText={setQ} autoFocus
            placeholder="Search or type a new exercise" placeholderTextColor={Colors.textMuted} />
          {query.length > 0 && !exact && (
            <TouchableOpacity style={styles.create} onPress={() => { onCreate(q); setQ(''); }}>
              <Ionicons name="add-circle" size={20} color={Colors.success} />
              <Text style={styles.createText}>Create "{q.trim()}"</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={list}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            style={{ marginTop: Space.sm }}
            ListEmptyComponent={!query ? <Body muted style={{ padding: Space.md }}>Your exercises will appear here once you add them.</Body> : null}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.exItem} onPress={() => { onPick(item); setQ(''); }}>
                <Ionicons name="barbell-outline" size={18} color={Colors.system} />
                <Text style={styles.exName}>{item.name}</Text>
                {order.indexOf(item.id) >= 0 && order.indexOf(item.id) < 5 && <Text style={styles.recent}>RECENT</Text>}
              </TouchableOpacity>
            )}
          />
          <SystemButton label="CLOSE" variant="ghost" onPress={() => { setQ(''); onClose(); }} style={{ marginTop: Space.sm }} />
        </SystemPanel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg },
  arrow: { padding: Space.sm },
  dayName: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.system },
  dateText: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 1.5, color: Colors.textSecondary },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Space.md },
  sumItem: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.2, color: Colors.textSecondary },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  col: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted },
  colSet: { width: 34 },
  colIn: { width: 64, marginRight: 8, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  cell: { fontFamily: Fonts.display, fontSize: 14, color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, borderRadius: 3,
    paddingVertical: 6, color: Colors.textPrimary, fontFamily: Fonts.display, fontSize: 15,
  },
  pr: { backgroundColor: Colors.gold, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1 },
  prText: { fontFamily: Fonts.display, fontSize: 9, letterSpacing: 1, color: Colors.background },
  exFooter: { flexDirection: 'row', alignItems: 'center', marginTop: Space.sm, gap: Space.md },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.systemDim, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6 },
  addSetText: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 1.5, color: Colors.system },
  exStat: { flex: 1, fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.gold, textAlign: 'right' },
  bottom: { position: 'absolute', left: Space.lg, right: Space.lg, bottom: Space.xl },
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.9)', justifyContent: 'flex-end', padding: Space.sm },
  create: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: Space.md },
  createText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.success },
  exItem: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  exName: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  recent: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1, color: Colors.textMuted },
});
