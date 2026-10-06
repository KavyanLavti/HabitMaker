import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Switch, Alert, Image, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { SystemPanel, SystemButton, ScreenHeader, SectionLabel, Body, sharedStyles } from '@/components/ui/System';
import { useRewardStore, Reward } from '@/store/rewardStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';

type NewReward = Omit<Reward, 'id' | 'claimed' | 'claimedAt'>;

function AddRewardModal({ visible, onSave, onClose }: { visible: boolean; onSave: (r: NewReward) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [level, setLevel] = useState('');
  const [isSuperPrize, setSuper] = useState(false);
  const [isRegular, setRegular] = useState(false);
  const [iconUri, setIcon] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(''); setCost(''); setLevel(''); setSuper(false); setRegular(false); setIcon(null); setError(null);
  }, [visible]);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!r.canceled && r.assets[0]) setIcon(r.assets[0].uri);
  };

  const save = () => {
    if (!name.trim()) return setError('Name the reward.');
    if (!(Number(cost) > 0)) return setError('Set a point cost.');
    onSave({
      name: name.trim(),
      pointCost: Number(cost),
      isSuperPrize,
      isRegular,
      requiredCharacterLevel: level ? Number(level) : null,
      iconUri,
    });
    onClose();
  };

  const toggleRow = (label: string, hint: string, value: boolean, set: (v: boolean) => void) => (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={[sharedStyles.inputLabel, { marginTop: 0 }]}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={set} trackColor={{ true: Colors.gold, false: Colors.border }} thumbColor={Colors.textPrimary} />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="height" style={styles.overlay}>
        <SystemPanel title="NEW REWARD" tone="gold" glowing style={{ maxHeight: '94%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.iconPick} onPress={pick}>
              {iconUri ? <Image source={{ uri: iconUri }} style={styles.iconImg} /> : <Ionicons name="image-outline" size={26} color={Colors.textMuted} />}
            </TouchableOpacity>
            <Text style={sharedStyles.inputLabel}>NAME</Text>
            <TextInput style={sharedStyles.input} value={name} onChangeText={setName} placeholder="e.g. Movie night" placeholderTextColor={Colors.textMuted} />
            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={sharedStyles.inputLabel}>POINT COST</Text>
                <TextInput style={sharedStyles.input} value={cost} onChangeText={setCost} keyboardType="numeric" placeholder="100" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sharedStyles.inputLabel}>MIN LEVEL</Text>
                <TextInput style={sharedStyles.input} value={level} onChangeText={setLevel} keyboardType="numeric" placeholder="none" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>
            {toggleRow('SUPER PRIZE', 'Big goal, shown at the top.', isSuperPrize, setSuper)}
            {toggleRow('REPEATABLE', 'Stays in the shop after you claim it.', isRegular, setRegular)}
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.lg }}>
              <SystemButton label="CANCEL" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <SystemButton label="SAVE" tone="gold" onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </SystemPanel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RewardCard({ reward, points, level, onClaim, onDelete }: {
  reward: Reward; points: number; level: number; onClaim: () => void; onDelete: () => void;
}) {
  const levelOk = !reward.requiredCharacterLevel || level >= reward.requiredCharacterLevel;
  const can = points >= reward.pointCost && levelOk;
  const tone = reward.isSuperPrize ? 'gold' : 'shadow';
  return (
    <SystemPanel tone={tone} glowing={can && reward.isSuperPrize} style={styles.card}>
      <View style={styles.cardRow}>
        {reward.iconUri ? (
          <Image source={{ uri: reward.iconUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name={reward.isSuperPrize ? 'trophy' : 'gift'} size={22} color={reward.isSuperPrize ? Colors.gold : Colors.shadow} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.rewardName}>{reward.name}</Text>
          <Text style={styles.rewardMeta}>
            {reward.pointCost} PTS
            {reward.requiredCharacterLevel ? ` · LV ${reward.requiredCharacterLevel}+` : ''}
            {reward.isRegular ? ' · REPEATABLE' : ''}
          </Text>
          {!levelOk && <Text style={[styles.rewardMeta, { color: Colors.danger }]}>LEVEL TOO LOW</Text>}
        </View>
        <SystemButton label="CLAIM" small tone={tone} disabled={!can} onPress={onClaim} />
        <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </SystemPanel>
  );
}

export default function ShopTab() {
  const { rewards, addReward, claimReward, deleteReward } = useRewardStore();
  const { spendablePoints, lifetimePoints, addEntry } = usePointStore();
  const { settings } = useSettingsStore();
  const [adding, setAdding] = useState(false);
  const level = Math.floor(lifetimePoints / settings.pointsPerLevel) + 1;

  const open = rewards.filter((r) => !r.claimed);
  const supers = open.filter((r) => r.isSuperPrize);
  const regular = open.filter((r) => !r.isSuperPrize);

  const claim = (r: Reward) => {
    Alert.alert('Claim reward?', `Spend ${r.pointCost} points on "${r.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim', onPress: async () => {
          await claimReward(r.id);
          await addEntry({ habitId: null, type: 'reward_claim', amount: -r.pointCost, reason: `Claimed: ${r.name}` });
        },
      },
    ]);
  };

  const remove = (r: Reward) =>
    Alert.alert('Remove reward?', `Remove "${r.name}" from the shop?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteReward(r.id) },
    ]);

  const card = (r: Reward) => (
    <RewardCard key={r.id} reward={r} points={spendablePoints} level={level} onClaim={() => claim(r)} onDelete={() => remove(r)} />
  );

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader
        kicker="SPEND YOUR POINTS"
        title="SHOP"
        right={<Text style={styles.points}>{Math.round(spendablePoints)} <Text style={styles.pointsUnit}>PTS</Text></Text>}
      />
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: 0, paddingBottom: 120 }}>
        {supers.length > 0 && <SectionLabel>SUPER PRIZES</SectionLabel>}
        {supers.map(card)}
        {regular.length > 0 && <SectionLabel>REWARDS</SectionLabel>}
        {regular.map(card)}
        {open.length === 0 && <Body muted style={{ textAlign: 'center', marginTop: Space.xl }}>No rewards yet. Tap + to add one.</Body>}
        <Body muted style={{ fontSize: 12, marginTop: Space.lg }}>
          Screen time for leisure apps is bought in the GATE tab.
        </Body>
      </ScrollView>
      <TouchableOpacity style={[styles.fab, glow(Colors.gold, 'strong')]} onPress={() => setAdding(true)}>
        <View style={{ transform: [{ rotate: '-45deg' }] }}>
          <Ionicons name="add" size={30} color={Colors.background} />
        </View>
      </TouchableOpacity>
      <AddRewardModal visible={adding} onSave={addReward} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.88)', justifyContent: 'flex-end', padding: Space.sm },
  points: { fontFamily: Fonts.display, fontSize: 24, color: Colors.gold },
  pointsUnit: { fontSize: 11, color: Colors.textMuted },
  card: { padding: Space.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  thumb: { width: 44, height: 44, borderRadius: 3 },
  thumbEmpty: { backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  rewardName: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.textPrimary },
  rewardMeta: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1, color: Colors.textMuted, marginTop: 3 },
  iconPick: {
    alignSelf: 'center', width: 72, height: 72, borderRadius: 4, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
  iconImg: { width: 72, height: 72, borderRadius: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', marginTop: Space.md },
  hint: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  error: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.danger, marginTop: Space.md },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 4,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }],
  },
});
