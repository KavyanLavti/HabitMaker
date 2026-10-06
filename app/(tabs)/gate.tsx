import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, ScreenHeader, SectionLabel, Bar, Body, sharedStyles } from '@/components/ui/System';
import { RulesModal } from '@/components/gate/RulesModal';
import { useGateStore } from '@/store/gateStore';
import { usePointStore } from '@/store/pointStore';
import { BANK_CAP_MINUTES, PACK_MINUTES, GateRules } from '@/lib/gate';
import { SystemGuard, isSystemGuardAvailable } from '@/modules/system-guard';

function fmt(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GateTab() {
  const { rules, pending, pendingFrom, bank, todayGrants, usage, refreshUsage, saveRules, buyPack } = useGateStore();
  const points = usePointStore((s) => s.spendablePoints);
  const [serviceOn, setServiceOn] = useState(SystemGuard.isGateServiceEnabled());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Live usage while this tab is open
  useFocusEffect(
    useCallback(() => {
      const poll = () => { refreshUsage(); setServiceOn(SystemGuard.isGateServiceEnabled()); };
      poll();
      const id = setInterval(poll, 5000);
      return () => clearInterval(id);
    }, [])
  );

  const buy = async (pkg: string, source: 'points' | 'bank') => {
    setBusy(pkg + source);
    const err = await buyPack(pkg, source);
    setBusy(null);
    if (err) Alert.alert('Not enough', err);
  };

  const onSaveRules = async (next: GateRules) => {
    setEditing(false);
    const when = await saveRules(next);
    if (when === 'tomorrow') {
      Alert.alert('[SYSTEM]', 'Stricter parts of this change apply now. The looser parts take effect tomorrow.');
    }
  };

  const offline = rules.enabled && rules.apps.length > 0 && !serviceOn;

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader kicker="EARNED SCREEN TIME" title="GATE" />
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: 0, paddingBottom: 40 }}>
        {!isSystemGuardAvailable && (
          <SystemPanel tone="danger" title="UNAVAILABLE">
            <Body>The gate needs the HabitForge Android build. It can't run inside Expo Go.</Body>
          </SystemPanel>
        )}

        {isSystemGuardAvailable && offline && (
          <SystemPanel tone="danger" title="GATE OFFLINE" glowing>
            <Body>
              The gate isn't watching your apps. Turn on <Text style={{ color: Colors.system }}>HabitForge Gate</Text> in
              Accessibility settings.
            </Body>
            <Body muted style={{ fontSize: 12, marginTop: Space.sm }}>
              Switch greyed out? Open App info, tap ⋮ (top right), choose "Allow restricted settings", then try again.
            </Body>
            <View style={styles.row}>
              <SystemButton label="APP INFO" variant="outline" tone="danger" small onPress={SystemGuard.openAppDetails} style={{ flex: 1 }} />
              <SystemButton label="ACCESSIBILITY" tone="danger" small onPress={SystemGuard.openAccessibilitySettings} style={{ flex: 1 }} />
            </View>
          </SystemPanel>
        )}

        <View style={styles.row}>
          <SystemPanel tone="gold" style={styles.half}>
            <Text style={styles.statLabel}>POINTS</Text>
            <Text style={[styles.statVal, { color: Colors.gold }]}>{Math.round(points)}</Text>
          </SystemPanel>
          <SystemPanel tone="shadow" style={styles.half}>
            <Text style={styles.statLabel}>BANK</Text>
            <Text style={[styles.statVal, { color: Colors.shadow }]}>
              {bank}<Text style={styles.statUnit}> / {BANK_CAP_MINUTES} MIN</Text>
            </Text>
          </SystemPanel>
        </View>

        <SectionLabel>LEISURE APPS</SectionLabel>
        {rules.apps.length === 0 && (
          <Body muted>No apps are gated yet. Tap EDIT RULES to pick your leisure apps.</Body>
        )}
        {rules.apps.map((app) => {
          const granted = todayGrants[app.pkg] ?? 0;
          const limitMs = (rules.baseMinutes + granted) * 60000;
          const used = usage[app.pkg] ?? 0;
          const left = Math.max(0, limitMs - used);
          const locked = rules.enabled && left <= 0;
          return (
            <SystemPanel key={app.pkg} tone={locked ? 'danger' : 'system'} glowing={locked}>
              <View style={styles.appHead}>
                <Text style={styles.appName}>{app.label}</Text>
                <Text style={[styles.appLeft, { color: locked ? Colors.danger : Colors.system }]}>
                  {locked ? 'LOCKED' : `${fmt(left)} LEFT`}
                </Text>
              </View>
              <Bar progress={limitMs ? used / limitMs : 1} color={locked ? Colors.danger : Colors.system} />
              <Text style={styles.appMeta}>
                {fmt(used)} used · {rules.baseMinutes} free{granted ? ` + ${granted} earned` : ''} min
              </Text>
              <View style={styles.row}>
                <SystemButton
                  label={`+${PACK_MINUTES} MIN · ${rules.pointsPerPack} PTS`}
                  small
                  tone="gold"
                  disabled={points < rules.pointsPerPack}
                  loading={busy === app.pkg + 'points'}
                  onPress={() => buy(app.pkg, 'points')}
                  style={{ flex: 1.4 }}
                />
                <SystemButton
                  label="FROM BANK"
                  small
                  tone="shadow"
                  variant="outline"
                  disabled={bank <= 0}
                  loading={busy === app.pkg + 'bank'}
                  onPress={() => buy(app.pkg, 'bank')}
                  style={{ flex: 1 }}
                />
              </View>
            </SystemPanel>
          );
        })}

        <SectionLabel>RULES</SectionLabel>
        <SystemPanel>
          <Body>
            {rules.enabled ? 'Gate is ACTIVE.' : 'Gate is OFF.'} {rules.baseMinutes} free minutes per app per day.
            Each extra {PACK_MINUTES} minutes costs {rules.pointsPerPack} points.
          </Body>
          <Body muted style={{ fontSize: 12, marginTop: Space.sm }}>
            At midnight, earned minutes you didn't use go to the bank (max {BANK_CAP_MINUTES} min). Anything over that
            expires. Free minutes never carry over.
          </Body>
          {pending && (
            <Body style={{ color: Colors.ember, fontSize: 12, marginTop: Space.sm }}>
              Pending from {pendingFrom}: {pending.enabled ? '' : 'gate OFF, '}{pending.baseMinutes} free min,{' '}
              {pending.pointsPerPack} pts/pack, {pending.apps.length} apps.
            </Body>
          )}
          <SystemButton label="EDIT RULES" variant="outline" onPress={() => setEditing(true)} style={{ marginTop: Space.md }} />
        </SystemPanel>
      </ScrollView>

      <RulesModal visible={editing} rules={pending ?? rules} onSave={onSaveRules} onClose={() => setEditing(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  half: { flex: 1, marginBottom: 0 },
  statLabel: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 2, color: Colors.textMuted },
  statVal: { fontFamily: Fonts.display, fontSize: 30, marginTop: 2 },
  statUnit: { fontSize: 12, color: Colors.textMuted },
  appHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Space.sm },
  appName: { fontFamily: Fonts.bodyBold, fontSize: 17, color: Colors.textPrimary },
  appLeft: { fontFamily: Fonts.display, fontSize: 14, letterSpacing: 1 },
  appMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: Space.sm },
});
