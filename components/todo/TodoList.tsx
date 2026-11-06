import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Pressable } from 'react-native';
import Animated, {
  FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { SystemPanel } from '@/components/ui/System';
import { useTodoStore, Todo } from '@/store/todoStore';
import { addDaysKey, todayKey } from '@/lib/dates';
import { dayStats } from '@/lib/todoAnalytics';

const POINT_STEPS = [5, 10, 20, 50];

/** Today's to-do list: add items with a point value, check them off for points. */
export function TodoList() {
  const { todos, add, toggle, remove, carryOver } = useTodoStore();
  const today = todayKey();
  const items = todos.filter((t) => t.date === today);
  const stats = dayStats(todos, today);
  const yesterdayLeft = todos.filter((t) => t.date === addDaysKey(today, -1) && !t.done);
  const alreadyCarried = new Set(items.map((t) => t.title.toLowerCase()));
  const carryable = yesterdayLeft.filter((t) => !alreadyCarried.has(t.title.toLowerCase()));

  const [title, setTitle] = useState('');
  const [points, setPoints] = useState(10);

  const submit = async () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await add(title, points);
    setTitle('');
  };

  const pct = stats.rate == null ? 0 : Math.round(stats.rate * 100);
  const allDone = stats.total > 0 && stats.done === stats.total;

  return (
    <SystemPanel title={`TODAY'S TO-DO${stats.total ? ` · ${stats.done}/${stats.total} · ${pct}%` : ''}`} tone={allDone ? 'success' : 'gold'} glowing={allDone}>
      {stats.total > 0 && (
        <View style={styles.summary}>
          <View style={styles.barBg}>
            <Animated.View layout={LinearTransition.springify()} style={[styles.barFill, { width: `${pct}%`, backgroundColor: allDone ? Colors.success : Colors.gold }]} />
          </View>
          <Text style={styles.pts}>+{stats.pointsEarned}<Text style={styles.ptsOf}> / {stats.pointsPlanned} PTS</Text></Text>
        </View>
      )}

      {carryable.length > 0 && (
        <TouchableOpacity
          style={styles.carry}
          onPress={async () => {
            const n = await carryOver(addDaysKey(today, -1));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (!n) Alert.alert('Nothing to bring over');
          }}
        >
          <Ionicons name="return-down-forward" size={16} color={Colors.ember} />
          <Text style={styles.carryText}>{carryable.length} UNFINISHED FROM YESTERDAY · BRING OVER</Text>
        </TouchableOpacity>
      )}

      {items.map((t, i) => (
        <Animated.View key={t.id} entering={FadeInDown.delay(i * 30).springify()} exiting={FadeOut} layout={LinearTransition.springify()}>
          <TodoRow
            todo={t}
            onToggle={() => toggle(t.id)}
            onDelete={() =>
              Alert.alert('Delete item?', t.done ? `"${t.title}" and its ${t.points} points are removed.` : `"${t.title}"`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => remove(t.id) },
              ])
            }
          />
        </Animated.View>
      ))}

      {/* Add */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          returnKeyType="done"
          blurOnSubmit={false}
          placeholder={items.length ? 'Add another task…' : 'What do you need to get done today?'}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity
          style={styles.pointsBtn}
          onPress={() => { Haptics.selectionAsync(); setPoints(POINT_STEPS[(POINT_STEPS.indexOf(points) + 1) % POINT_STEPS.length]); }}
        >
          <Text style={styles.pointsBtnText}>+{points}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, !title.trim() && { opacity: 0.4 }]} onPress={submit} disabled={!title.trim()}>
          <Ionicons name="add" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Tap +{points} to change the points · long-press an item to delete it</Text>
    </SystemPanel>
  );
}

function TodoRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: () => void; onDelete: () => void }) {
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(todo.done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
        pop.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1));
        onToggle();
      }}
      onLongPress={onDelete}
      delayLongPress={400}
      style={styles.row}
    >
      <Animated.View style={[styles.box, todo.done && styles.boxOn, todo.done && glow(Colors.success), style]}>
        {todo.done && <Ionicons name="checkmark" size={16} color={Colors.background} />}
      </Animated.View>
      <Text style={[styles.title, todo.done && styles.titleDone]} numberOfLines={2}>{todo.title}</Text>
      <Text style={[styles.itemPts, todo.done && { color: Colors.success }]}>+{todo.points}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginBottom: Space.sm },
  barBg: { flex: 1, height: 5, backgroundColor: Colors.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 2 },
  pts: { fontFamily: Fonts.display, fontSize: 14, color: Colors.gold },
  ptsOf: { fontSize: 10, color: Colors.textMuted },
  carry: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.ember + '88',
    borderRadius: 3, padding: Space.sm, marginBottom: Space.sm,
  },
  carryText: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.ember },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  box: {
    width: 24, height: 24, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  title: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  titleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  itemPts: { fontFamily: Fonts.display, fontSize: 13, color: Colors.gold },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Space.md },
  input: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, borderRadius: 3,
    paddingHorizontal: Space.md, paddingVertical: 9, color: Colors.textPrimary, fontFamily: Fonts.body, fontSize: 14,
  },
  pointsBtn: { borderWidth: 1, borderColor: Colors.gold, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 9 },
  pointsBtnText: { fontFamily: Fonts.display, fontSize: 13, color: Colors.gold },
  addBtn: { backgroundColor: Colors.gold, borderRadius: 3, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 6 },
});
