/// <reference types="node" />
// Run: npx tsx lib/__tests__/gate.test.ts
import assert from 'node:assert/strict';
import { unusedMinutes, rollBank, splitRulesChange, defaultGateRules } from '../gate';

const min = (m: number) => m * 60000;

// Never opened a gated app → its whole free 15 rolls over
assert.equal(unusedMinutes(['yt'], {}, {}, 15), 15);
// Used 5 of the free 15 → 10 left
assert.equal(unusedMinutes(['yt'], {}, { yt: min(5) }, 15), 10);
// Free 15 + 10 bought, used 20 → 5 left
assert.equal(unusedMinutes(['yt'], { yt: 10 }, { yt: min(20) }, 15), 5);
// Overusing one app doesn't eat another app's leftovers
assert.equal(unusedMinutes(['yt', 'ig'], { yt: 10 }, { yt: min(40) }, 15), 15);
// Two untouched apps → 30 (rollBank's cap decides how much fits)
assert.equal(unusedMinutes(['yt', 'ig'], {}, {}, 15), 30);
// A grant for an app since removed from the list still counts, without a free allowance
assert.equal(unusedMinutes([], { yt: 5 }, {}, 15), 5);

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
