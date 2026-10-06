import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Switch, Alert, TouchableOpacity, Share, Modal, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, ScreenHeader, Body, sharedStyles } from '@/components/ui/System';
import { useSettingsStore, Settings } from '@/store/settingsStore';
import { usePointStore } from '@/store/pointStore';
import { useHabitStore } from '@/store/habitStore';
import { useRewardStore } from '@/store/rewardStore';
import { useGateStore } from '@/store/gateStore';
import { buildBackupJson, restoreFromBackup } from '@/lib/dataExport';
import {
  backupNow, fetchLatestBackup, getBackupStatus, getBackupToken, setBackupToken, BackupStatus, BACKUP_HOUR,
} from '@/lib/backup';
import { requestNotificationPermission } from '@/lib/notificationScheduler';
import { SystemGuard } from '@/modules/system-guard';

function NumberRow({ label, k, value, onChange }: {
  label: string; k: keyof Settings; value: number; onChange: (k: keyof Settings, v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[sharedStyles.input, styles.num]}
        value={text}
        onChangeText={setText}
        onEndEditing={() => {
          const n = parseFloat(text);
          if (!isNaN(n) && n >= 0) onChange(k, n);
          else setText(String(value));
        }}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.system, false: Colors.border }} thumbColor={Colors.textPrimary} />
    </View>
  );
}

async function reloadEverything() {
  await Promise.all([
    useHabitStore.getState().loadAll(),
    usePointStore.getState().loadPoints(),
    useRewardStore.getState().loadRewards(),
    useGateStore.getState().load(),
  ]);
}

async function applyBackup(json: string) {
  const backup = await restoreFromBackup(json);
  if (backup.settings) {
    // Keep this device's backup configuration, take everything else from the backup
    const current = JSON.parse((await AsyncStorage.getItem('settings-store')) ?? '{}');
    const merged = {
      ...backup.settings,
      state: {
        ...backup.settings.state,
        settings: {
          ...backup.settings.state?.settings,
          backupEnabled: current?.state?.settings?.backupEnabled ?? false,
          backupRepo: current?.state?.settings?.backupRepo ?? '',
        },
      },
    };
    await AsyncStorage.setItem('settings-store', JSON.stringify(merged));
    await useSettingsStore.persist.rehydrate();
  }
  await reloadEverything();
}

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting, resetAll } = useSettingsStore();
  const up = <K extends keyof Settings>(k: K, v: Settings[K]) => updateSetting(k, v);

  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [repoInput, setRepoInput] = useState(settings.backupRepo);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [perm, setPerm] = useState({ notif: true, exact: true });

  const refreshPerms = () =>
    setPerm({ notif: SystemGuard.notificationsEnabled(), exact: SystemGuard.canScheduleExactAlarms() });

  useEffect(() => {
    getBackupToken().then((t) => setHasToken(!!t));
    getBackupStatus().then(setStatus);
    refreshPerms();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshPerms());
    return () => sub.remove();
  }, []);

  const saveBackupConfig = async () => {
    const repo = repoInput.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return Alert.alert('Repo', 'Use the form owner/repo, e.g. KavyanLavti/habitforge-backup');
    up('backupRepo', repo);
    setRepoInput(repo);
    if (tokenInput.trim()) {
      await setBackupToken(tokenInput.trim());
      setTokenInput('');
      setHasToken(true);
    }
    up('backupEnabled', true);
    Alert.alert('[SYSTEM]', `Backup armed. It runs once a day after ${BACKUP_HOUR}:00 AM. Tap BACK UP NOW to test it.`);
  };

  const runBackup = async () => {
    setBusy('backup');
    try {
      await backupNow();
      Alert.alert('Backup complete', `Saved to github.com/${settings.backupRepo}`);
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? String(e));
    } finally {
      setBusy(null);
      getBackupStatus().then(setStatus);
    }
  };

  const restoreGithub = () =>
    Alert.alert('Restore from GitHub?', 'This replaces ALL current quests, points, rewards and gate settings with the latest backup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive', onPress: async () => {
          setBusy('restore');
          try {
            await applyBackup(await fetchLatestBackup());
            Alert.alert('Restored', 'Your data is back.');
          } catch (e: any) {
            Alert.alert('Restore failed', e?.message ?? String(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const exportJson = async () => {
    const raw = await AsyncStorage.getItem('settings-store');
    await Share.share({ message: await buildBackupJson(raw ? JSON.parse(raw) : undefined), title: 'HabitForge backup' });
  };

  const importJson = () =>
    Alert.alert('Restore this backup?', 'This replaces ALL current data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive', onPress: async () => {
          try {
            await applyBackup(importText.trim());
            setImportOpen(false);
            setImportText('');
            Alert.alert('Restored', 'Backup imported.');
          } catch (e: any) {
            Alert.alert('Import failed', e?.message ?? 'Invalid backup.');
          }
        },
      },
    ]);

  const lastBackup = status?.lastAt ? new Date(status.lastAt).toLocaleString() : 'never';

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader
        kicker="SYSTEM"
        title="SETTINGS"
        right={
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <Ionicons name="close" size={26} color={Colors.textSecondary} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: 0, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <SystemPanel title="PLAYER">
          <Text style={sharedStyles.inputLabel}>NAME</Text>
          <TextInput style={sharedStyles.input} value={settings.displayName} onChangeText={(t) => up('displayName', t)} />
        </SystemPanel>

        <SystemPanel title="QUEST ALERTS">
          {(!perm.notif || !perm.exact) && (
            <View style={styles.warn}>
              {!perm.notif && (
                <>
                  <Body style={{ color: Colors.danger }}>Notifications are blocked, so quest alerts can't appear.</Body>
                  <SystemButton label="ALLOW NOTIFICATIONS" tone="danger" small onPress={async () => {
                    const ok = await requestNotificationPermission();
                    if (!ok) SystemGuard.openAppDetails();
                    refreshPerms();
                  }} style={{ marginTop: Space.sm }} />
                </>
              )}
              {!perm.exact && (
                <>
                  <Body style={{ color: Colors.ember, marginTop: Space.sm }}>Exact alarms are off, so alerts may arrive a few minutes late.</Body>
                  <SystemButton label="ALLOW EXACT ALARMS" tone="ember" small onPress={SystemGuard.openExactAlarmSettings} style={{ marginTop: Space.sm }} />
                </>
              )}
            </View>
          )}
          <SwitchRow label="Quest alerts" value={settings.notificationsEnabled} onChange={(v) => up('notificationsEnabled', v)} />
          <NumberRow label="Fixed-time alerts: minutes early" k="notifyMinutesBefore" value={settings.notifyMinutesBefore} onChange={up} />
          <Body muted style={styles.small}>Alerts can't be swiped away. They stay until you tap Start, +15 min or Pick time.</Body>
        </SystemPanel>

        <SystemPanel title="NIGHTLY BACKUP · GITHUB" tone={settings.backupEnabled ? 'success' : 'system'}>
          <Body muted style={styles.small}>
            One-time setup: 1) create a PRIVATE repo on GitHub, e.g. habitforge-backup. 2) GitHub → Settings → Developer
            settings → Fine-grained tokens → Generate. Pick only that repo, and under Repository permissions set Contents to
            "Read and write". 3) Paste both below.
          </Body>
          <Text style={sharedStyles.inputLabel}>REPO (OWNER/NAME)</Text>
          <TextInput style={sharedStyles.input} value={repoInput} onChangeText={setRepoInput}
            autoCapitalize="none" autoCorrect={false} placeholder="KavyanLavti/habitforge-backup" placeholderTextColor={Colors.textMuted} />
          <Text style={sharedStyles.inputLabel}>TOKEN {hasToken ? '· SAVED ✓' : ''}</Text>
          <TextInput style={sharedStyles.input} value={tokenInput} onChangeText={setTokenInput} secureTextEntry
            autoCapitalize="none" autoCorrect={false} placeholder={hasToken ? 'Paste a new token to replace' : 'github_pat_…'}
            placeholderTextColor={Colors.textMuted} />
          <SystemButton label="SAVE BACKUP SETTINGS" variant="outline" onPress={saveBackupConfig} style={{ marginTop: Space.md }} />

          {settings.backupRepo !== '' && hasToken && (
            <>
              <SwitchRow label={`Back up nightly (after ${BACKUP_HOUR}:00 AM)`} value={settings.backupEnabled} onChange={(v) => up('backupEnabled', v)} />
              <Body muted style={styles.small}>Last backup: {lastBackup}</Body>
              {status?.lastError ? <Body style={[styles.small, { color: Colors.danger }]}>Last error: {status.lastError}</Body> : null}
              <View style={styles.btnRow}>
                <SystemButton label="BACK UP NOW" small loading={busy === 'backup'} onPress={runBackup} style={{ flex: 1 }} />
                <SystemButton label="RESTORE" small variant="outline" tone="ember" loading={busy === 'restore'} onPress={restoreGithub} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </SystemPanel>

        <SystemPanel title="MANUAL BACKUP">
          <View style={styles.btnRow}>
            <SystemButton label="EXPORT JSON" small variant="outline" onPress={exportJson} style={{ flex: 1 }} />
            <SystemButton label="IMPORT JSON" small variant="outline" onPress={() => setImportOpen(true)} style={{ flex: 1 }} />
          </View>
        </SystemPanel>

        <SystemPanel title="POINT TUNING">
          <NumberRow label="3-day streak multiplier" k="streakMult3" value={settings.streakMult3} onChange={up} />
          <NumberRow label="7-day streak multiplier" k="streakMult7" value={settings.streakMult7} onChange={up} />
          <NumberRow label="30-day streak multiplier" k="streakMult30" value={settings.streakMult30} onChange={up} />
          <NumberRow label="Points per level" k="pointsPerLevel" value={settings.pointsPerLevel} onChange={up} />
          <NumberRow label="Perfect day bonus" k="perfectDayBonus" value={settings.perfectDayBonus} onChange={up} />
          <NumberRow label="3 perfect days bonus" k="onFireBonus" value={settings.onFireBonus} onChange={up} />
          <NumberRow label="7 perfect days bonus" k="unstoppableBonus" value={settings.unstoppableBonus} onChange={up} />
        </SystemPanel>

        <SystemButton label="RESET SETTINGS TO DEFAULT" tone="danger" variant="outline" onPress={() =>
          Alert.alert('Reset settings?', 'Point tuning and alert settings go back to defaults. Quests, points and backup setup are kept.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: resetAll },
          ])} />
      </ScrollView>

      <Modal visible={importOpen} transparent animationType="slide" onRequestClose={() => setImportOpen(false)}>
        <View style={styles.overlay}>
          <SystemPanel title="IMPORT BACKUP" glowing>
            <Body muted style={styles.small}>Paste the full JSON from an export. This replaces ALL current data.</Body>
            <TextInput style={[sharedStyles.input, { height: 180, textAlignVertical: 'top', marginTop: Space.sm }]}
              value={importText} onChangeText={setImportText} multiline autoCapitalize="none" autoCorrect={false} />
            <View style={styles.btnRow}>
              <SystemButton label="CANCEL" variant="ghost" onPress={() => setImportOpen(false)} style={{ flex: 1 }} />
              <SystemButton label="RESTORE" tone="ember" disabled={!importText.trim()} onPress={importJson} style={{ flex: 1 }} />
            </View>
          </SystemPanel>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Space.md,
  },
  label: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
  num: { width: 80, textAlign: 'center', paddingVertical: 6 },
  small: { fontSize: 12, marginTop: Space.sm },
  btnRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  warn: { marginBottom: Space.md },
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.9)', justifyContent: 'center', padding: Space.lg },
});
