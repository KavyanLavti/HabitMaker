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
