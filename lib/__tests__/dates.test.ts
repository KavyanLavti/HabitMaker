/// <reference types="node" />
// Run: npx tsx lib/__tests__/dates.test.ts
import assert from 'node:assert/strict';
import { setClockOffset } from '../clock';
import { addDaysKey, describeKey, todayKey, dateKey } from '../dates';

// Day names / formatting
assert.deepEqual(describeKey('2026-10-20'), { day: 'TUESDAY', date: '20 OCT 2026' });
assert.deepEqual(describeKey('2027-01-01'), { day: 'FRIDAY', date: '1 JAN 2027' });

// Simulated clock moves "today" for everything that reads it
const real = dateKey(new Date());
setClockOffset(0);
assert.equal(todayKey(), real);
setClockOffset(3 * 86400000);
assert.equal(todayKey(), addDaysKey(real, 3));
setClockOffset(-86400000);
assert.equal(todayKey(), addDaysKey(real, -1));
setClockOffset(0);

// Month / year rollover
assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01');
assert.equal(addDaysKey('2026-03-01', -1), '2026-02-28');

console.log('dates: all passed');
