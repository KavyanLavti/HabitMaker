/// <reference types="node" />
// Run: npx tsx lib/__tests__/streaks.test.ts
import assert from 'node:assert/strict';
import { computeStreak } from '../streaks';

const T = '2026-10-10';

// 4 straight days ending today → streak 4, 2 freezes
let s = computeStreak('2026-10-07', ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'], T);
assert.deepEqual([s.streak, s.freezes], [4, 2]);

// Today not done yet is not a miss
s = computeStreak('2026-10-07', ['2026-10-07', '2026-10-08', '2026-10-09'], T);
assert.deepEqual([s.streak, s.freezes, s.frozenDays.length], [3, 1, 0]);

// Miss with a freeze banked: freeze spent, streak survives (frozen day adds nothing),
// then 08+09 earn a fresh freeze
s = computeStreak('2026-10-05', ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'], T);
assert.deepEqual([s.streak, s.freezes, s.frozenDays], [4, 1, ['2026-10-07']]);

// Miss with no freeze: reset
s = computeStreak('2026-10-06', ['2026-10-06', '2026-10-08', '2026-10-09'], T);
assert.deepEqual([s.streak, s.freezes], [2, 1]);

// Freezes cap at 3
const ten = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
s = computeStreak('2026-10-01', ten, T);
assert.deepEqual([s.streak, s.freezes], [10, 3]);

// Two misses, one freeze → second miss resets
s = computeStreak('2026-10-03', ['2026-10-03', '2026-10-04'], T);
assert.deepEqual([s.streak, s.freezes], [0, 0]);

// Completions before createdAt (restored data) still count
s = computeStreak('2026-10-10', ['2026-10-08', '2026-10-09'], T);
assert.deepEqual([s.streak, s.freezes], [2, 1]);

console.log('streaks: all passed');

// Rest days: a Mon/Wed/Fri habit isn't broken by Tue/Thu/weekend
{
  const { isActiveOn } = require('../dates');
  const mwf = (1 << 1) | (1 << 3) | (1 << 5);
  const active = (d: string) => isActiveOn(mwf, d);
  // 2026-10-05 is a Monday. Done Mon, Wed, Fri, next Mon.
  const r = computeStreak('2026-10-05', ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12'], '2026-10-13', active);
  assert.deepEqual([r.streak, r.freezes, r.frozenDays.length], [4, 2, 0]);
  // Missing Wednesday (an active day) still spends a freeze
  const r2 = computeStreak('2026-10-05', ['2026-10-05', '2026-10-06', '2026-10-09'], '2026-10-10', active);
  assert.deepEqual(r2.frozenDays, ['2026-10-07']);
  console.log('streaks (rest days): passed');
}
