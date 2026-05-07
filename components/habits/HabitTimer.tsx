import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Vibration, Alert, AppState, AppStateStatus,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Colors } from '@/constants/Colors';
import { Habit } from '@/store/habitStore';

export const PAUSED_TIMER_KEY = 'hf_paused_timer';

export interface PausedTimerSession {
  habitId: string;
  remainingSeconds: number;
  savedAt: string; // ISO string
}

interface Props {
  habit: Habit;
  visible: boolean;
  onComplete: (durationMinutes: number) => void;
  onDismiss: () => void;
}

export function HabitTimer({ habit, visible, onComplete, onDismiss }: Props) {
  const totalSeconds = habit.dailyDurationMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);

  // Refs so AppState handler always sees fresh values
  const remainingRef = useRef(totalSeconds);
  const runningRef = useRef(false);
  // Epoch (ms) when the current run period started, and remaining at that moment
  const runEpochRef = useRef<number | null>(null);
  const runStartRemainingRef = useRef<number>(totalSeconds);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifIdRef = useRef<string | null>(null);
  const pulse = useSharedValue(1);

  // Keep refs in sync with state
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // On open: restore same-day paused session, or reset to full
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(PAUSED_TIMER_KEY).then((raw) => {
      const today = new Date().toISOString().slice(0, 10);
      if (raw) {
        const s: PausedTimerSession = JSON.parse(raw);
        if (s.habitId === habit.id && s.savedAt.slice(0, 10) === today) {
          setRemaining(s.remainingSeconds);
          remainingRef.current = s.remainingSeconds;
          return;
        }
      }
      setRemaining(totalSeconds);
      remainingRef.current = totalSeconds;
      setRunning(false);
      runningRef.current = false;
    });
  }, [visible, habit.id, totalSeconds]);

  // AppState: when returning to foreground, recalibrate elapsed time
  useEffect(() => {
    let bgAt: number | null = null;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        bgAt = Date.now();
      } else if (state === 'active' && bgAt !== null) {
        if (runningRef.current && runEpochRef.current !== null) {
          const bgElapsed = Math.floor((Date.now() - bgAt) / 1000);
          const newRemaining = Math.max(0, remainingRef.current - bgElapsed);
          setRemaining(newRemaining);
          remainingRef.current = newRemaining;

          if (newRemaining <= 0) {
            setRunning(false);
            runningRef.current = false;
            clearInterval(intervalRef.current!);
            cancelScheduledNotif();
            Vibration.vibrate([0, 400, 200, 400]);
          } else {
            // Restart epoch so future background trips are accurate
            runEpochRef.current = Date.now();
            runStartRemainingRef.current = newRemaining;
          }
        }
        bgAt = null;
      }
    });

    return () => sub.remove();
  }, []);

  // Start/stop the interval and schedule/cancel a completion notification
  useEffect(() => {
    if (running) {
      runEpochRef.current = Date.now();
      runStartRemainingRef.current = remaining;

      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          const next = r - 1;
          remainingRef.current = next;
          if (next <= 0) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            runningRef.current = false;
            runEpochRef.current = null;
            cancelScheduledNotif();
            Vibration.vibrate([0, 400, 200, 400]);
            return 0;
          }
          return next;
        });
      }, 1000);

      // Schedule a notification so the user is alerted even if backgrounded
      Notifications.scheduleNotificationAsync({
        content: {
          title: `${habit.name} — Done! 🎯`,
          body: 'Timer finished. Open app to save your progress.',
          sound: true,
          data: { habitId: habit.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: remaining,
          repeats: false,
        },
      }).then((id) => { notifIdRef.current = id; }).catch(() => {});

      pulse.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1
      );
    } else {
      clearInterval(intervalRef.current!);
      cancelScheduledNotif();
      runEpochRef.current = null;
      pulse.value = withTiming(1);
    }

    return () => clearInterval(intervalRef.current!);
  }, [running]);

  function cancelScheduledNotif() {
    if (notifIdRef.current) {
      Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
      notifIdRef.current = null;
    }
  }

  const elapsed = totalSeconds - remaining;
  const displayMins = Math.floor(remaining / 60);
  const displaySecs = remaining % 60;
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 1;
  const fraction = totalSeconds > 0 ? Math.min(elapsed / totalSeconds, 1) : 1;
  const partialPct = Math.round(fraction * 100);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const handleFinish = () => {
    const elapsedMins = Math.max(1, Math.round(elapsed / 60));
    const isComplete = remaining === 0;
    const msg = isComplete
      ? 'Timer complete! Save your progress?'
      : `You've done ${partialPct}% (${elapsedMins} min). How would you like to finish?`;

    Alert.alert('Finish session?', msg, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: isComplete ? 'Save Progress' : `Partial (${partialPct}%)`,
        onPress: () => {
          AsyncStorage.removeItem(PAUSED_TIMER_KEY);
          onComplete(elapsedMins);
        },
      },
      {
        // Award full points — for when the user did the activity but forgot to start the timer
        text: 'Full Points (Did it!)',
        onPress: () => {
          AsyncStorage.removeItem(PAUSED_TIMER_KEY);
          onComplete(habit.dailyDurationMinutes);
        },
      },
    ]);
  };

  const handleClose = () => {
    // If paused mid-session, offer to save progress for same-day resumption
    if (!running && elapsed > 0 && remaining > 0) {
      Alert.alert(
        'Save & Close?',
        `You've done ${partialPct}% (${Math.round(elapsed / 60)} min). ` +
        'Save and close to resume later today? Progress auto-awards tonight.',
        [
          {
            text: 'Discard & Close',
            style: 'destructive',
            onPress: () => {
              AsyncStorage.removeItem(PAUSED_TIMER_KEY);
              onDismiss();
            },
          },
          {
            text: 'Save & Close',
            onPress: async () => {
              await AsyncStorage.setItem(PAUSED_TIMER_KEY, JSON.stringify({
                habitId: habit.id,
                remainingSeconds: remaining,
                savedAt: new Date().toISOString(),
              } satisfies PausedTimerSession));
              onDismiss();
            },
          },
        ]
      );
    } else {
      AsyncStorage.removeItem(PAUSED_TIMER_KEY);
      onDismiss();
    }
  };

  const isPaused = !running && elapsed > 0 && remaining > 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.habitName}>{habit.name}</Text>

          <Animated.View style={[styles.timerRing, pulseStyle,
            running && styles.timerRingActive,
            remaining === 0 && styles.timerRingDone,
          ]}>
            <Text style={styles.timerText}>
              {String(displayMins).padStart(2, '0')}:{String(displaySecs).padStart(2, '0')}
            </Text>
            <Text style={styles.timerSub}>
              {remaining === 0 ? 'DONE!' : running ? 'IN PROGRESS' : elapsed > 0 ? 'PAUSED' : 'READY'}
            </Text>
            {elapsed > 0 && remaining > 0 && (
              <Text style={styles.timerFraction}>{partialPct}% · partial pts</Text>
            )}
          </Animated.View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
          </View>

          <View style={styles.btnRow}>
            {remaining > 0 && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: running ? Colors.surfaceHigh : Colors.accent }]}
                onPress={() => setRunning((r) => !r)}
              >
                <Text style={styles.btnText}>{running ? 'PAUSE' : elapsed > 0 ? 'RESUME' : 'START'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: Colors.accentBlue }]}
              onPress={handleFinish}
            >
              <Text style={styles.btnText}>FINISH</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: Colors.surfaceHigh }]}
              onPress={handleClose}
            >
              <Text style={[styles.btnText, { color: isPaused ? Colors.textPrimary : Colors.textMuted }]}>
                {isPaused ? 'CLOSE' : 'CANCEL'}
              </Text>
            </TouchableOpacity>
          </View>

          {isPaused && (
            <Text style={styles.pausedHint}>Tap CLOSE to save progress and resume later today</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  habitName: {
    fontFamily: 'BebasNeue',
    fontSize: 28,
    color: Colors.textPrimary,
    marginBottom: 24,
    letterSpacing: 1,
    textAlign: 'center',
  },
  timerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timerRingActive: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  timerRingDone: {
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  timerText: {
    fontFamily: 'BebasNeue',
    fontSize: 48,
    color: Colors.textPrimary,
  },
  timerSub: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  timerFraction: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: Colors.accentBlue,
    marginTop: 4,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  btnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: {
    fontFamily: 'DMSansBold',
    fontSize: 12,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  pausedHint: {
    marginTop: 14,
    fontFamily: 'DMSans',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
