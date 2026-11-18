import { create } from 'zustand';
import { runQuery, runMutation, newId } from '@/lib/db';
import { nowIso } from '@/lib/clock';
import { emptyMicros, FoodItem, FoodNutrition, MealType, MICRO_KEYS, scaleItem, scaleQuantity } from '@/lib/nutrition';

interface NutritionStore {
  loaded: boolean;
  items: FoodItem[];
  load: () => Promise<void>;
  addItems: (date: string, meal: MealType, foods: FoodNutrition[], source: FoodItem['source']) => Promise<void>;
  /** Multiplies an item's portion, e.g. 0.5 or 2. */
  scale: (id: string, factor: number) => Promise<void>;
  moveToMeal: (id: string, meal: MealType) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function rowToItem(r: any): FoodItem {
  let micros = emptyMicros();
  try { micros = { ...micros, ...JSON.parse(r.micros || '{}') }; } catch {}
  return { ...r, micros };
}

async function save(i: FoodItem) {
  await runMutation(
    `INSERT OR REPLACE INTO food_items (id,date,meal,name,quantity,grams,calories,protein,carbs,fat,fiber,micros,source,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [i.id, i.date, i.meal, i.name, i.quantity, i.grams, i.calories, i.protein, i.carbs, i.fat, i.fiber,
     JSON.stringify(Object.fromEntries(MICRO_KEYS.map((k) => [k, i.micros[k]]))), i.source, i.createdAt]
  );
}

export const useNutritionStore = create<NutritionStore>((set, get) => ({
  loaded: false,
  items: [],

  load: async () => {
    const rows = await runQuery<any>('SELECT * FROM food_items ORDER BY date ASC, createdAt ASC');
    set({ items: rows.map(rowToItem), loaded: true });
  },

  addItems: async (date, meal, foods, source) => {
    const added: FoodItem[] = [];
    for (const f of foods) {
      const item: FoodItem = { ...f, id: newId(), date, meal, source, createdAt: nowIso() };
      await save(item);
      added.push(item);
    }
    set((s) => ({ items: [...s.items, ...added] }));
  },

  scale: async (id, factor) => {
    const cur = get().items.find((i) => i.id === id);
    if (!cur || factor <= 0) return;
    const next = scaleItem(cur, factor, scaleQuantity(cur.quantity, factor));
    await save(next);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }));
  },

  moveToMeal: async (id, meal) => {
    await runMutation('UPDATE food_items SET meal=? WHERE id=?', [meal, id]);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, meal } : i)) }));
  },

  remove: async (id) => {
    await runMutation('DELETE FROM food_items WHERE id=?', [id]);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));
