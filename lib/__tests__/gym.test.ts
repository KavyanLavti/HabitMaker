/// <reference types="node" />
// Run: npx tsx lib/__tests__/gym.test.ts
import assert from 'node:assert/strict';
import { estimate1RM, prSetIds, exerciseStats, weeklyVolume, workoutDays, SetRow } from '../gymAnalytics';

const set = (id: string, date: string, ex: string, i: number, reps: number, kg: number): SetRow =>
  ({ id, date, exerciseId: ex, setIndex: i, reps, weightKg: kg });

// Epley
assert.equal(estimate1RM(100, 1), 100);
assert.equal(Math.round(estimate1RM(100, 10)), 133);
assert.equal(estimate1RM(0, 5), 0);

const sets = [
  set('a', '2026-10-01', 'bench', 0, 8, 60), // first ever → PR
  set('b', '2026-10-01', 'bench', 1, 8, 60), // equal, not a PR
  set('c', '2026-10-05', 'bench', 0, 5, 70), // 81.7 > 76 → PR
  set('d', '2026-10-05', 'squat', 0, 5, 100), // first squat → PR
  set('e', '2026-10-09', 'bench', 0, 10, 55), // 73.3 → no
];
assert.deepEqual([...prSetIds(sets)].sort(), ['a', 'c', 'd']);

const bench = exerciseStats(sets, 'bench');
assert.equal(bench.sessions.length, 3);
assert.equal(bench.bestWeight, 70);
assert.equal(bench.totalVolume, 480 + 480 + 350 + 550);
assert.equal(bench.lastDate, '2026-10-09');
assert.equal(bench.sessions[0].sets, 2);

const wv = weeklyVolume(sets, '2026-10-10', 2);
assert.equal(wv[1].volume, 350 + 500 + 550); // 10-04..10-10
assert.equal(wv[0].volume, 960); // 09-27..10-03

assert.equal(workoutDays(sets, '2026-10-10', 7), 2);

console.log('gym: all passed');
