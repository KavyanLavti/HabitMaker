/// <reference types="node" />
// Run: npx tsx lib/__tests__/todo.test.ts
import assert from 'node:assert/strict';
import { dayStats, weekStats, overallRate, fullClearStreak, TodoRow } from '../todoAnalytics';

const t = (date: string, points: number, done: boolean): TodoRow => ({ date, points, done });
const todos = [
  t('2026-11-02', 10, true), t('2026-11-02', 5, true), // Mon: 2/2
  t('2026-11-03', 10, true), t('2026-11-03', 20, false), // Tue: 1/2
  t('2026-11-05', 5, true), // Thu: 1/1 (Wed had no plan)
  t('2026-11-06', 10, false), t('2026-11-06', 10, true), t('2026-11-06', 5, false), // Fri (today): 1/3
];

const fri = dayStats(todos, '2026-11-06');
assert.deepEqual([fri.total, fri.done, fri.pointsPlanned, fri.pointsEarned], [3, 1, 25, 10]);
assert.equal(Math.round(fri.rate! * 100), 33);
assert.equal(dayStats(todos, '2026-11-04').rate, null);

// Calendar week of Fri 2026-11-06 is Mon 11-02 .. Sun 11-08
const week = weekStats(todos, '2026-11-06');
assert.deepEqual([week[0].date, week[6].date], ['2026-11-02', '2026-11-08']);
assert.equal(overallRate(week), 5 / 8);

// Today unfinished → counts back from Thu: Thu 100%, (Wed skipped), Tue 50% stops it → 1
assert.equal(fullClearStreak(todos, '2026-11-06'), 1);
// On Thursday itself: Thu 100%, Wed none, Tue 50% → 1
assert.equal(fullClearStreak(todos, '2026-11-05'), 1);

console.log('todo: all passed');
