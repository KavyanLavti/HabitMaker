import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, ScreenHeader, SectionLabel, Bar, Body, sharedStyles } from '@/components/ui/System';
import { RulesModal } from '@/components/gate/RulesModal';
import { useGateStore } from '@/store/gateStore';
import { usePointStore } from '@/store/pointStore';
import { BANK_CAP_MINUTES, PACK_MINUTES, GateRules } from '@/lib/gate';
import { SystemGuard, isSystemGuardAvailable, GateDebug } from '@/modules/system-guard';
import { useTestMode } from '@/lib/testMode';

function ago(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}S AGO`;
  if (s < 3600) return `${Math.round(s / 60)}M AGO`;
  return `${Math.round(s / 3600)}H AGO`;
}

function SetupStep({ done, title, hint, action, onPress, secondary }: {
  done: boolean; title: string; hint: string; action: string; onPress: () => void;
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.step}>
      <Text style={[styles.stepTitle, { color: done ? Colors.success : Colors.textPrimary }]}>
        {done ? '✓ ' : '✗ '}{title}
      </Text>
      {!done && (
        <>
          <Body muted style={{ fontSize: 12, marginTop: 2 }}>{hint}</Body>
          <View style={styles.row}>
            {secondary && (
              <SystemButton label={secondary.label} small variant="outline" tone="danger" onPress={secondary.onPress} style={{ flex: 1 }} />
            )}
            <SystemButton label={action} small tone="danger" onPress={onPress} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </View>
  );
}

function fmt(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GateTab() {
  const { rules, pending, pendingFrom, bank, todayGrants, usage, refreshUsage, saveRules, buyPack } = useGateStore();
  const points = usePointStore((s) => s.spendablePoints);
  const [serviceOn, setServiceOn] = useState(SystemGuard.isGateServiceEnabled());
  const [usageOn, setUsageOn] = useState(SystemGuard.hasUsageAccess());
  const [diag, setDiag] = useState<GateDebug | null>(SystemGuard.getGateDebug());
  const [showDiag, setShowDiag] = useState(false);
  const testMode = useTestMode((s) => s.enabled);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Live usage while this tab is open
  useFocusEffect(
    useCallback(() => {
      const poll = () => {
        refreshUsage();
        setServiceOn(SystemGuard.isGateServiceEnabled());
        setUsageOn(SystemGuard.hasUsageAccess());
        setDiag(SystemGuard.getGateDebug());
      };
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

  const needsSetup = rules.enabled && rules.apps.length > 0 && (!serviceOn || !usageOn);
  const labelFor = (pkg: string) => rules.apps.find((a) => a.pkg === pkg)?.label ?? pkg;

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader kicker="EARNED SCREEN TIME" title="GATE" />
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: 0, paddingBottom: 40 }}>
        {!isSystemGuardAvailable && (
          <SystemPanel tone="danger" title="UNAVAILABLE">
            <Body>The gate needs the HabitForge Android build. It can't run inside Expo Go.</Body>
          </SystemPanel>
        )}

        {testMode && (
          <SystemPanel tone="ember" title="TEST MODE IS ON">
            <Body>
              The real gate is frozen while testing: rule changes and purchases here only affect the test copy. Exit test
              mode in Settings to set up and use the real gate.
            </Body>
          </SystemPanel>
        )}

        {isSystemGuardAvailable && !testMode && (needsSetup || showDiag) && (
          <SystemPanel tone={needsSetup ? 'danger' : 'system'} title={needsSetup ? 'GATE SETUP' : 'GATE STATUS'} glowing={needsSetup}>
            <SetupStep
              done={usageOn}
              title="1 · Usage access"
              hint="Lets the gate read how long you spend in each app (the same data as Digital Wellbeing)."
              action="OPEN USAGE ACCESS"
              onPress={SystemGuard.openUsageAccessSettings}
            />
            <SetupStep
              done={serviceOn}
              title="2 · HabitForge Gate (Accessibility)"
              hint={'Lets the gate close an app when its time runs out. Greyed out? App info → ⋮ → "Allow restricted settings" first.'}
              action="ACCESSIBILITY"
              onPress={SystemGuard.openAccessibilitySettings}
              secondary={{ label: 'APP INFO', onPress: SystemGuard.openAppDetails }}
            />
            {diag && (
              <Text style={styles.diag}>
                {diag.connectedAt ? 'SERVICE ALIVE' : 'SERVICE NEVER STARTED'}
                {diag.lastAt ? ` · LAST APP SEEN: ${labelFor(diag.lastPkg)} ${ago(diag.lastAt)}` : ''}
                {`
GATE KNOWS ${diag.configApps.length} APP(S)${diag.configEnabled ? '' : ' · GATE OFF'}`}
              </Text>
            )}
            <TouchableOpacity onPress={() => setShowDiag((v) => !v)}>
              <Text style={styles.diagToggle}>{showDiag ? 'HIDE STATUS' : ''}</Text>
            </TouchableOpacity>
          </SystemPanel>
        )}
        {isSystemGuardAvailable && !testMode && !needsSetup && !showDiag && (
          <TouchableOpacity onPress={() => setShowDiag(true)}>
            <Text style={styles.diagToggle}>✓ GATE ACTIVE · SHOW STATUS</Text>
          </TouchableOpacity>
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
  step: { marginBottom: Space.md },
  stepTitle: { fontFamily: Fonts.display, fontSize: 13, letterSpacing: 1 },
  diag: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.textMuted, lineHeight: 16 },
  diagToggle: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.5, color: Colors.success, marginBottom: Space.sm },
  appMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: Space.sm },
});
