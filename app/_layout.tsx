import '@/lib/backgroundTasks';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Oxanium_600SemiBold, Oxanium_700Bold } from '@expo-google-fonts/oxanium';
import { Exo2_400Regular, Exo2_500Medium, Exo2_700Bold } from '@expo-google-fonts/exo-2';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useHabitStore } from '@/store/habitStore';
import { useGateStore } from '@/store/gateStore';
import { useSettingsStore } from '@/store/settingsStore';
import { syncReminders, requestNotificationPermission } from '@/lib/notificationScheduler';
import { registerBackgroundTasks } from '@/lib/backgroundTasks';
import { runBackupIfDue } from '@/lib/backup';
import { todayKey } from '@/lib/dates';
import { reloadAll } from '@/lib/reload';
import { useScheduleStore } from '@/store/scheduleStore';
import { initTestMode } from '@/lib/testMode';
import { TestModeBanner } from '@/components/TestModeBanner';
import { CelebrationOverlay } from '@/components/fx/CelebrationOverlay';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.background, card: Colors.surface, primary: Colors.system },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Oxanium_600SemiBold, Oxanium_700Bold, Exo2_400Regular, Exo2_500Medium, Exo2_700Bold,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useBootstrap();

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="gym" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="schedule" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <TestModeBanner />
      <CelebrationOverlay />
    </ThemeProvider>
  );
}

/** Loads all stores once, then refreshes day-dependent state whenever the app comes back to the front. */
function useBootstrap() {
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const habitsLoaded = useHabitStore((s) => s.loaded);
  const settings = useSettingsStore((s) => s.settings);
  const overrides = useScheduleStore((s) => s.overrides);

  useEffect(() => {
    // Resume a test-mode session (sandbox database + simulated clock) before anything reads data
    initTestMode().then(reloadAll);
    requestNotificationPermission();
    registerBackgroundTasks();
    runBackupIfDue();

    let lastDay = todayKey();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const gate = useGateStore.getState();
      if (todayKey() !== lastDay) {
        lastDay = todayKey();
        reloadAll(); // gate load applies delayed rule changes and rolls the bank
      } else {
        gate.refreshUsage();
        useScheduleStore.getState().refresh(); // picks up events added in the calendar meanwhile
      }
      runBackupIfDue();
    });
    return () => sub.remove();
  }, []);

  // Keep native reminders in step with habits and reminder settings
  useEffect(() => {
    if (!habitsLoaded) return;
    const today = todayKey();
    const doneToday = completions.filter((c) => c.date === today).map((c) => c.habitId);
    syncReminders(habits, settings, doneToday, overrides);
  }, [habitsLoaded, habits, overrides, settings.notificationsEnabled, settings.notifyMinutesBefore]);

  // Habit edits move their calendar events and change conflicts
  const firstHabits = React.useRef(true);
  useEffect(() => {
    if (!habitsLoaded) return;
    if (firstHabits.current) { firstHabits.current = false; return; } // reloadAll already refreshed
    useScheduleStore.getState().refresh();
  }, [habits]);
}
