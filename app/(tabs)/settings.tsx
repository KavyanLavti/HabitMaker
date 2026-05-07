import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TextInput, Switch, Alert, TouchableOpacity, Share, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { useSettingsStore, Settings } from '@/store/settingsStore';
import { usePointStore } from '@/store/pointStore';
import { useHabitStore } from '@/store/habitStore';
import { AuraRing } from '@/components/aura/AuraRing';
import { buildBackupJson, restoreFromBackup } from '@/lib/dataExport';

function NumberSetting({ label, settingKey, value, onUpdate, min, max, step = 0.05 }: {
  label: string;
  settingKey: keyof Settings;
  value: number;
  onUpdate: (k: keyof Settings, v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <TextInput
        style={styles.settingInput}
        value={String(value)}
        onChangeText={(t) => {
          const n = parseFloat(t);
          if (!isNaN(n)) onUpdate(settingKey, n);
        }}
        keyboardType="decimal-pad"
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

function BoolSetting({ label, settingKey, value, onUpdate }: {
  label: string; settingKey: keyof Settings; value: boolean;
  onUpdate: (k: keyof Settings, v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => onUpdate(settingKey, v)}
        trackColor={{ true: Colors.accent, false: Colors.border }}
        thumbColor={Colors.textPrimary}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ visible, onClose, onImport }: {
  visible: boolean;
  onClose: () => void;
  onImport: (json: string) => void;
}) {
  const [text, setText] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.importOverlay}>
        <View style={styles.importSheet}>
          <Text style={styles.importTitle}>IMPORT BACKUP</Text>
          <Text style={styles.importHint}>
            Paste the full JSON backup text below. This will replace ALL current data.
          </Text>
          <TextInput
            style={styles.importInput}
            value={text}
            onChangeText={setText}
            multiline
            placeholder={'{"version":2,"exportedAt":"...","habits":[...],...}'}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.importBtnRow}>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: Colors.accentRed }]}
              onPress={() => { setText(''); onClose(); }}
            >
              <Text style={styles.importBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: Colors.accent, opacity: text.trim() ? 1 : 0.4 }]}
              disabled={!text.trim()}
              onPress={() => { onImport(text.trim()); setText(''); }}
            >
              <Text style={styles.importBtnText}>RESTORE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────
export default function SettingsTab() {
  const { settings, updateSetting, resetAll } = useSettingsStore();
  const { getLevel, loadPoints } = usePointStore();
  const { loadAll } = useHabitStore();
  const level = getLevel(settings.pointsPerLevel);
  const [importVisible, setImportVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const up = <K extends keyof Settings>(k: K, v: Settings[K]) => updateSetting(k, v);

  const handleReset = () => {
    Alert.alert(
      'Reset All Data?',
      'This will delete all habits, points, and progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive', onPress: () => {
            resetAll();
            Alert.alert('Done', 'All settings reset to defaults.');
          }
        },
      ]
    );
  };

  const handleExport = async () => {
    try {
      setBusy(true);
      // Include the raw AsyncStorage settings blob so it round-trips cleanly
      const settingsRaw = await AsyncStorage.getItem('settings-store');
      const json = await buildBackupJson(settingsRaw ? JSON.parse(settingsRaw) : undefined);
      await Share.share({
        message: json,
        title: 'HabitForge Backup',
      });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (json: string) => {
    Alert.alert(
      'Restore Backup?',
      'This will REPLACE all current habits, points, and rewards with the backup data. Continue?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setImportVisible(false) },
        {
          text: 'Yes, Restore',
          style: 'destructive',
          onPress: async () => {
            setImportVisible(false);
            setBusy(true);
            try {
              const backup = JSON.parse(json);
              await restoreFromBackup(json);

              // Restore settings if present in backup
              if (backup.settings) {
                await AsyncStorage.setItem('settings-store', JSON.stringify(backup.settings));
              }

              // Reload all stores from the freshly restored DB
              await Promise.all([loadAll(), loadPoints()]);
              Alert.alert('Done', 'Backup restored successfully. Restart the app if data looks stale.');
            } catch (e: any) {
              Alert.alert('Import failed', e?.message ?? 'Invalid backup file.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.pageTitle}>SETTINGS</Text>

        {/* Profile */}
        <Section title="Profile">
          <View style={styles.profileAura}>
            <AuraRing level={level} displayName={settings.displayName} size={80} />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Display Name</Text>
            <TextInput
              style={[styles.settingInput, { width: 140 }]}
              value={settings.displayName}
              onChangeText={(t) => up('displayName', t)}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </Section>

        <Section title="Streak Multipliers">
          <NumberSetting label="3-day streak" settingKey="streakMult3" value={settings.streakMult3} onUpdate={up} />
          <NumberSetting label="7-day streak" settingKey="streakMult7" value={settings.streakMult7} onUpdate={up} />
          <NumberSetting label="30-day streak" settingKey="streakMult30" value={settings.streakMult30} onUpdate={up} />
          <NumberSetting label="Completion bonus %" settingKey="completionBonusPct" value={settings.completionBonusPct} onUpdate={up} step={1} />
          <NumberSetting label="Points per level" settingKey="pointsPerLevel" value={settings.pointsPerLevel} onUpdate={up} step={50} />
        </Section>

        <Section title="Combo Bonuses">
          <NumberSetting label="Perfect Day bonus" settingKey="perfectDayBonus" value={settings.perfectDayBonus} onUpdate={up} step={5} />
          <NumberSetting label="On Fire bonus (3-day)" settingKey="onFireBonus" value={settings.onFireBonus} onUpdate={up} step={10} />
          <NumberSetting label="Unstoppable bonus (7-day)" settingKey="unstoppableBonus" value={settings.unstoppableBonus} onUpdate={up} step={25} />
        </Section>

        <Section title="Penalties">
          <NumberSetting label="Urgency 4 miss threshold/wk" settingKey="penaltyThreshold4" value={settings.penaltyThreshold4} onUpdate={up} step={1} />
          <NumberSetting label="Urgency 3 miss threshold/wk" settingKey="penaltyThreshold3" value={settings.penaltyThreshold3} onUpdate={up} step={1} />
          <NumberSetting label="Urgency 1-2 miss threshold/wk" settingKey="penaltyThreshold12" value={settings.penaltyThreshold12} onUpdate={up} step={1} />
          <NumberSetting label="Penalty %" settingKey="penaltyPct" value={settings.penaltyPct} onUpdate={up} step={1} />
          <NumberSetting label="Decay %" settingKey="decayPct" value={settings.decayPct} onUpdate={up} step={1} />
          <NumberSetting label="Decay trigger (days)" settingKey="decayTriggerDays" value={settings.decayTriggerDays} onUpdate={up} step={1} />
        </Section>

        <Section title="Notifications">
          <BoolSetting label="Enable notifications" settingKey="notificationsEnabled" value={settings.notificationsEnabled} onUpdate={up} />
          <NumberSetting label="Minutes before reminder" settingKey="notifyMinutesBefore" value={settings.notifyMinutesBefore} onUpdate={up} step={5} />
        </Section>

        {/* Data Backup — persists across updates, exportable for AI context */}
        <Section title="Data Backup">
          <Text style={styles.backupHint}>
            Export saves all habits, completions, points, and rewards as JSON.
            Import it back after reinstalling or share it to preserve AI context.
          </Text>
          <TouchableOpacity
            onPress={handleExport}
            disabled={busy}
            style={[styles.backupBtn, { backgroundColor: Colors.accentBlue, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={styles.backupBtnText}>{busy ? 'WORKING...' : 'EXPORT DATA (SHARE JSON)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setImportVisible(true)}
            disabled={busy}
            style={[styles.backupBtn, { backgroundColor: Colors.surfaceHigh, marginTop: 8, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={[styles.backupBtnText, { color: Colors.textPrimary }]}>IMPORT / RESTORE BACKUP</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Danger Zone">
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>RESET ALL SETTINGS</Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>

      <ImportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImport={handleImport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  pageTitle: { fontFamily: 'BebasNeue', fontSize: 28, color: Colors.textPrimary, letterSpacing: 1, marginBottom: 4 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontFamily: 'BebasNeue',
    fontSize: 16,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLabel: { fontFamily: 'DMSans', fontSize: 13, color: Colors.textPrimary, flex: 1 },
  settingInput: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: Colors.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 13,
    width: 80,
    textAlign: 'center',
  },
  profileAura: { alignItems: 'center', marginVertical: 20 },
  resetBtn: {
    backgroundColor: Colors.accentRed,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetBtnText: { fontFamily: 'DMSansBold', fontSize: 14, color: Colors.textPrimary, letterSpacing: 1 },
  backupHint: {
    fontFamily: 'DMSans',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  backupBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backupBtnText: {
    fontFamily: 'DMSansBold',
    fontSize: 13,
    color: Colors.background,
    letterSpacing: 0.5,
  },

  // Import modal
  importOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  importSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  importTitle: {
    fontFamily: 'BebasNeue',
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  importHint: {
    fontFamily: 'DMSans',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  importInput: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 12,
    height: 180,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  importBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  importBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importBtnText: {
    fontFamily: 'DMSansBold',
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
});
