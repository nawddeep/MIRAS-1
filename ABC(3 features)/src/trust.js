// Trust & reputation rules for Local Friends and travellers:
// verification lifecycle, two-way reviews, ratings and merit tiers.
// Everything is computed from state so the rules live in one place.

export const DAY = 86400000;
export const VERIFY_VALID_DAYS = 365;   // DigiLocker verification must be renewed yearly
export const RENEW_NOTICE_DAYS = 30;    // remind the local this many days before expiry
export const REVIEW_WINDOW_DAYS = 14;   // reviews open when the trip ends and close after 14 days
export const EDIT_HOURS = 48;           // a review can be edited for 48 hours
export const GRACE_DAYS = 30;           // tier drops wait 30 days (except safety issues)
const PRIOR_RATING = 4.5, PRIOR_WEIGHT = 3; // Bayesian prior: one review can't swing a new local

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * DAY).toISOString();
const endOfDay = (dateStr) => new Date(`${dateStr}T23:59:59`).getTime();
export const monthLabel = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '');

// ---------------------------------------------------------------- verification
export const STATUS_LABEL = {
  none: 'Not verified', review: 'Under manual review', verified: 'Verified', expired: 'Expired',
  suspended: 'Suspended', revoked: 'Needs re-verification',
};
export const expiresAt = (v) => v?.expiresAt || (v?.verifiedAt ? addDays(v.verifiedAt, VERIFY_VALID_DAYS) : null);
export const daysToExpiry = (v) => (expiresAt(v) ? Math.ceil((new Date(expiresAt(v)) - Date.now()) / DAY) : null);
/** none | review | verified | expired | suspended | revoked */
export function verificationState(v) {
  if (!v) return 'none';
  const s = v.status || 'verified';
  if (s !== 'verified') return s;
  return daysToExpiry(v) < 0 ? 'expired' : 'verified';
}
export const isVerified = (u) => u?.type === 'local' && verificationState(u.local?.verification) === 'verified';

const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Profile name vs name on the document – small spelling differences and a missing middle name are OK. */
export function namesMatch(a, b) {
  const A = normName(a), B = normName(b);
  if (!A.length || !B.length) return false;
  if (lev(A.join(' '), B.join(' ')) <= 2) return true;
  const [s, l] = A.length <= B.length ? [A, B] : [B, A];
  return s.length >= Math.min(2, l.length) && s.every((t) => l.some((x) => lev(t, x) <= 1));
}

// ---------------------------------------------------------------- reviews
export const T2L_CATS = ['Knowledge', 'Friendliness', 'Punctuality', 'Value for money', 'Safety'];
export const L2T_CATS = ['Respectful', 'Punctual', 'Communication', 'Followed the plan', 'Paid as agreed'];
export const T2L_TAGS = ['Knowledgeable', 'Punctual', 'Friendly', 'Good value', 'Felt safe', 'Great stories', 'Flexible'];
export const L2T_TAGS = ['Great guest', 'Respectful', 'On time', 'Fun to host', 'Late', 'Rude', 'Changed plans a lot'];

export const tripEnded = (g) => !!g && g.endDate < todayStr();
export const reviewDeadline = (g) => endOfDay(g.endDate) + REVIEW_WINDOW_DAYS * DAY;
export const reviewWindowOpen = (g) => tripEnded(g) && Date.now() <= reviewDeadline(g);
export const canEdit = (r) => !r.historic && Date.now() - new Date(r.at).getTime() < EDIT_HOURS * 3600 * 1000;

/** Who the current user can review on a trip (the local reviews each traveller; travellers review the local). */
export function reviewTargets(g, me) {
  if (!g?.localFriend) return [];
  if (me === g.localFriend) return g.members.map((m) => ({ to: m, dir: 'l2t' }));
  if (g.members.includes(me)) return [{ to: g.localFriend, dir: 't2l' }];
  return [];
}
export const findReview = (state, tripId, from, to) => (state.reviews || []).find((r) => r.tripId === tripId && r.from === from && r.to === to);
/** Blind reviews: hidden until the other side has reviewed too, or the review window has closed. */
export function isRevealed(state, r) {
  if (r.historic) return true;
  if (findReview(state, r.tripId, r.to, r.from)) return true;
  const g = state.groups.find((x) => x.id === r.tripId);
  return !g || Date.now() > reviewDeadline(g);
}
export const visibleReviewsOf = (state, u, dir) => (state.reviews || [])
  .filter((r) => r.to === u && r.dir === dir && !r.hidden && isRevealed(state, r))
  .sort((a, b) => new Date(b.at) - new Date(a.at));

function aggregate(base, list) {
  const real = list.filter((r) => !r.historic);
  const count = (base.reviews || 0) + real.length;
  const sum = (base.rating || 0) * (base.reviews || 0) + real.reduce((s, r) => s + r.stars, 0);
  return { count, avg: count ? sum / count : null, adjusted: (PRIOR_RATING * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + count) };
}
const topTags = (list, n = 3) => Object.entries(list.flatMap((r) => r.tags || []).reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {}))
  .sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
function catAverages(list, cats) {
  const out = {};
  for (const c of cats) {
    const v = list.map((r) => r.cats?.[c]).filter(Boolean);
    if (v.length) out[c] = v.reduce((a, b) => a + b, 0) / v.length;
  }
  return out;
}

// ---------------------------------------------------------------- local stats & merit tiers
export function localStats(state, u) {
  const user = state.users[u];
  const l = user?.local || {};
  const list = visibleReviewsOf(state, u, 't2l');
  const agg = aggregate({ rating: l.rating, reviews: l.reviews }, list);
  const noShows = new Set((state.reviews || []).filter((r) => r.to === u && r.noShow).map((r) => r.tripId));
  const done = state.groups.filter((g) => g.localFriend === u && tripEnded(g) && !noShows.has(g.id));
  const trips = (l.hosted || 0) + done.length;
  const baseN = l.hosted || 0;
  const reqs = (state.localRequests || []).filter((r) => r.local === u && !r.auto);
  const answered = reqs.filter((r) => r.decidedAt && new Date(r.decidedAt) - new Date(r.createdAt) <= DAY).length;
  const overdue = reqs.filter((r) => (r.decidedAt ? new Date(r.decidedAt) - new Date(r.createdAt) > DAY : Date.now() - new Date(r.createdAt) > DAY)).length;
  const respN = baseN + answered + overdue;
  const responseRate = respN ? ((l.responseRate ?? 1) * baseN + answered) / respN : null;
  const acceptedN = baseN + reqs.filter((r) => r.status === 'accepted').length;
  const cancelRate = acceptedN ? ((l.cancelRate || 0) * baseN + (l.cancelled || 0)) / acceptedN : 0;
  const lastTrip = [l.lastTripAt, ...done.map((g) => g.endDate)].filter(Boolean).sort().pop() || null;
  const safety = (state.reports || []).filter((r) => r.about === u && ['safety', 'flag'].includes(r.kind) && r.status === 'confirmed').length;
  const since = l.since || l.verification?.verifiedAt || user?.createdAt || new Date().toISOString();
  return {
    trips, reviews: agg.count, rating: agg.avg, adjusted: agg.adjusted, responseRate, cancelRate, safety,
    lastTrip, activeRecent: !!lastTrip && Date.now() - new Date(lastTrip).getTime() <= 90 * DAY,
    years: (Date.now() - new Date(since).getTime()) / (365 * DAY),
    tags: topTags(list), cats: catAverages(list, T2L_CATS), list,
  };
}

export const TIERS = {
  new: { id: 'new', rank: 0, emoji: '🌱', name: 'New Friend', short: 'New', maxFee: 1500, blurb: 'Verified and just getting started – fewer than 5 completed trips.' },
  trusted: { id: 'trusted', rank: 1, emoji: '⭐', name: 'Trusted Friend', short: 'Trusted', maxFee: 3000, blurb: '5+ completed trips, rating 4.3+, no confirmed safety reports.' },
  top: { id: 'top', rank: 2, emoji: '🏅', name: 'Top Local', short: 'Top', maxFee: 5000, blurb: '20+ trips, rating 4.7+, answers 90%+ of requests within 24 h, cancels 5% or less, active in the last 90 days.' },
  legend: { id: 'legend', rank: 3, emoji: '👑', name: 'Udaipur Legend', short: 'Legend', maxFee: 10000, blurb: '50+ trips, rating 4.8+, a year or more hosting, a spotless record – plus everything Top Locals do.' },
};
export const TIER_ORDER = ['new', 'trusted', 'top', 'legend'];
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);

/** Requirement checklist for a tier – used for computing tiers and for the progress card. */
export function tierChecks(tierId, s) {
  const clean = { label: 'No confirmed safety reports', ok: s.safety === 0, have: s.safety ? `${s.safety} report${s.safety > 1 ? 's' : ''}` : 'clean' };
  const trips = (n) => ({ label: `${n}+ completed trips`, ok: s.trips >= n, have: `${s.trips}` });
  const rating = (r) => ({ label: `Rating ${r}+`, ok: s.adjusted >= r, have: s.reviews ? s.adjusted.toFixed(2) : 'no reviews' });
  const reliable = [
    { label: 'Response rate 90%+', ok: (s.responseRate ?? 0) >= 0.9, have: pct(s.responseRate) },
    { label: 'Cancellations 5% or less', ok: s.cancelRate <= 0.05, have: pct(s.cancelRate) },
    { label: 'A trip in the last 90 days', ok: s.activeRecent, have: s.lastTrip ? monthLabel(s.lastTrip) : 'none yet' },
  ];
  if (tierId === 'trusted') return [trips(5), rating(4.3), clean];
  if (tierId === 'top') return [trips(20), rating(4.7), ...reliable, clean];
  if (tierId === 'legend') return [trips(50), rating(4.8), { label: '1+ year hosting', ok: s.years >= 1, have: `${s.years.toFixed(1)} yrs` }, ...reliable, clean];
  return [];
}
export function computeTier(s) {
  if (s.safety > 0) return 'new';
  for (const t of ['legend', 'top', 'trusted']) if (tierChecks(t, s).every((c) => c.ok)) return t;
  return 'new';
}
/** Tier shown on the profile (null when not verified – both tags go together). */
export const displayTier = (u) => (isVerified(u) ? (u.local?.tierState?.current || 'new') : null);
export const feeCap = (u) => TIERS[displayTier(u) || 'new'].maxFee;

// ---------------------------------------------------------------- traveller (guest) rating – visible to locals only
export function guestStats(state, u) {
  const user = state.users[u];
  const list = visibleReviewsOf(state, u, 'l2t');
  const agg = aggregate(user?.guest || {}, list);
  return { ...agg, goodGuest: agg.count >= 3 && agg.avg >= 4.5, tags: topTags(list), list };
}
