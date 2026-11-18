/// <reference types="node" />
// Run: npx tsx lib/__tests__/nutrition.test.ts
import assert from 'node:assert/strict';
import {
  cleanAiItems, scaleItem, scaleQuantity, sumItems, mealForHour, weekCalories, weekAverages, daysOnTarget, recentFoods,
  emptyMicros, FoodItem,
} from '../nutrition';

// AI output cleaning: bare array or {items}, junk dropped, numbers clamped, micros filled
const cleaned = cleanAiItems({
  items: [
    { name: ' Roti ', quantity: '2 rotis', grams: 80, calories: 240, protein_g: 7.24, carbs_g: 40, fat_g: 5, fiber_g: 4, micros: { iron: 2.1 } },
    { name: '', calories: 100 },
    { name: 'Dal', quantity: '', grams: -5, calories: '180', protein_g: 'x', micros: null },
  ],
});
assert.equal(cleaned.length, 2);
assert.equal(cleaned[0].name, 'Roti');
assert.equal(cleaned[0].protein, 7.2);
assert.equal(cleaned[0].micros.iron, 2.1);
assert.equal(cleaned[0].micros.vitC, 0);
assert.equal(cleaned[1].quantity, '1 serving');
assert.equal(cleaned[1].grams, 0);
assert.equal(cleaned[1].calories, 180);
assert.equal(cleaned[1].protein, 0);
assert.equal(cleanAiItems([{ name: 'Chai', calories: 1e9 }])[0].calories, 5000);
assert.deepEqual(cleanAiItems('nonsense'), []);

// Portion scaling
const roti = cleaned[0];
const three = scaleItem(roti, 1.5, scaleQuantity(roti.quantity, 1.5));
assert.equal(three.quantity, '3 rotis');
assert.equal(three.calories, 360);
assert.equal(three.grams, 120);
assert.equal(three.micros.iron, 3.2);
assert.equal(scaleQuantity('1 katori', 0.5), '0.5 katori');
assert.equal(scaleQuantity('a plate', 2), '2 × a plate');
assert.equal(scaleQuantity('2 rotis', 1), '2 rotis');

// Totals
const t = sumItems([roti, cleaned[1]]);
assert.equal(t.calories, 420);
assert.equal(t.micros.iron, 2.1);

// Meal by hour
assert.equal(mealForHour(8), 'breakfast');
assert.equal(mealForHour(13), 'lunch');
assert.equal(mealForHour(17), 'snack');
assert.equal(mealForHour(21), 'dinner');
assert.equal(mealForHour(2), 'dinner');

// Weekly stats use Monday–Sunday and average logged days only
const mk = (date: string, calories: number, protein = 50, createdAt = `${date}T10:00:00Z`): FoodItem => ({
  id: date + calories, date, meal: 'lunch', source: 'text', createdAt, name: 'x', quantity: '1', grams: 0,
  calories, protein, carbs: 0, fat: 0, fiber: 0, micros: emptyMicros(),
});
// 2026-11-18 is a Wednesday → week starts Monday 2026-11-16
const items = [mk('2026-11-15', 9999), mk('2026-11-16', 2000), mk('2026-11-17', 1500), mk('2026-11-17', 700), mk('2026-11-18', 3000)];
const week = weekCalories(items, '2026-11-18');
assert.equal(week[0].date, '2026-11-16');
assert.equal(week[6].date, '2026-11-22');
assert.equal(week[1].calories, 2200);
assert.equal(week.filter((d) => d.logged).length, 3); // Sunday 15th belongs to last week
const avg = weekAverages(week);
assert.equal(avg.days, 3);
assert.equal(avg.calories, Math.round((2000 + 2200 + 3000) / 3));
assert.equal(daysOnTarget(week, 2100), 2); // 2000 and 2200 within ±10%, 3000 isn't

// Recent foods: newest first, de-duplicated by name + quantity
const r = recentFoods([
  { ...mk('2026-11-16', 100), name: 'Poha', createdAt: '2026-11-16T03:00:00Z' },
  { ...mk('2026-11-17', 100), name: 'poha', createdAt: '2026-11-17T03:00:00Z' },
  { ...mk('2026-11-17', 200), name: 'Chai', createdAt: '2026-11-17T04:00:00Z' },
]);
assert.deepEqual(r.map((x) => x.name), ['Chai', 'poha']);

console.log('nutrition: all passed');
