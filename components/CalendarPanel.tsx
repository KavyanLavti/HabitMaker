import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body } from '@/components/ui/System';
import { useScheduleStore } from '@/store/scheduleStore';

/** Settings section: connect the phone's Google calendars, pick where habits go, choose what counts as busy. */
export function CalendarPanel() {
  const s = useScheduleStore();
  const [busy, setBusy] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  if (!s.calendarEnabled) {
    return (
      <SystemPanel title="GOOGLE CALENDAR">
        <Body muted style={styles.small}>
          Uses the Google account already synced on this phone, so there's no extra sign-in. HabitForge reads your
          calendars to find clashes, and writes your quests into a calendar of your choice. Those events have no
          reminders, so you won't get duplicate notifications.
        </Body>
        <SystemButton label="CONNECT CALENDAR" loading={busy} style={{ marginTop: Space.md }}
          onPress={() => run(async () => {
            const ok = await s.connect();
            if (!ok) Alert.alert('Permission needed', 'Allow calendar access to sync quests.');
          })} />
      </SystemPanel>
    );
  }

  const writable = s.calendars.filter((c) => c.writable && c.isGoogle);
  const target = s.calendars.find((c) => c.id === s.habitCalendarId);
  const ignored = new Set(s.ignoredCalendarIds ?? []);

  return (
    <SystemPanel title="GOOGLE CALENDAR" tone={target ? 'success' : 'ember'}>
      <Text style={styles.label}>QUESTS ARE WRITTEN TO</Text>
      {!target && (
        <Body style={[styles.small, { color: Colors.ember }]}>
          Pick a calendar below. Recommended: create one called "HabitForge" on calendar.google.com (Create → New
          calendar), wait a minute for it to sync to the phone, then come back and pick it.
        </Body>
      )}
      {writable.map((c) => (
        <TouchableOpacity key={c.id} style={styles.row} onPress={() => run(() => s.setHabitCalendar(c.id))} disabled={busy}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.calName}>{c.title}</Text>
            <Text style={styles.calAcct}>{c.account}</Text>
          </View>
          <Ionicons name={c.id === s.habitCalendarId ? 'radio-button-on' : 'radio-button-off'} size={20}
            color={c.id === s.habitCalendarId ? Colors.success : Colors.textMuted} />
        </TouchableOpacity>
      ))}
      {!writable.length && <Body muted style={styles.small}>No writable Google calendars found on this phone.</Body>}
      <View style={styles.btns}>
        <SystemButton label="CREATE ON GOOGLE" small variant="outline" style={{ flex: 1 }}
          onPress={() => Linking.openURL('https://calendar.google.com/calendar/u/0/r/settings/createcalendar')} />
        <SystemButton label="RELOAD LIST" small variant="outline" loading={busy} style={{ flex: 1 }}
          onPress={() => run(s.refresh)} />
      </View>

      <TouchableOpacity onPress={() => setShowSources((v) => !v)} style={styles.toggle}>
        <Text style={styles.label}>CHECK CLASHES AGAINST ({s.calendars.filter((c) => !ignored.has(c.id) && c.id !== s.habitCalendarId).length})</Text>
        <Ionicons name={showSources ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      {showSources && s.calendars.filter((c) => c.id !== s.habitCalendarId).map((c) => (
        <TouchableOpacity key={c.id} style={styles.row} onPress={() => run(() => s.toggleIgnored(c.id))} disabled={busy}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.calName}>{c.title}</Text>
            <Text style={styles.calAcct}>{c.account}</Text>
          </View>
          <Ionicons name={ignored.has(c.id) ? 'square-outline' : 'checkbox'} size={20}
            color={ignored.has(c.id) ? Colors.textMuted : Colors.system} />
        </TouchableOpacity>
      ))}

      <Body muted style={styles.small}>
        {s.syncing ? 'Syncing…' : s.lastSyncAt ? `Synced ${new Date(s.lastSyncAt).toLocaleTimeString()} · ${s.conflicts.length} conflict(s) in the next 2 weeks` : ''}
      </Body>
      {s.lastError ? <Body style={[styles.small, { color: Colors.danger }]}>{s.lastError}</Body> : null}
      <SystemButton label="DISCONNECT" small variant="ghost" style={{ marginTop: Space.sm }}
        onPress={() => Alert.alert('Disconnect calendar?', 'Upcoming HabitForge events are removed from your calendar.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: () => run(s.disconnect) },
        ])} />
    </SystemPanel>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 12, marginTop: Space.sm },
  label: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.5, color: Colors.textSecondary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dot: { width: 12, height: 12, borderRadius: 6 },
  calName: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  calAcct: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  btns: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  toggle: { flexDirection: 'row', alignItems: 'center', marginTop: Space.lg, marginBottom: 4 },
});
