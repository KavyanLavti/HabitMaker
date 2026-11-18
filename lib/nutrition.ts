// Pure nutrition rules: shapes, totals, portion scaling, cleaning AI output and weekly stats.
// No React / storage imports so this can be unit tested.

import { addDaysKey, weekStartKey } from './dates';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'BREAKFAST' },
  { key: 'lunch', label: 'LUNCH' },
  { key: 'snack', label: 'SNACKS' },
  { key: 'dinner', label: 'DINNER' },
];

/** Vitamins and minerals tracked per item. Units are fixed per key (see MICROS). */
export type MicroKey = 'iron' | 'calcium' | 'vitA' | 'vitC' | 'vitB12' | 'vitD' | 'folate' | 'potassium' | 'sodium';
export type Micros = Record<MicroKey, number>;

/**
 * Approximate adult daily needs, from ICMR-NIN 2020 where available (men's values; women need more iron, 29 mg).
 * Sodium is a ceiling, not a target.
 */
export const MICROS: { key: MicroKey; label: string; unit: string; daily: number; limit?: boolean }[] = [
  { key: 'iron', label: 'Iron', unit: 'mg', daily: 19 },
  { key: 'calcium', label: 'Calcium', unit: 'mg', daily: 1000 },
  { key: 'vitA', label: 'Vitamin A', unit: 'mcg', daily: 1000 },
  { key: 'vitC', label: 'Vitamin C', unit: 'mg', daily: 80 },
  { key: 'vitB12', label: 'Vitamin B12', unit: 'mcg', daily: 2.5 },
  { key: 'vitD', label: 'Vitamin D', unit: 'mcg', daily: 15 },
  { key: 'folate', label: 'Folate', unit: 'mcg', daily: 300 },
  { key: 'potassium', label: 'Potassium', unit: 'mg', daily: 3500 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', daily: 2000, limit: true },
];
export const MICRO_KEYS = MICROS.map((m) => m.key);

export const emptyMicros = (): Micros =>
  Object.fromEntries(MICRO_KEYS.map((k) => [k, 0])) as Micros;

/** One food on a day: what the AI (or you) said it was, how much, and its nutrition for that amount. */
export interface FoodNutrition {
  name: string;
  /** Human portion, e.g. "2 rotis", "1 katori". */
  quantity: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: Micros;
}

export interface FoodItem extends FoodNutrition {
  id: string;
  date: string;
  meal: MealType;
  source: 'photo' | 'text' | 'recent';
  createdAt: string;
}

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: Micros;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const num = (v: unknown, max: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Turns whatever the model returned into safe items: drops nameless entries, clamps silly numbers,
 * fills missing micros with 0. Accepts either { items: [...] } or a bare array.
 */
export function cleanAiItems(raw: unknown): FoodNutrition[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.items) ? (raw as any).items : [];
  const out: FoodNutrition[] = [];
  for (const r of list) {
    const name = String(r?.name ?? '').trim();
    if (!name) continue;
    const m = r?.micros ?? {};
    out.push({
      name: name.slice(0, 80),
      quantity: String(r?.quantity ?? '1 serving').trim().slice(0, 40) || '1 serving',
      grams: Math.round(num(r?.grams, 3000)),
      calories: Math.round(num(r?.calories, 5000)),
      protein: round1(num(r?.protein_g ?? r?.protein, 300)),
      carbs: round1(num(r?.carbs_g ?? r?.carbs, 800)),
      fat: round1(num(r?.fat_g ?? r?.fat, 300)),
      fiber: round1(num(r?.fiber_g ?? r?.fiber, 100)),
      micros: Object.fromEntries(MICRO_KEYS.map((k) => [k, round1(num(m[k], 100000))])) as Micros,
    });
  }
  return out;
}

/** Scales an item's amount and nutrition, e.g. factor 1.5 for "half again as much". */
export function scaleItem<T extends FoodNutrition>(item: T, factor: number, quantity?: string): T {
  const f = Math.max(0, factor);
  return {
    ...item,
    quantity: quantity ?? item.quantity,
    grams: Math.round(item.grams * f),
    calories: Math.round(item.calories * f),
    protein: round1(item.protein * f),
    carbs: round1(item.carbs * f),
    fat: round1(item.fat * f),
    fiber: round1(item.fiber * f),
    micros: Object.fromEntries(MICRO_KEYS.map((k) => [k, round1(item.micros[k] * f)])) as Micros,
  };
}

/** "2 rotis" × 1.5 → "3 rotis"; anything without a leading number gets "1.5 × ". */
export function scaleQuantity(quantity: string, factor: number): string {
  if (factor === 1) return quantity;
  const m = quantity.match(/^\s*(\d+(?:\.\d+)?)(.*)$/);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
  if (m) return `${fmt(parseFloat(m[1]) * factor)}${m[2]}`;
  return `${fmt(factor)} × ${quantity}`;
}

export function sumItems(items: FoodNutrition[]): Totals {
  const t: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: emptyMicros() };
  for (const i of items) {
    t.calories += i.calories;
    t.protein += i.protein;
    t.carbs += i.carbs;
    t.fat += i.fat;
    t.fiber += i.fiber;
    for (const k of MICRO_KEYS) t.micros[k] += i.micros[k] ?? 0;
  }
  t.protein = round1(t.protein); t.carbs = round1(t.carbs); t.fat = round1(t.fat); t.fiber = round1(t.fiber);
  for (const k of MICRO_KEYS) t.micros[k] = round1(t.micros[k]);
  return t;
}

/** Suggested meal for a new entry from the local hour. */
export function mealForHour(hour: number): MealType {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snack';
  return 'dinner';
}

export interface DayCalories {
  date: string;
  calories: number;
  protein: number;
  logged: boolean;
}

/** Monday–Sunday week containing `day`. */
export function weekCalories(items: FoodItem[], day: string): DayCalories[] {
  const start = weekStartKey(day);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(start, i);
    const dayItems = items.filter((x) => x.date === date);
    const t = sumItems(dayItems);
    return { date, calories: t.calories, protein: t.protein, logged: dayItems.length > 0 };
  });
}

/** Averages over logged days only, so a day you forgot to log doesn't drag the average down. */
export function weekAverages(week: DayCalories[]): { calories: number; protein: number; days: number } {
  const logged = week.filter((d) => d.logged);
  if (!logged.length) return { calories: 0, protein: 0, days: 0 };
  return {
    calories: Math.round(logged.reduce((n, d) => n + d.calories, 0) / logged.length),
    protein: round1(logged.reduce((n, d) => n + d.protein, 0) / logged.length),
    days: logged.length,
  };
}

/** Logged days whose calories landed within ±10% of the target. */
export function daysOnTarget(week: DayCalories[], target: number): number {
  return week.filter((d) => d.logged && Math.abs(d.calories - target) <= target * 0.1).length;
}

/** Most recently eaten distinct foods (by name), newest first, for one-tap re-adding. */
export function recentFoods(items: FoodItem[], limit = 20): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const i of [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const k = `${i.name.toLowerCase()}|${i.quantity.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
    if (out.length >= limit) break;
  }
  return out;
}
