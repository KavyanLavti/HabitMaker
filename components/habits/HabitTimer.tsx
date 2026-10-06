import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Alert, Vibration, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { SystemPanel, SystemButton, Bar } from '@/components/ui/System';
import { Habit } from '@/store/habitStore';
import { todayKey } from '@/lib/dates';
import { SystemGuard } from '@/modules/system-guard';

export const TIMER_KEY = 'hf_timer_session_v2';

/** Timestamp-based so it stays correct while the app is backgrounded or killed. */
export interface TimerSession {
  habitId: string;
  date: string;
  totalSec: number;
  elapsedSec: number; // banked before the current run
  runningSince: number | null; // epoch ms
}

export function remainingSec(s: TimerSession, now = Date.now()): number {
  const running = s.runningSince ? (now - s.runningSince) / 1000 : 0;
  return Math.max(0, s.totalSec - s.elapsedSec - running);
}

export async function loadTimerSession(): Promise<TimerSession | null> {
  try {
    const raw = await AsyncStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearTimerSession() {
  await AsyncStorage.removeItem(TIMER_KEY);
  SystemGuard.cancelTimer();
}

interface Props {
  habit: Habit;
  visible: boolean;
  autoStart?: boolean;
  onComplete: (durationMinutes: number) => void;
  onClose: () => void;
}

export function HabitTimer({ habit, visible, autoStart, onComplete, onClose }: Props) {
  const [session, setSession] = useState<TimerSession | null>(null);
  const [, setTick] = useState(0);
  const finishedRef = useRef(false);
  const pulse = useSharedValue(1);

  const persist = (s: TimerSession) => {
    setSession(s);
    AsyncStorage.setItem(TIMER_KEY, JSON.stringify(s));
  };

  // Restore today's session for this habit, or start fresh
  useEffect(() => {
    if (!visible) return;
    finishedRef.current = false;
    loadTimerSession().then((saved) => {
      let s: TimerSession =
        saved && saved.habitId === habit.id && saved.date === todayKey()
          ? saved
          : { habitId: habit.id, date: todayKey(), totalSec: habit.dailyDurationMinutes * 60, elapsedSec: 0, runningSince: null };
      if (autoStart && !s.runningSince && remainingSec(s) > 0) {
        s = { ...s, runningSince: Date.now() };
        SystemGuard.showTimer(habit.id, habit.name, Date.now() + remainingSec(s) * 1000);
      }
      persist(s);
    });
  }, [visible, habit.id]);

  const running = !!session?.runningSince;
  const remaining = session ? remainingSec(session) : habit.dailyDurationMinutes * 60;
  const total = session?.totalSec ?? habit.dailyDurationMinutes * 60;
  const elapsed = total - remaining;

  useEffect(() => {
    if (!running) {
      pulse.value = withTiming(1);
      return;
    }
    pulse.value = withRepeat(withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [running]);

  // Hit zero: bank the full time and stop
  useEffect(() => {
    if (session && running && remaining <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      persist({ ...session, elapsedSec: session.totalSec, runningSince: null });
      Vibration.vibrate([0, 400, 200, 400]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  });

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!session) return null;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (running) {
      persist({ ...session, elapsedSec: total - remaining, runningSince: null });
      SystemGuard.cancelTimer();
    } else {
      persist({ ...session, runningSince: Date.now() });
      SystemGuard.showTimer(habit.id, habit.name, Date.now() + remaining * 1000);
    }
  };

  const finish = (minutes: number) => {
    clearTimerSession();
    onComplete(minutes);
  };

  const handleFinish = () => {
    const mins = Math.max(1, Math.round(elapsed / 60));
    const pct = Math.round((elapsed / total) * 100);
    if (remaining <= 0) return finish(habit.dailyDurationMinutes);
    Alert.alert('Finish quest?', `${pct}% done (${mins} min).`, [
      { text: 'Keep going', style: 'cancel' },
      { text: `Partial (${pct}%)`, onPress: () => finish(mins) },
      // For when the work was done without the timer running
      { text: 'Full (I did it all)', onPress: () => finish(habit.dailyDurationMinutes) },
    ]);
  };

  const handleAbandon = () => {
    Alert.alert('Abandon session?', 'The timer and its progress will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: () => { clearTimerSession(); onClose(); } },
    ]);
  };

  const handleClose = () => {
    if (elapsed <= 0 && !running) clearTimerSession();
    onClose(); // a running or paused session stays saved and resumes from the notification or the card
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(Math.floor(remaining % 60)).padStart(2, '0');
  const state = remaining <= 0 ? 'CLEARED' : running ? 'IN PROGRESS' : elapsed > 0 ? 'PAUSED' : 'READY';
  const tone = remaining <= 0 ? Colors.success : running ? Colors.system : Colors.textSecondary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <SystemPanel title="QUEST IN PROGRESS" glowing style={styles.panel}>
          <Text style={styles.name}>{habit.name}</Text>

          <Animated.View style={[styles.clock, { borderColor: tone }, running && glow(tone, 'strong'), pulseStyle]}>
            <Text style={[styles.time, { color: tone }]}>{mm}:{ss}</Text>
            <Text style={styles.state}>{state}</Text>
          </Animated.View>

          <Bar progress={elapsed / total} color={tone} height={4} />
          <Text style={styles.hint}>
            {running ? 'Leave the app if you like — the countdown stays in your notifications.' : ' '}
          </Text>

          <View style={styles.buttons}>
            {remaining > 0 && (
              <SystemButton
                label={running ? 'PAUSE' : elapsed > 0 ? 'RESUME' : 'START'}
                onPress={toggle}
                variant={running ? 'outline' : 'solid'}
                style={{ flex: 1 }}
              />
            )}
            <SystemButton label="FINISH" onPress={handleFinish} tone="success" variant={remaining <= 0 ? 'solid' : 'outline'} style={{ flex: 1 }} />
          </View>
          <View style={styles.links}>
            <TouchableOpacity onPress={handleClose}><Text style={styles.link}>HIDE</Text></TouchableOpacity>
            {elapsed > 0 && (
              <TouchableOpacity onPress={handleAbandon}><Text style={[styles.link, { color: Colors.danger }]}>ABANDON</Text></TouchableOpacity>
            )}
          </View>
        </SystemPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.94)', justifyContent: 'center', padding: Space.xl },
  panel: { padding: Space.xl },
  name: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 1.5, color: Colors.textPrimary, textAlign: 'center' },
  clock: {
    alignSelf: 'center',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Space.xl,
    backgroundColor: Colors.surface,
  },
  time: { fontFamily: Fonts.display, fontSize: 52, letterSpacing: 2 },
  state: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 3, color: Colors.textMuted },
  hint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Space.sm, minHeight: 18 },
  buttons: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Space.xl, marginTop: Space.lg },
  link: { fontFamily: Fonts.displaySemi, fontSize: 12, letterSpacing: 2, color: Colors.textSecondary },
});
