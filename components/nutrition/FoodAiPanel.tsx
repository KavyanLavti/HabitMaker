import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Colors, Fonts, Space } from '@/constants/theme';
import { SystemPanel, SystemButton, Body, sharedStyles } from '@/components/ui/System';
import { useSettingsStore, Settings } from '@/store/settingsStore';
import { DEFAULT_MODELS, FoodAiProvider, getFoodAiKey, PROVIDER_INFO, setFoodAiKey } from '@/lib/foodAI';

const PROVIDERS: FoodAiProvider[] = ['gemini', 'claude'];

/** Settings: which AI reads food photos, its key and model, and daily nutrition targets. */
export function FoodAiPanel() {
  const { settings, updateSetting } = useSettingsStore();
  const provider = settings.foodAiProvider;
  const modelKey: keyof Settings = provider === 'claude' ? 'foodAiModelClaude' : 'foodAiModelGemini';
  const [saved, setSaved] = useState<Record<FoodAiProvider, boolean>>({ gemini: false, claude: false });
  const [keyInput, setKeyInput] = useState('');

  useEffect(() => {
    Promise.all(PROVIDERS.map(getFoodAiKey)).then(([g, c]) => setSaved({ gemini: !!g, claude: !!c }));
  }, []);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    await setFoodAiKey(provider, keyInput);
    setKeyInput('');
    setSaved((s) => ({ ...s, [provider]: true }));
    Alert.alert('[SYSTEM]', `${PROVIDER_INFO[provider].label} key saved on this phone only.`);
  };

  const removeKey = () =>
    Alert.alert('Remove key?', `The ${PROVIDER_INFO[provider].label} key is deleted from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await setFoodAiKey(provider, null); setSaved((s) => ({ ...s, [provider]: false })); } },
    ]);

  const target = (label: string, k: 'calorieTarget' | 'proteinTarget' | 'carbsTarget' | 'fatTarget', unit: string) => (
    <TargetInput key={k} label={label} unit={unit} value={settings[k]} onChange={(v) => updateSetting(k, v)} />
  );

  return (
    <SystemPanel title="FOOD AI · CALORIES" tone={saved[provider] ? 'success' : 'system'}>
      <Text style={sharedStyles.inputLabel}>READ FOOD PHOTOS WITH</Text>
      <View style={styles.seg}>
        {PROVIDERS.map((p) => (
          <TouchableOpacity key={p} style={[styles.segBtn, provider === p && styles.segOn]} onPress={() => updateSetting('foodAiProvider', p)}>
            <Text style={[styles.segText, provider === p && { color: Colors.background }]}>{PROVIDER_INFO[p].label}{saved[p] ? ' ✓' : ''}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Body muted style={styles.small}>{PROVIDER_INFO[provider].where}</Body>

      <Text style={sharedStyles.inputLabel}>API KEY {saved[provider] ? '· SAVED ✓' : ''}</Text>
      <TextInput style={sharedStyles.input} value={keyInput} onChangeText={setKeyInput} secureTextEntry autoCapitalize="none" autoCorrect={false}
        placeholder={saved[provider] ? 'Paste a new key to replace' : PROVIDER_INFO[provider].keyHint} placeholderTextColor={Colors.textMuted} />
      <View style={styles.btnRow}>
        <SystemButton label="SAVE KEY" small variant="outline" disabled={!keyInput.trim()} onPress={saveKey} style={{ flex: 2 }} />
        {saved[provider] && <SystemButton label="REMOVE" small variant="ghost" onPress={removeKey} style={{ flex: 1 }} />}
      </View>

      <Text style={sharedStyles.inputLabel}>MODEL (BLANK = {DEFAULT_MODELS[provider]})</Text>
      <TextInput style={sharedStyles.input} value={settings[modelKey] as string} onChangeText={(t) => updateSetting(modelKey, t.trim())}
        autoCapitalize="none" autoCorrect={false} placeholder={DEFAULT_MODELS[provider]} placeholderTextColor={Colors.textMuted} />

      <Text style={[sharedStyles.inputLabel, { marginTop: Space.md }]}>DAILY TARGETS</Text>
      {target('Calories', 'calorieTarget', 'kcal')}
      {target('Protein', 'proteinTarget', 'g')}
      {target('Carbs', 'carbsTarget', 'g')}
      {target('Fat', 'fatTarget', 'g')}
    </SystemPanel>
  );
}

function TargetInput({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label} ({unit})</Text>
      <TextInput style={[sharedStyles.input, styles.num]} value={text} onChangeText={setText} keyboardType="number-pad"
        onEndEditing={() => { const n = parseInt(text, 10); if (n > 0) onChange(n); else setText(String(value)); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, borderWidth: 1, borderColor: Colors.success, borderRadius: 3, paddingVertical: 9, alignItems: 'center' },
  segOn: { backgroundColor: Colors.success },
  segText: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 1.2, color: Colors.success },
  small: { fontSize: 12, marginTop: Space.sm },
  btnRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: Space.md },
  label: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
  num: { width: 80, textAlign: 'center', paddingVertical: 6 },
});
