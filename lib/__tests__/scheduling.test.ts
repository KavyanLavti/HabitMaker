/// <reference types="node" />
// Run: npx tsx lib/__tests__/scheduling.test.ts
import assert from 'node:assert/strict';
import { plannedSlot, findConflicts, suggestSlots, SchedHabit, Busy, overlaps } from '../scheduling';

const gym: SchedHabit = { id: 'gym', name: 'Gym', scheduleType: 'fixed', scheduledTime: '07:00', windowEnd: null, dailyDurationMinutes: 120 };
const read: SchedHabit = { id: 'read', name: 'Read', scheduleType: 'window', scheduledTime: '18:00', windowEnd: '22:00', dailyDurationMinutes: 30 };
const quit: SchedHabit = { id: 'smoke', name: "Don't smoke", scheduleType: 'avoid', scheduledTime: '21:00', windowEnd: null, dailyDurationMinutes: 0 };
const cls: Busy = { start: 8 * 60, end: 9 * 60, title: 'DBMS lecture' };

// Overlap edges: touching isn't overlapping
assert.equal(overlaps({ start: 0, end: 60 }, { start: 60, end: 90 }), false);
assert.equal(overlaps({ start: 0, end: 61 }, { start: 60, end: 90 }), true);

// Fixed habit sits at its time; override moves it
assert.deepEqual(plannedSlot(gym, []), { start: 420, end: 540 });
assert.deepEqual(plannedSlot(gym, [], '17:00'), { start: 1020, end: 1140 });
// Avoid habits never get a slot
assert.equal(plannedSlot(quit, []), null);

// Window habit slides to the first free time inside its window
const evening: Busy = { start: 18 * 60, end: 19 * 60, title: 'Meeting' };
assert.deepEqual(plannedSlot(read, [evening]), { start: 19 * 60, end: 19 * 60 + 30 });

// The 7–9 gym clashes with Wednesday's 8–9 class, only on that day
const conflicts = findConflicts([gym, read, quit], ['2026-10-21', '2026-10-22'], { '2026-10-22': [cls] }, {});
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].date, '2026-10-22');
assert.equal(conflicts[0].clashes[0].title, 'DBMS lecture');
// Overriding that day to the evening resolves it
assert.equal(findConflicts([gym], ['2026-10-22'], { '2026-10-22': [cls] }, { gym: { '2026-10-22': '17:00' } }).length, 0);
// A window habit with room to move isn't a conflict
assert.equal(findConflicts([read], ['d'], { d: [evening] }, {}).length, 0);

// Suggestions: all free, sorted sensibly, never overlapping the class (with buffer)
const sug = suggestSlots(gym, [cls], [17 * 60, 17 * 60 + 15, 17 * 60 + 30]);
assert.equal(sug.length, 3);
for (const s of sug) assert.ok(!overlaps({ start: s.start, end: s.start + 120 }, cls, 10), `clash at ${s.start}`);
// History says ~17:15, so an evening slot should be among the picks
assert.ok(sug.some((s) => s.start >= 16 * 60 + 30 && s.start <= 18 * 60), JSON.stringify(sug));
// Picks are spread out
assert.ok(Math.abs(sug[0].start - sug[1].start) >= 45);

// Window habit suggestions prefer inside the window
const rs = suggestSlots(read, [{ start: 18 * 60, end: 22 * 60, title: 'Exam' }], []);
assert.ok(rs.length > 0);

console.log('scheduling: all passed');
