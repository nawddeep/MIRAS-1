// Deterministic day planner. Same inputs always give the same plan.
// Rules: never schedule a place outside its (sample) opening hours, keep days
// to a few stops with a lunch break, and report anything it could not check.

import { places, getPlace, distanceKm } from '../data/index.js';

/** @typedef {import('../data/types.js').Place} Place */
/**
 * @typedef {object} PlanInput
 * @property {string} start        ISO date (YYYY-MM-DD)
 * @property {number} days
 * @property {'half' | 'full'} pace
 * @property {string[]} interests
 * @property {string[]} saved
 * @property {boolean} savedOnly
 * @property {boolean} avoidSteps
 */
/**
 * @typedef {object} Stop
 * @property {Place} place
 * @property {number} arrive   minutes after midnight
 * @property {number} leave
 * @property {number} travel   minutes from the previous stop (0 for the first)
 * @property {'walk' | 'auto'} mode
 * @property {string[]} flags
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_START = 9 * 60;
const LUNCH = { from: 12 * 60 + 45, length: 60 };

/** @param {string} t "HH:MM" */
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** @param {number} m */
export const fmtTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

/** Travel estimate: walk under 1.5 km, otherwise an auto-rickshaw with 10 minutes to find one. */
/** @param {Place} a @param {Place} b */
export function travel(a, b) {
  const km = distanceKm(a.coords, b.coords) * 1.3; // streets are not straight lines
  return km < 1.5 ? { min: Math.max(5, Math.round((km / 4) * 60)), mode: /** @type {const} */ ('walk') } : { min: Math.round((km / 15) * 60) + 10, mode: /** @type {const} */ ('auto') };
}

/** @param {Place} p */
const hasSteps = (p) => !!p.accessibility?.items.some((t) => /step|steep|hill/i.test(t));

/**
 * When can this place be visited, arriving at `t` on weekday `wd`?
 * Returns the start time (possibly after a short wait) or null.
 * @param {Place} p @param {number} wd @param {number} t @param {number} dayEnd
 */
function fit(p, wd, t, dayEnd) {
  const slots = p.hours?.days[wd] ?? [];
  for (const [a, b] of slots) {
    const open = toMin(a), close = toMin(b);
    const start = Math.max(t, open);
    if (start - t > 60) continue; // do not wait more than an hour
    if (start + p.visitMinutes <= Math.min(close, dayEnd)) return start;
  }
  return null;
}

/** @param {PlanInput} input */
export function plan(input) {
  /** @type {string[]} */
  const limitations = [];
  /** @type {Array<{place: Place, reason: string}>} */
  const skipped = [];
  const maxStops = input.pace === 'full' ? 3 : 2;
  const dayEnd = input.pace === 'full' ? 18 * 60 + 30 : 13 * 60 + 30;

  // 1. candidates, ranked: saved first, then by how many interests match
  let pool = input.savedOnly ? input.saved.map((id) => getPlace(id)).filter((p) => !!p) : places.slice();
  if (input.savedOnly && !pool.length) limitations.push('You chose "only my saved places", but nothing is saved yet. Save places from their profiles, or untick that option.');
  pool = /** @type {Place[]} */ (pool).filter((p) => {
    if (!p.hours) { skipped.push({ place: p, reason: 'No opening hours on file, so it is not given a time. Fit it in loosely and ask locally.' }); return false; }
    if (input.avoidSteps && hasSteps(p)) { skipped.push({ place: p, reason: 'Recorded as having steep steps or a hill, and you asked to avoid them.' }); return false; }
    return true;
  });
  const score = (/** @type {Place} */ p) => (input.saved.includes(p.id) ? 10 : 0) + p.interests.filter((i) => input.interests.includes(i)).length * 3;
  pool = /** @type {Place[]} */ (pool).filter((p) => input.savedOnly || input.saved.includes(p.id) || !input.interests.length || p.interests.some((i) => input.interests.includes(i)));
  pool.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));

  if (input.avoidSteps) limitations.push('Step-free information is missing for most places. Places with no accessibility record are included but marked; please check them directly.');
  limitations.push('All opening hours used here are sample hours, not real timetables. Confirm before you go.');
  limitations.push('Travel times are rough estimates from straight-line distance; traffic in the old city varies.');

  // 2. fill days greedily, nearest open place next
  const used = new Set();
  const start = new Date(input.start + 'T00:00:00');
  const days = [];
  for (let d = 0; d < input.days; d++) {
    const date = new Date(start); date.setDate(start.getDate() + d);
    const wd = date.getDay();
    /** @type {Stop[]} */
    const stops = [];
    let t = DAY_START, lunched = false, lunchAfter = -1;
    /** @type {Place | null} */
    let here = null;
    while (stops.length < maxStops) {
      if (!lunched && t >= LUNCH.from && input.pace === 'full') { t += LUNCH.length; lunched = true; lunchAfter = stops.length; }
      const options = /** @type {Place[]} */ (pool).filter((p) => !used.has(p.id)).map((p) => {
        const tr = here ? travel(here, p) : { min: 0, mode: /** @type {const} */ ('walk') };
        const at = fit(p, wd, t + tr.min, dayEnd);
        return { p, tr, at };
      }).filter((o) => o.at !== null);
      if (!options.length) break;
      // prefer higher score, but penalise waiting for opening; then the nearest
      const value = (/** @type {typeof options[number]} */ o) => score(o.p) - (/** @type {number} */ (o.at) - (t + o.tr.min)) / 15;
      options.sort((a, b) => value(b) - value(a) || a.tr.min - b.tr.min);
      const best = options[0];
      const arrive = /** @type {number} */ (best.at);
      /** @type {string[]} */
      const flags = [];
      if (input.avoidSteps && !best.p.accessibility) flags.push('No checked accessibility information');
      if (arrive - (t + best.tr.min) >= 10) flags.push(`Waits ${Math.round(arrive - (t + best.tr.min))} min for opening`);
      stops.push({ place: best.p, arrive, leave: arrive + best.p.visitMinutes, travel: best.tr.min, mode: best.tr.mode, flags });
      used.add(best.p.id);
      here = best.p;
      t = arrive + best.p.visitMinutes + 15; // a breather between stops
    }
    days.push({ date, weekday: WEEKDAYS[wd], stops, lunchAfter });
  }

  // 3. anything ranked but never placed: explain why
  for (const p of /** @type {Place[]} */ (pool)) {
    if (used.has(p.id)) continue;
    const closedAll = days.every((d) => !(p.hours?.days[d.date.getDay()] ?? []).length);
    if (closedAll) skipped.push({ place: p, reason: `Closed on ${[...new Set(days.map((d) => d.weekday))].join(' and ')} (sample hours), so it was not scheduled.` });
    else if (input.saved.includes(p.id)) skipped.push({ place: p, reason: 'Saved, but the days were already full. Add a day or choose a full-day pace.' });
  }
  if (days.some((d) => !d.stops.length)) limitations.push('Some days have no stops: nothing that matches your choices is open in the time you have.');
  return { days, skipped, limitations };
}
