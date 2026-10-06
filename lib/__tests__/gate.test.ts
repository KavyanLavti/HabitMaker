// Run: npx tsx lib/__tests__/gate.test.ts
import assert from 'node:assert/strict';
import { unusedEarnedMinutes, rollBank, splitRulesChange, defaultGateRules } from '../gate';

const min = (m: number) => m * 60000;

// Used only the free 15 → all 10 bought minutes unused
assert.equal(unusedEarnedMinutes({ yt: 10 }, { yt: min(15) }, 15), 10);
// Used 20 → 5 of 10 bought minutes used
assert.equal(unusedEarnedMinutes({ yt: 10 }, { yt: min(20) }, 15), 5);
// Used everything
assert.equal(unusedEarnedMinutes({ yt: 10 }, { yt: min(25) }, 15), 0);
// Didn't open the app at all
assert.equal(unusedEarnedMinutes({ yt: 5, ig: 5 }, {}, 15), 10);

// Bank examples from the spec
assert.equal(rollBank(0, 45), 30); // cap at 30, rest expire
assert.equal(rollBank(25, 20), 30); // only 5 more fit
assert.equal(rollBank(10, 5), 15);

// Rules: removing an app or raising the free time waits until tomorrow
const active = { ...defaultGateRules, apps: [{ pkg: 'yt', label: 'YouTube' }, { pkg: 'ig', label: 'Instagram' }] };
let r = splitRulesChange(active, { ...active, apps: [active.apps[0]] });
assert.equal(r.now.apps.length, 2);
assert.equal(r.pending?.apps.length, 1);

r = splitRulesChange(active, { ...active, baseMinutes: 30 });
assert.equal(r.now.baseMinutes, 15);
assert.equal(r.pending?.baseMinutes, 30);

// Tightening applies immediately, nothing pending
r = splitRulesChange(active, { ...active, baseMinutes: 10, pointsPerPack: 40, apps: [...active.apps, { pkg: 'x', label: 'X' }] });
assert.deepEqual([r.now.baseMinutes, r.now.pointsPerPack, r.now.apps.length, r.pending], [10, 40, 3, null]);

// Turning the gate off waits
r = splitRulesChange(active, { ...active, enabled: false });
assert.deepEqual([r.now.enabled, r.pending?.enabled], [true, false]);

console.log('gate: all passed');
