import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body, sharedStyles } from '@/components/ui/System';
import { GateRules, GateApp } from '@/lib/gate';
import { SystemGuard, LaunchableApp } from '@/modules/system-guard';

// Shown first in the picker since they're the usual suspects
const SUGGESTED = ['com.google.android.youtube', 'com.instagram.android'];

interface Props {
  visible: boolean;
  rules: GateRules;
  onSave: (r: GateRules) => void;
  onClose: () => void;
}

export function RulesModal({ visible, rules, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(rules.enabled);
  const [base, setBase] = useState(String(rules.baseMinutes));
  const [cost, setCost] = useState(String(rules.pointsPerPack));
  const [apps, setApps] = useState<GateApp[]>(rules.apps);
  const [installed, setInstalled] = useState<LaunchableApp[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setEnabled(rules.enabled);
    setBase(String(rules.baseMinutes));
    setCost(String(rules.pointsPerPack));
    setApps(rules.apps);
    setQuery('');
    setInstalled(SystemGuard.getLaunchableApps());
  }, [visible]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selected = new Set(apps.map((a) => a.pkg));
    return installed
      .filter((a) => !q || a.label.toLowerCase().includes(q) || a.packageName.includes(q))
      .sort((a, b) => {
        const rank = (x: LaunchableApp) => (selected.has(x.packageName) ? 0 : SUGGESTED.includes(x.packageName) ? 1 : 2);
        return rank(a) - rank(b) || a.label.localeCompare(b.label);
      });
  }, [installed, query, apps]);

  const toggle = (a: LaunchableApp) =>
    setApps((cur) =>
      cur.some((x) => x.pkg === a.packageName)
        ? cur.filter((x) => x.pkg !== a.packageName)
        : [...cur, { pkg: a.packageName, label: a.label }]
    );

  const save = () => {
    const baseN = Math.round(Number(base));
    const costN = Math.round(Number(cost));
    if (!(baseN >= 0 && baseN <= 240)) return Alert.alert('Free minutes', 'Use a number from 0 to 240.');
    if (!(costN >= 1)) return Alert.alert('Pack price', 'A 5-minute pack must cost at least 1 point.');
    onSave({ enabled, baseMinutes: baseN, pointsPerPack: costN, apps });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SystemPanel title="GATE RULES" glowing style={styles.sheet}>
          <Body muted style={styles.note}>
            Stricter changes apply now. Looser ones (removing an app, more free time, cheaper packs, turning the
            gate off) wait until tomorrow.
          </Body>

          <View style={[sharedStyles.row, { justifyContent: 'space-between' }]}>
            <Text style={[sharedStyles.inputLabel, { marginTop: 0 }]}>GATE ACTIVE</Text>
            <Switch value={enabled} onValueChange={setEnabled}
              trackColor={{ true: Colors.system, false: Colors.border }} thumbColor={Colors.textPrimary} />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={sharedStyles.inputLabel}>FREE MIN / APP / DAY</Text>
              <TextInput style={sharedStyles.input} value={base} onChangeText={setBase} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sharedStyles.inputLabel}>POINTS PER 5 MIN</Text>
              <TextInput style={sharedStyles.input} value={cost} onChangeText={setCost} keyboardType="numeric" />
            </View>
          </View>

          <Text style={sharedStyles.inputLabel}>LEISURE APPS ({apps.length})</Text>
          <TextInput
            style={sharedStyles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={Colors.textMuted}
          />
          <FlatList
            style={styles.list}
            data={list}
            keyExtractor={(a) => a.packageName}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Body muted style={{ padding: Space.md }}>No apps found. This needs the Android build.</Body>}
            renderItem={({ item }) => {
              const on = apps.some((a) => a.pkg === item.packageName);
              return (
                <TouchableOpacity style={styles.app} onPress={() => toggle(item)}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? Colors.system : Colors.textMuted} />
                  <Text style={styles.appLabel}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.row}>
            <SystemButton label="CANCEL" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <SystemButton label="SAVE" onPress={save} style={{ flex: 1 }} />
          </View>
        </SystemPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.9)', justifyContent: 'flex-end', padding: Space.sm },
  sheet: { maxHeight: '94%' },
  note: { fontSize: 12, marginBottom: Space.md },
  row: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm },
  list: { maxHeight: 260, marginVertical: Space.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: 3 },
  app: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.md, paddingVertical: 10 },
  appLabel: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
});
