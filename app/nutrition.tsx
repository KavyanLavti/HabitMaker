import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Image, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Space, glow } from '@/constants/theme';
import { ScreenHeader, SystemPanel, SystemButton, Body, Bar, sharedStyles } from '@/components/ui/System';
import { useNutritionStore } from '@/store/nutritionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { addDaysKey, describeKey, todayKey } from '@/lib/dates';
import { nowDate } from '@/lib/clock';
import {
  FoodItem, FoodNutrition, MEAL_TYPES, MICROS, MealType, mealForHour, recentFoods, scaleItem, scaleQuantity, sumItems,
} from '@/lib/nutrition';
import { analyseFood, FoodAiError, FoodImage, pickFoodImage, PROVIDER_INFO } from '@/lib/foodAI';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function NutritionScreen() {
  const router = useRouter();
  const { items, remove } = useNutritionStore();
  const { settings } = useSettingsStore();
  const [date, setDate] = useState(todayKey());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [showMicros, setShowMicros] = useState(false);

  const dayItems = items.filter((i) => i.date === date);
  const totals = sumItems(dayItems);
  const { day, date: dateText } = describeKey(date);
  const target = settings.calorieTarget;
  const left = target - totals.calories;

  return (
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScreenHeader
        kicker="FUEL LOG"
        title="CALORIES"
        right={<TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}><Ionicons name="close" size={26} color={Colors.textSecondary} /></TouchableOpacity>}
      />

      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => setDate(addDaysKey(date, -1))} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={Colors.system} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(todayKey())} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.dayName}>{date === todayKey() ? 'TODAY' : day}</Text>
          <Text style={styles.dateText}>{dateText}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(addDaysKey(date, 1))} style={styles.arrow} disabled={date >= todayKey()}>
          <Ionicons name="chevron-forward" size={22} color={date >= todayKey() ? Colors.border : Colors.system} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: Space.sm, paddingBottom: 120 }}>
        {/* Day summary */}
        <SystemPanel tone={left < 0 ? 'ember' : 'success'} glowing={dayItems.length > 0}>
          <View style={styles.kcalRow}>
            <View>
              <Text style={styles.kcalBig}>{totals.calories}</Text>
              <Text style={styles.kcalSub}>OF {target} KCAL</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.left, { color: left < 0 ? Colors.ember : Colors.success }]}>
                {left < 0 ? `+${-left}` : left}
              </Text>
              <Text style={styles.kcalSub}>{left < 0 ? 'OVER' : 'LEFT'}</Text>
            </View>
          </View>
          <Bar progress={Math.min(1, totals.calories / Math.max(1, target))} color={left < 0 ? Colors.ember : Colors.success} height={8} />
          <View style={styles.macros}>
            <Macro label="PROTEIN" value={totals.protein} target={settings.proteinTarget} color={Colors.system} />
            <Macro label="CARBS" value={totals.carbs} target={settings.carbsTarget} color={Colors.gold} />
            <Macro label="FAT" value={totals.fat} target={settings.fatTarget} color={Colors.shadow} />
          </View>
          <TouchableOpacity onPress={() => setShowMicros(!showMicros)} style={styles.microToggle}>
            <Text style={styles.microToggleText}>FIBRE {fmt(totals.fiber)} G · VITAMINS & MINERALS</Text>
            <Ionicons name={showMicros ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {showMicros && (
            <Animated.View entering={FadeIn}>
              {MICROS.map((m) => {
                const v = totals.micros[m.key];
                const pct = v / m.daily;
                const color = m.limit ? (pct > 1 ? Colors.danger : Colors.textSecondary) : pct >= 1 ? Colors.success : Colors.frost;
                return (
                  <View key={m.key} style={styles.microRow}>
                    <Text style={styles.microName}>{m.label}{m.limit ? ' (limit)' : ''}</Text>
                    <View style={{ flex: 1 }}><Bar progress={Math.min(1, pct)} color={color} height={4} /></View>
                    <Text style={styles.microVal}>{fmt(v)} {m.unit} · {Math.round(pct * 100)}%</Text>
                  </View>
                );
              })}
              <Body muted style={{ fontSize: 10, marginTop: 4 }}>% of an adult's approximate daily need (ICMR-NIN 2020). AI estimates, not lab values.</Body>
            </Animated.View>
          )}
        </SystemPanel>

        {dayItems.length === 0 && (
          <Body muted style={{ textAlign: 'center', marginTop: Space.lg }}>
            Nothing logged {date === todayKey() ? 'today' : 'on this day'}. Tap ADD FOOD and snap your plate.
          </Body>
        )}

        {MEAL_TYPES.map(({ key, label }) => {
          const rows = dayItems.filter((i) => i.meal === key);
          if (!rows.length) return null;
          const t = sumItems(rows);
          return (
            <Animated.View key={key} entering={FadeInDown.springify()} layout={LinearTransition}>
              <SystemPanel title={`${label} · ${t.calories} KCAL`}>
                {rows.map((r) => (
                  <Animated.View key={r.id} exiting={FadeOut} layout={LinearTransition}>
                    <TouchableOpacity style={styles.itemRow} onPress={() => setEditing(r)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{r.name}</Text>
                        <Text style={styles.itemQty}>{r.quantity}{r.grams ? ` · ${r.grams} g` : ''} · P {fmt(r.protein)} · C {fmt(r.carbs)} · F {fmt(r.fat)}</Text>
                      </View>
                      <Text style={styles.itemKcal}>{r.calories}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </SystemPanel>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={styles.bottom}>
        <SystemButton label="+ ADD FOOD" tone="success" onPress={() => setAdding(true)} />
      </View>

      <AddFood visible={adding} date={date} onClose={() => setAdding(false)} onOpenSettings={() => { setAdding(false); router.push('/settings'); }} />
      <ItemEditor item={editing} onClose={() => setEditing(null)} onDelete={(id) => { remove(id); setEditing(null); }} />
    </SafeAreaView>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroVal, { color }]}>{fmt(value)}<Text style={styles.macroOf}> / {target} G</Text></Text>
      <Bar progress={Math.min(1, value / Math.max(1, target))} color={color} height={4} />
    </View>
  );
}

/** Tap a logged item: change the portion, move it to another meal, or delete it. */
function ItemEditor({ item, onClose, onDelete }: { item: FoodItem | null; onClose: () => void; onDelete: (id: string) => void }) {
  const { scale, moveToMeal } = useNutritionStore();
  if (!item) return null;
  const apply = async (f: number) => { Haptics.selectionAsync(); await scale(item.id, f); onClose(); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SystemPanel title={item.name.toUpperCase()} glowing>
          <Body muted>{item.quantity} · {item.calories} kcal</Body>
          <Text style={[sharedStyles.inputLabel, { marginTop: Space.md }]}>CHANGE PORTION</Text>
          <View style={styles.chips}>
            {[0.5, 0.75, 1.25, 1.5, 2].map((f) => (
              <TouchableOpacity key={f} style={styles.chip} onPress={() => apply(f)}>
                <Text style={styles.chipText}>{f === 0.5 ? '½' : f === 0.75 ? '¾' : `${f}×`}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[sharedStyles.inputLabel, { marginTop: Space.md }]}>MEAL</Text>
          <View style={styles.chips}>
            {MEAL_TYPES.map((m) => (
              <TouchableOpacity key={m.key} style={[styles.chip, item.meal === m.key && styles.chipOn]}
                onPress={async () => { await moveToMeal(item.id, m.key); onClose(); }}>
                <Text style={[styles.chipText, item.meal === m.key && { color: Colors.background }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.lg }}>
            <SystemButton label="DELETE" tone="danger" variant="outline" small onPress={() => onDelete(item.id)} style={{ flex: 1 }} />
            <SystemButton label="DONE" variant="ghost" small onPress={onClose} style={{ flex: 1 }} />
          </View>
        </SystemPanel>
      </View>
    </Modal>
  );
}

interface Draft extends FoodNutrition { base: FoodNutrition; factor: number }

/** Photo / text → AI estimate → you review portions → saved to a meal. Recent foods re-add in one tap. */
function AddFood({ visible, date, onClose, onOpenSettings }: {
  visible: boolean; date: string; onClose: () => void; onOpenSettings: () => void;
}) {
  const { items, addItems } = useNutritionStore();
  const { settings } = useSettingsStore();
  const provider = settings.foodAiProvider;
  const [meal, setMeal] = useState<MealType>(mealForHour(nowDate().getHours()));
  const [image, setImage] = useState<FoodImage | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recent = useMemo(() => recentFoods(items), [items]);

  const reset = () => { setImage(null); setText(''); setDrafts(null); setNotes(''); setError(null); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const takePhoto = async (from: 'camera' | 'gallery') => {
    setError(null);
    try {
      const img = await pickFoodImage(from);
      if (img) { setImage(img); setDrafts(null); }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const analyse = async () => {
    setBusy(true);
    setError(null);
    try {
      const model = provider === 'claude' ? settings.foodAiModelClaude : settings.foodAiModelGemini;
      const res = await analyseFood({ image: image ?? undefined, text }, provider, model);
      setDrafts(res.items.map((i) => ({ ...i, base: i, factor: 1 })));
      setNotes(res.notes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e instanceof FoodAiError ? e.message : `Something went wrong: ${e?.message ?? e}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const setFactor = (idx: number, factor: number) => {
    if (!drafts) return;
    const f = Math.max(0.25, Math.round(factor * 4) / 4);
    setDrafts(drafts.map((d, i) => (i === idx ? { ...scaleItem(d.base, f, scaleQuantity(d.base.quantity, f)), base: d.base, factor: f } : d)));
  };

  const save = async () => {
    if (!drafts?.length) return;
    const foods = drafts.map(({ base: _b, factor: _f, ...food }) => food);
    await addItems(date, meal, foods, image ? 'photo' : 'text');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const addRecent = async (f: FoodItem) => {
    const { id: _i, date: _d, meal: _m, source: _s, createdAt: _c, ...food } = f;
    await addItems(date, meal, [food], 'recent');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
  };

  const draftTotal = drafts ? sumItems(drafts).calories : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior="height" style={styles.sheetWrap}>
        <SystemPanel title="ADD FOOD" glowing tone="success" style={{ maxHeight: '92%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.chips}>
              {MEAL_TYPES.map((m) => (
                <TouchableOpacity key={m.key} style={[styles.chip, meal === m.key && styles.chipOn]} onPress={() => setMeal(m.key)}>
                  <Text style={[styles.chipText, meal === m.key && { color: Colors.background }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!drafts && (
              <>
                <View style={styles.photoRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto('camera')}>
                    <Ionicons name="camera" size={30} color={Colors.success} />
                    <Text style={styles.photoText}>CAMERA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto('gallery')}>
                    <Ionicons name="images" size={28} color={Colors.system} />
                    <Text style={[styles.photoText, { color: Colors.system }]}>GALLERY</Text>
                  </TouchableOpacity>
                </View>
                {image && (
                  <Animated.View entering={FadeIn} style={{ marginTop: Space.md }}>
                    <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
                    <TouchableOpacity style={styles.clearImg} onPress={() => setImage(null)}>
                      <Ionicons name="close-circle" size={26} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
                <TextInput
                  style={[sharedStyles.input, { marginTop: Space.md, minHeight: 60, textAlignVertical: 'top' }]}
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder={image ? 'Optional detail: "made with little oil", "I ate half"…' : 'Or type it: "2 roti, 1 katori dal, salad"'}
                  placeholderTextColor={Colors.textMuted}
                />
                <SystemButton
                  label={busy ? 'ANALYSING…' : `ANALYSE · ${PROVIDER_INFO[provider].label}`}
                  tone="success"
                  loading={busy}
                  disabled={busy || (!image && !text.trim())}
                  onPress={analyse}
                  style={{ marginTop: Space.md }}
                />
              </>
            )}

            {error && (
              <Animated.View entering={FadeIn} style={styles.error}>
                <Body style={{ color: Colors.danger, fontSize: 13 }}>{error}</Body>
                {/settings/i.test(error) && (
                  <SystemButton label="OPEN SETTINGS" small variant="outline" tone="danger" onPress={onOpenSettings} style={{ marginTop: Space.sm }} />
                )}
              </Animated.View>
            )}

            {drafts && (
              <Animated.View entering={FadeInDown.springify()}>
                {drafts.length === 0 && <Body muted style={{ marginTop: Space.md }}>No food found. {notes}</Body>}
                {drafts.map((d, idx) => (
                  <View key={idx} style={styles.draftRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{d.name}</Text>
                      <Text style={styles.itemQty}>{d.quantity}{d.grams ? ` · ${d.grams} g` : ''} · P {fmt(d.protein)} · C {fmt(d.carbs)} · F {fmt(d.fat)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFactor(idx, d.factor - 0.25)} style={styles.step}><Ionicons name="remove" size={16} color={Colors.system} /></TouchableOpacity>
                    <Text style={styles.itemKcal}>{d.calories}</Text>
                    <TouchableOpacity onPress={() => setFactor(idx, d.factor + 0.25)} style={styles.step}><Ionicons name="add" size={16} color={Colors.system} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => setDrafts(drafts.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                      <Ionicons name="close" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
                {notes && drafts.length > 0 ? <Body muted style={{ fontSize: 12, marginTop: Space.sm }}>Note: {notes}</Body> : null}
                {drafts.length > 0 && (
                  <Text style={[styles.draftTotal, glow(Colors.success)]}>TOTAL {draftTotal} KCAL</Text>
                )}
                <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.md }}>
                  <SystemButton label="RETAKE" variant="ghost" small onPress={() => setDrafts(null)} style={{ flex: 1 }} />
                  <SystemButton label={`SAVE TO ${MEAL_TYPES.find((m) => m.key === meal)!.label}`} tone="success" small
                    disabled={!drafts.length} onPress={save} style={{ flex: 2 }} />
                </View>
              </Animated.View>
            )}

            {!drafts && !busy && recent.length > 0 && (
              <>
                <Text style={[sharedStyles.inputLabel, { marginTop: Space.lg }]}>RECENT · TAP TO ADD AGAIN</Text>
                {recent.map((f) => (
                  <TouchableOpacity key={f.id} style={styles.itemRow} onPress={() => addRecent(f)}>
                    <Ionicons name="refresh" size={14} color={Colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{f.name}</Text>
                      <Text style={styles.itemQty}>{f.quantity}</Text>
                    </View>
                    <Text style={styles.itemKcal}>{f.calories}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <SystemButton label="CLOSE" variant="ghost" onPress={close} style={{ marginTop: Space.md }} />
          </ScrollView>
        </SystemPanel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg },
  arrow: { padding: Space.sm },
  dayName: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.success },
  dateText: { fontFamily: Fonts.displaySemi, fontSize: 11, letterSpacing: 1.5, color: Colors.textSecondary },
  kcalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Space.sm },
  kcalBig: { fontFamily: Fonts.display, fontSize: 40, color: Colors.textPrimary, lineHeight: 44 },
  kcalSub: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  left: { fontFamily: Fonts.display, fontSize: 24 },
  macros: { flexDirection: 'row', gap: Space.md, marginTop: Space.md },
  macroLabel: { fontFamily: Fonts.displaySemi, fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted },
  macroVal: { fontFamily: Fonts.display, fontSize: 16, marginVertical: 2 },
  macroOf: { fontSize: 10, color: Colors.textMuted },
  microToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.md, paddingTop: Space.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  microToggleText: { fontFamily: Fonts.displaySemi, fontSize: 10, letterSpacing: 1.2, color: Colors.textSecondary },
  microRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: 6 },
  microName: { width: 92, fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary },
  microVal: { width: 110, textAlign: 'right', fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.textPrimary },
  itemQty: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  itemKcal: { fontFamily: Fonts.display, fontSize: 15, color: Colors.success, minWidth: 40, textAlign: 'right' },
  bottom: { position: 'absolute', left: Space.lg, right: Space.lg, bottom: Space.xl },
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,10,0.9)', justifyContent: 'center', padding: Space.lg },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(2,4,10,0.9)', justifyContent: 'flex-end', padding: Space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.success, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: Colors.success },
  chipText: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 1, color: Colors.success },
  photoRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  photoBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Space.lg,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 4, backgroundColor: Colors.surfaceHigh,
  },
  photoText: { fontFamily: Fonts.display, fontSize: 12, letterSpacing: 2, color: Colors.success },
  preview: { width: '100%', height: 200, borderRadius: 4 },
  clearImg: { position: 'absolute', top: 6, right: 6 },
  error: { marginTop: Space.md, padding: Space.sm, borderWidth: 1, borderColor: Colors.danger + '88', borderRadius: 3 },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  step: { borderWidth: 1, borderColor: Colors.systemDim, borderRadius: 3, padding: 4 },
  draftTotal: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 2, color: Colors.success, textAlign: 'right', marginTop: Space.sm },
});
