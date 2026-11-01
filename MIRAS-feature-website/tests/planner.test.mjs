// Checks the planner's promises over many inputs. Run: npm test
import assert from 'node:assert/strict';
import { plan } from '../src/lib/planner.js';
import { places } from '../src/data/index.js';

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const interestSets = [[], ['architecture'], ['lakes', 'crafts'], ['art', 'family', 'food'], ['photography', 'spiritual', 'markets']];
let checked = 0;
for (let d = 0; d < 14; d++) {
  const date = new Date(2026, 10, 1 + d);
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  for (const interests of interestSets) for (const pace of ['half', 'full']) for (const avoidSteps of [false, true]) {
    const saved = d % 2 ? ['shilpgram', 'hathi-pol', 'sajjangarh'] : [];
    const r = plan({ start, days: 3, pace, interests, saved, savedOnly: false, avoidSteps });
    const seen = new Set();
    for (const day of r.days) {
      assert.ok(day.stops.length <= (pace === 'full' ? 3 : 2), 'day overloaded');
      for (const s of day.stops) {
        const slots = s.place.hours?.days[day.date.getDay()] ?? [];
        assert.ok(slots.some(([a, b]) => s.arrive >= toMin(a) && s.leave <= toMin(b)), `${s.place.id} scheduled while closed on ${day.weekday}`);
        assert.ok(!seen.has(s.place.id), 'place repeated');
        seen.add(s.place.id);
        if (avoidSteps) assert.ok(!s.place.accessibility?.items.some((t) => /step|steep|hill/i.test(t)), 'stepped place scheduled');
        checked++;
      }
    }
    for (const p of places.filter((x) => !x.hours)) assert.ok(!seen.has(p.id), 'place without hours scheduled');
    assert.ok(r.limitations.length > 0, 'limitations must always be reported');
  }
}
// Shilpgram has a sample Monday closure: a Monday-only trip must not include it.
const mon = plan({ start: '2026-11-02', days: 1, pace: 'full', interests: ['crafts'], saved: ['shilpgram'], savedOnly: true, avoidSteps: false });
assert.equal(mon.days[0].stops.length, 0);
assert.ok(mon.skipped.some((s) => s.place.id === 'shilpgram' && /Closed on Monday/.test(s.reason)));
console.log(`planner: ok (${checked} scheduled stops checked)`);
