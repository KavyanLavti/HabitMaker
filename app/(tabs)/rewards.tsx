import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, Modal, TextInput, ScrollView, Switch, Alert,
  Image, Dimensions, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { useRewardStore, Reward } from '@/store/rewardStore';
import { usePointStore } from '@/store/pointStore';
import { useSettingsStore } from '@/store/settingsStore';
import { AuraRing } from '@/components/aura/AuraRing';
import { PowerBar } from '@/components/aura/PowerBar';
import { ForgeButton } from '@/components/ui/ForgeButton';

const SCREEN_W = Dimensions.get('window').width;
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_LABELS = ['1ST', '2ND', '3RD'];

// ─── Add Reward Modal ──────────────────────────────────────────────────────────
function AddRewardModal({ visible, onSave, onClose }: {
  visible: boolean;
  onSave: (data: Omit<Reward, 'id' | 'claimed' | 'claimedAt'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [isSuperPrize, setIsSuperPrize] = useState(false);
  const [isRegular, setIsRegular] = useState(false);
  const [requiredLevel, setRequiredLevel] = useState('');
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const [costError, setCostError] = useState(false);

  // Reset all fields when the modal opens
  useEffect(() => {
    if (!visible) return;
    setName(''); setCost(''); setIsSuperPrize(false); setIsRegular(false);
    setRequiredLevel(''); setIconUri(null);
    setNameError(false); setCostError(false);
  }, [visible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setIconUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    const nameOk = !!name.trim();
    const costOk = !!cost && !isNaN(Number(cost));
    setNameError(!nameOk);
    setCostError(!costOk);
    if (!nameOk || !costOk) return;
    onSave({
      name: name.trim(),
      pointCost: Number(cost),
      isSuperPrize,
      isRegular,
      requiredCharacterLevel: requiredLevel ? Number(requiredLevel) : null,
      iconUri,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>ADD REWARD</Text>

          <TouchableOpacity style={styles.iconPicker} onPress={pickImage}>
            {iconUri ? (
              <Image source={{ uri: iconUri }} style={styles.iconPreview} />
            ) : (
              <Text style={styles.iconPickerText}>+ Add Icon{'\n'}(JPEG/PNG)</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={[styles.input, nameError && styles.inputError]}
            value={name}
            onChangeText={(t) => { setName(t); if (t.trim()) setNameError(false); }}
            placeholderTextColor={Colors.textMuted}
            placeholder="e.g. Netflix night"
          />
          {nameError && <Text style={styles.errorText}>Name is required</Text>}

          <Text style={styles.label}>Point Cost *</Text>
          <TextInput
            style={[styles.input, costError && styles.inputError]}
            value={cost}
            onChangeText={(t) => { setCost(t); if (t) setCostError(false); }}
            keyboardType="numeric"
            placeholderTextColor={Colors.textMuted}
            placeholder="100"
          />
          {costError && <Text style={styles.errorText}>Valid point cost is required</Text>}

          <Text style={styles.label}>Required Level (optional)</Text>
          <TextInput style={styles.input} value={requiredLevel} onChangeText={setRequiredLevel} keyboardType="numeric" placeholderTextColor={Colors.textMuted} placeholder="Leave blank for none" />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Super Prize (Top Ranking)</Text>
            <Switch value={isSuperPrize} onValueChange={setIsSuperPrize} trackColor={{ true: Colors.accent, false: Colors.border }} thumbColor={Colors.textPrimary} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Regular Award</Text>
              <Text style={styles.switchHint}>Stays after claiming — points deducted each time</Text>
            </View>
            <Switch value={isRegular} onValueChange={setIsRegular} trackColor={{ true: Colors.accentBlue, false: Colors.border }} thumbColor={Colors.textPrimary} />
          </View>

          <View style={styles.btnRow}>
            <ForgeButton label="SAVE" onPress={handleSave} style={{ flex: 1 }} />
            <ForgeButton label="CANCEL" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Eligibility Popup ─────────────────────────────────────────────────────────
function EligibilityPopup({ reward, onDismiss }: { reward: Reward; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDismiss);
  }, []);
  return (
    <Animated.View style={[styles.popup, { opacity }]}>
      <Text style={styles.popupText}>You can now claim "{reward.name}"!</Text>
    </Animated.View>
  );
}

// ─── Super Prize Podium ────────────────────────────────────────────────────────
function SuperPrizePodium({ prizes, spendable, level, onClaim, onDelete }: {
  prizes: Reward[];
  spendable: number;
  level: number;
  onClaim: (r: Reward) => void;
  onDelete: (r: Reward) => void;
}) {
  // Podium order: 2nd left, 1st center (tallest), 3rd right
  const slots: (Reward | undefined)[] = [prizes[1], prizes[0], prizes[2]];
  const rankOf = (slot: Reward | undefined) => slot ? prizes.indexOf(slot) : -1;
  const cardWidths = [(SCREEN_W - 48) * 0.30, (SCREEN_W - 48) * 0.38, (SCREEN_W - 48) * 0.30];

  return (
    <View style={styles.podiumRow}>
      {slots.map((prize, slotIdx) => {
        if (!prize) return <View key={slotIdx} style={{ width: cardWidths[slotIdx] }} />;
        const rank = rankOf(prize);
        const canAfford = spendable >= prize.pointCost;
        const levelOk = !prize.requiredCharacterLevel || level >= prize.requiredCharacterLevel;
        const canClaim = canAfford && levelOk;
        const color = RANK_COLORS[rank] ?? Colors.accent;

        return (
          <View key={prize.id} style={[
            styles.podiumCard,
            { borderColor: color, width: cardWidths[slotIdx] },
            slotIdx === 1 && styles.podiumCardFirst,
          ]}>
            <TouchableOpacity onPress={() => onDelete(prize)} style={styles.podiumDeleteBtn}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.podiumRank, { color }]}>{RANK_LABELS[rank]}</Text>
            {prize.iconUri ? (
              <Image source={{ uri: prize.iconUri }} style={styles.podiumIcon} />
            ) : (
              <View style={[styles.podiumIconPlaceholder, { borderColor: color }]}>
                <Text style={{ fontSize: slotIdx === 1 ? 28 : 20 }}>🏆</Text>
              </View>
            )}
            <Text style={styles.podiumName} numberOfLines={2}>{prize.name}</Text>
            <Text style={[styles.podiumCost, { color }]}>{prize.pointCost}pts</Text>
            {prize.requiredCharacterLevel ? (
              <Text style={styles.podiumReq}>LV {prize.requiredCharacterLevel}+</Text>
            ) : null}
            <TouchableOpacity
              onPress={() => onClaim(prize)}
              disabled={!canClaim}
              style={[styles.podiumClaimBtn, { backgroundColor: color, opacity: canClaim ? 1 : 0.35 }]}
            >
              <Text style={styles.podiumClaimText}>CLAIM</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ─── Small Reward Icon Card ────────────────────────────────────────────────────
function SmallRewardIcon({ reward, spendable, level, onClaim, onDelete }: {
  reward: Reward;
  spendable: number;
  level: number;
  onClaim: (r: Reward) => void;
  onDelete: (r: Reward) => void;
}) {
  const canAfford = spendable >= reward.pointCost;
  const levelOk = !reward.requiredCharacterLevel || level >= reward.requiredCharacterLevel;
  const canClaim = canAfford && levelOk;

  return (
    <View style={[styles.smallCard, !canClaim && { opacity: 0.55 }]}>
      <TouchableOpacity onPress={() => onDelete(reward)} style={styles.smallDeleteBtn}>
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
      {reward.iconUri ? (
        <Image source={{ uri: reward.iconUri }} style={styles.smallIcon} />
      ) : (
        <View style={styles.smallIconPlaceholder}>
          <Text style={{ fontSize: 22 }}>🎁</Text>
        </View>
      )}
      <Text style={styles.smallName} numberOfLines={2}>{reward.name}</Text>
      <Text style={styles.smallCost}>{reward.pointCost}pts</Text>
      {reward.isRegular && <Text style={styles.regularBadge}>∞ regular</Text>}
      <TouchableOpacity
        onPress={() => onClaim(reward)}
        disabled={!canClaim}
        style={[styles.smallClaimBtn, !canClaim && { opacity: 0.4 }]}
      >
        <Text style={styles.smallClaimText}>CLAIM</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────
export default function RewardsTab() {
  const { rewards, loaded, loadRewards, addReward, claimReward, deleteReward } = useRewardStore();
  const { spendablePoints, lifetimePoints, addEntry, getLevel, getLevelProgress } = usePointStore();
  const { settings } = useSettingsStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [eligiblePopup, setEligiblePopup] = useState<Reward | null>(null);
  const prevSpendable = useRef(spendablePoints);

  useEffect(() => { if (!loaded) loadRewards(); }, []);

  // Show eligibility popup when points cross a reward threshold
  useEffect(() => {
    if (spendablePoints > prevSpendable.current) {
      const newlyEligible = rewards.find(
        (r) => !r.claimed && r.pointCost <= spendablePoints && r.pointCost > prevSpendable.current
      );
      if (newlyEligible) setEligiblePopup(newlyEligible);
    }
    prevSpendable.current = spendablePoints;
  }, [spendablePoints, rewards]);

  const level = getLevel(settings.pointsPerLevel);
  const progress = getLevelProgress(settings.pointsPerLevel);

  const superPrizes = rewards.filter((r) => r.isSuperPrize && !r.claimed);
  const regular = rewards.filter((r) => !r.isSuperPrize && !r.claimed);

  const handleClaim = (reward: Reward) => {
    if (spendablePoints < reward.pointCost) {
      Alert.alert('Insufficient points', `You need ${reward.pointCost} pts.`);
      return;
    }
    if (reward.requiredCharacterLevel && level < reward.requiredCharacterLevel) {
      Alert.alert('Level too low', `Requires level ${reward.requiredCharacterLevel}.`);
      return;
    }
    const msg = reward.isRegular
      ? `Spend ${reward.pointCost} pts for "${reward.name}"? (Regular — stays available.)`
      : `Spend ${reward.pointCost} pts for "${reward.name}"? (One-time — removed after claiming.)`;
    Alert.alert('Claim reward?', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim', onPress: async () => {
          await claimReward(reward.id);
          await addEntry({
            habitId: null,
            type: 'reward_claim',
            amount: -reward.pointCost,
            reason: `Claimed: ${reward.name}`,
          });
        }
      },
    ]);
  };

  const handleDelete = (reward: Reward) => {
    Alert.alert('Delete reward?', `Remove "${reward.name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReward(reward.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        <View style={styles.auraSection}>
          <AuraRing level={level} displayName={settings.displayName} />
          <View style={{ flex: 1 }}>
            <PowerBar
              progress={progress}
              level={level}
              pointsPerLevel={settings.pointsPerLevel}
              lifetimePoints={lifetimePoints}
            />
          </View>
        </View>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsVal}>{Math.round(spendablePoints)}</Text>
          <Text style={styles.pointsLabel}> pts available</Text>
        </View>

        {superPrizes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SUPER PRIZES</Text>
            <SuperPrizePodium
              prizes={superPrizes}
              spendable={spendablePoints}
              level={level}
              onClaim={handleClaim}
              onDelete={handleDelete}
            />
          </>
        )}

        {regular.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>REWARDS</Text>
            <View style={styles.rewardGrid}>
              {regular.map((r) => (
                <SmallRewardIcon
                  key={r.id}
                  reward={r}
                  spendable={spendablePoints}
                  level={level}
                  onClaim={handleClaim}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          </>
        )}

        {superPrizes.length === 0 && regular.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No rewards yet. Tap + to add one.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddRewardModal visible={modalVisible} onSave={addReward} onClose={() => setModalVisible(false)} />

      {eligiblePopup && (
        <EligibilityPopup reward={eligiblePopup} onDismiss={() => setEligiblePopup(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  auraSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 8 },
  pointsVal: { fontFamily: 'BebasNeue', fontSize: 42, color: Colors.accent },
  pointsLabel: { fontFamily: 'DMSans', fontSize: 14, color: Colors.textMuted },
  sectionTitle: { fontFamily: 'BebasNeue', fontSize: 18, color: Colors.textMuted, letterSpacing: 2, marginBottom: 12 },

  // Podium
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  podiumCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  podiumCardFirst: { paddingVertical: 16, elevation: 4 },
  podiumDeleteBtn: { alignSelf: 'flex-end', padding: 2, marginBottom: 2 },
  deleteText: { fontSize: 11, color: Colors.textMuted },
  podiumRank: { fontFamily: 'BebasNeue', fontSize: 20, letterSpacing: 1 },
  podiumIcon: { width: 60, height: 60, borderRadius: 10 },
  podiumIconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHigh,
  },
  podiumName: { fontFamily: 'DMSansBold', fontSize: 11, color: Colors.textPrimary, textAlign: 'center', marginTop: 2 },
  podiumCost: { fontFamily: 'BebasNeue', fontSize: 15 },
  podiumReq: { fontFamily: 'DMSans', fontSize: 10, color: Colors.textMuted },
  podiumClaimBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginTop: 4, width: '100%', alignItems: 'center' },
  podiumClaimText: { fontFamily: 'DMSansBold', fontSize: 11, color: Colors.background },

  // Grid
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  smallCard: {
    width: (SCREEN_W - 52) / 3,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
    alignItems: 'center',
    gap: 3,
  },
  smallDeleteBtn: { position: 'absolute', top: 4, right: 6, zIndex: 1 },
  smallIcon: { width: 48, height: 48, borderRadius: 8, marginTop: 10 },
  smallIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHigh,
    marginTop: 10,
  },
  smallName: { fontFamily: 'DMSans', fontSize: 10, color: Colors.textPrimary, textAlign: 'center' },
  smallCost: { fontFamily: 'BebasNeue', fontSize: 13, color: Colors.accent },
  regularBadge: { fontFamily: 'DMSans', fontSize: 9, color: Colors.accentBlue },
  smallClaimBtn: { backgroundColor: Colors.accent, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, width: '100%', alignItems: 'center' },
  smallClaimText: { fontFamily: 'DMSansBold', fontSize: 10, color: Colors.background },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6,
  },
  fabText: { fontSize: 30, color: Colors.textPrimary, lineHeight: 36 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  inputError: {
    borderWidth: 1,
    borderColor: Colors.accentRed,
    shadowColor: Colors.accentRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 5,
  },
  errorText: {
    fontFamily: 'DMSans',
    fontSize: 11,
    color: Colors.accentRed,
    marginTop: 3,
  },
  sheetTitle: { fontFamily: 'BebasNeue', fontSize: 24, color: Colors.textPrimary, marginBottom: 12, letterSpacing: 1 },
  label: { fontFamily: 'DMSansMedium', fontSize: 12, color: Colors.textMuted, marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.surfaceHigh, borderRadius: 8, padding: 10, color: Colors.textPrimary, fontFamily: 'DMSans', fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  switchHint: { fontFamily: 'DMSans', fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  iconPicker: {
    width: 80, height: 80, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHigh, alignSelf: 'center', marginBottom: 8,
  },
  iconPreview: { width: 80, height: 80, borderRadius: 12 },
  iconPickerText: { fontFamily: 'DMSans', fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  // Popup
  popup: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: Colors.accent, borderRadius: 12,
    padding: 14, alignItems: 'center', elevation: 10,
  },
  popupText: { fontFamily: 'DMSansBold', fontSize: 14, color: Colors.background, textAlign: 'center' },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontFamily: 'DMSans', fontSize: 13, color: Colors.textMuted },
});
