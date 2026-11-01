import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { freshState, MOCK_APPEALS, MOCK_GROUPS, MOCK_LOCAL_REQUESTS, MOCK_REPORTS, MOCK_REVIEWS, MOCK_USERS } from './mockData.js';
import { EVENTS, MOCK_EVENT_PREFS, MOCK_EVENT_REMINDERS } from './eventsData.js';
import { computeTier, DAY, daysToExpiry, expiresAt, GRACE_DAYS, isVerified, localStats, TIERS, todayStr, verificationState } from './trust.js';

const KEY = 'miras-groups-v1';
const StoreCtx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // older saves (before chat & polls): add them, using the mock chat for mock groups
      const s = JSON.parse(raw);
      s.groups = s.groups.map((g) => {
        const mock = MOCK_GROUPS.find((m) => m.id === g.id);
        return { ...g, messages: g.messages || (mock ? mock.messages : []), polls: g.polls || (mock ? mock.polls : []) };
      });
      // Local Friends are paid-only and DigiLocker-verified: refresh mock locals' data, convert any free profiles
      for (const [u, user] of Object.entries(s.users)) {
        if (user.type !== 'local') continue;
        const mock = MOCK_USERS[u];
        if (mock?.local && !user.local?.verification) s.users[u] = { ...user, local: { ...user.local, pricing: mock.local.pricing, verification: mock.local.verification, about: mock.local.about } }; // once only
        else if (user.local?.pricing?.mode !== 'paid') s.users[u] = { ...user, local: { ...user.local, pricing: { mode: 'paid', amount: 800, unit: 'day' } } };
      }
      // older saves (before Local Friends): add the mock locals and their requests
      if (!s.localRequests) {
        s.localRequests = JSON.parse(JSON.stringify(MOCK_LOCAL_REQUESTS));
        for (const [u, user] of Object.entries(MOCK_USERS)) if (user.type === 'local') s.users[u] = { ...user, ...(s.users[u] || {}), type: 'local', local: user.local };
        s.groups = s.groups.map((g) => {
          const mock = MOCK_GROUPS.find((m) => m.id === g.id);
          if (!mock?.localFriend || g.localFriend) return g;
          const extra = mock.suggestions.filter((x) => x.by === mock.localFriend && !g.suggestions.some((y) => y.id === x.id));
          const msgs = mock.messages.filter((x) => !g.messages.some((y) => y.id === x.id));
          return { ...g, localFriend: mock.localFriend, suggestions: [...extra, ...g.suggestions], messages: [...g.messages, ...msgs] };
        });
      }
      // older saves (before reviews, tiers & the verified-tag lifecycle)
      if (!s.reviews) {
        s.reviews = JSON.parse(JSON.stringify(MOCK_REVIEWS));
        s.reports = JSON.parse(JSON.stringify(MOCK_REPORTS));
        s.appeals = JSON.parse(JSON.stringify(MOCK_APPEALS));
        s.notices = [];
        for (const [u, mock] of Object.entries(MOCK_USERS)) {
          const cur = s.users[u];
          if (!cur) { s.users[u] = JSON.parse(JSON.stringify(mock)); continue; }
          s.users[u] = { ...cur, ...(mock.guest ? { guest: mock.guest } : {}), ...(mock.local ? { local: { ...cur.local, ...mock.local } } : {}) };
        }
        for (const mg of MOCK_GROUPS) if (!s.groups.some((g) => g.id === mg.id)) s.groups.push(JSON.parse(JSON.stringify(mg)));
      }
      // older saves (before Events)
      if (!s.eventPrefs) {
        s.eventPrefs = JSON.parse(JSON.stringify(MOCK_EVENT_PREFS));
        s.eventReminders = JSON.parse(JSON.stringify(MOCK_EVENT_REMINDERS));
        s.eventOverrides = {};
      }
      return s;
    }
  } catch (e) { /* private mode or corrupt */ }
  return freshState();
}

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
export const makeCode = () => `MIR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

const now = () => new Date().toISOString();
const notify = (state, to, text, link) => ({ ...state, notices: [{ id: uid('n'), to, text, link, at: now(), read: false }, ...(state.notices || [])] });
const patchLocal = (state, u, patch) => ({ ...state, users: { ...state.users, [u]: { ...state.users[u], local: { ...state.users[u].local, ...patch } } } });
const setVerif = (state, u, patch, note) => {
  const v = state.users[u].local?.verification;
  if (!v) return state;
  return patchLocal(state, u, { verification: { ...v, ...patch, history: [...(v.history || []), { status: patch.status, reason: patch.reason || '', at: now(), by: note || 'MIRAS' }] } });
};

/**
 * Runs after every change: applies the verified-tag and merit-tier rules that depend on time or on
 * other data (expiry, suspension effects, promotions, 30-day grace for drops). Returns the same
 * state object when nothing changed, so it never loops.
 */
function syncTrust(state) {
  let s = state;
  const t = todayStr();
  for (const u of Object.keys(state.users)) {
    const user = s.users[u];
    if (user.type !== 'local') continue;
    const l = user.local || {};
    const v = l.verification;
    const vs = verificationState(v);
    const name = user.name.split(' ')[0];
    // ---- lost the verified tag: decline pending requests, flag upcoming trips (once per transition)
    if (vs !== 'verified' && l.listed === true) {
      s = patchLocal(s, u, { listed: false });
      for (const r of (s.localRequests || []).filter((x) => x.local === u && x.status === 'pending')) {
        s = { ...s, localRequests: s.localRequests.map((x) => (x.id === r.id ? { ...x, status: 'declined', auto: true, reply: 'Automatically declined – this Local Friend isn’t verified right now.', decidedAt: now() } : x)) };
        s = notify(s, r.by, `Your request to ${name} was automatically declined – they are no longer verified.`, '/locals?tab=requests');
      }
      for (const g of s.groups.filter((x) => x.localFriend === u && x.endDate >= t)) {
        s = updateGroup(s, g.id, (gg) => sys({ ...gg, localFlag: { at: now(), kept: false } }, `⚠️ ${name} is no longer DigiLocker verified. The leader can keep or remove them from this trip.`));
        for (const m of g.members) s = notify(s, m, `${name}, the local friend on “${g.name}”, is no longer verified. ${m === g.leader ? 'Choose whether to keep them.' : 'Your leader will decide.'}`, `/group/${g.id}`);
      }
      s = notify(s, u, vs === 'suspended' ? `Your verified tag was suspended: ${v?.reason || 'see details in Hosting'}. You’re hidden from the directory.` : vs === 'expired' ? 'Your DigiLocker verification expired. Renew it to be listed again.' : vs === 'revoked' ? `Please verify with DigiLocker again: ${v?.reason || ''}` : vs === 'review' ? 'Your verification is under manual review.' : 'You removed DigiLocker verification – you’re no longer listed.', '/hosting');
    } else if (vs === 'verified' && l.listed !== true) {
      // first time listed (no notice) or verified again after a lapse
      if (l.listed === false) {
        s = notify(s, u, '✔ You’re verified again and back in the Local Friends directory.', '/hosting');
        for (const g of s.groups.filter((x) => x.localFriend === u && x.localFlag)) s = updateGroup(s, g.id, (gg) => sys({ ...gg, localFlag: null }, `✔ ${name} is DigiLocker verified again.`));
      }
      s = patchLocal(s, u, { listed: true });
    }
    // ---- renewal reminder
    if (vs === 'verified' && daysToExpiry(v) <= 30 && s.users[u].local.expiryNoticeFor !== expiresAt(v)) {
      s = patchLocal(s, u, { expiryNoticeFor: expiresAt(v) });
      s = notify(s, u, `Your DigiLocker verification expires in ${daysToExpiry(v)} days. Renew it in Hosting to stay listed.`, '/hosting');
    }
    // ---- merit tier (only while verified)
    if (vs !== 'verified') continue;
    const stats = localStats(s, u);
    const eligible = computeTier(stats);
    const ts = s.users[u].local.tierState;
    if (!ts) { s = patchLocal(s, u, { tierState: { current: eligible, since: now(), warning: null } }); continue; }
    const cur = TIERS[ts.current], el = TIERS[eligible];
    if (el.rank > cur.rank) {
      s = patchLocal(s, u, { tierState: { current: eligible, since: now(), warning: null } });
      s = notify(s, u, `🎉 You’re now a ${el.emoji} ${el.name}! Your maximum fee is now ₹${el.maxFee.toLocaleString('en-IN')}.`, '/hosting');
    } else if (el.rank < cur.rank) {
      if (stats.safety > 0) {
        s = patchLocal(s, u, { tierState: { current: eligible, since: now(), warning: null } });
        s = notify(s, u, `Your tier was reset to ${el.emoji} ${el.name} after a confirmed safety report.`, '/hosting');
      } else if (!ts.warning) {
        s = patchLocal(s, u, { tierState: { ...ts, warning: { to: eligible, at: now() } } });
        s = notify(s, u, `⚠️ You no longer meet the ${cur.name} requirements. You have ${GRACE_DAYS} days to get back on track before dropping to ${el.name}.`, '/hosting');
      } else if (Date.now() - new Date(ts.warning.at).getTime() >= GRACE_DAYS * DAY) {
        s = patchLocal(s, u, { tierState: { current: eligible, since: now(), warning: null } });
        s = notify(s, u, `Your tier changed to ${el.emoji} ${el.name}.`, '/hosting');
      } else if (ts.warning.to !== eligible) {
        s = patchLocal(s, u, { tierState: { ...ts, warning: { ...ts.warning, to: eligible } } });
      }
    } else if (ts.warning) {
      s = patchLocal(s, u, { tierState: { ...ts, warning: null } });
      s = notify(s, u, `✅ You’re back on track – you keep your ${cur.emoji} ${cur.name} tier.`, '/hosting');
    }
  }
  return s;
}

// ---------------------------------------------------------------- events
/** Static scraped events + any updates published by MIRAS (e.g. dates announced, tickets live). */
export const allEvents = (state) => EVENTS.map((e) => ({ ...e, ...(state.eventOverrides?.[e.id] || {}) }));
export const eventEnd = (e) => (e.start ? new Date(e.end || new Date(new Date(e.start).getTime() + 3 * 3600 * 1000)) : null);
export const isPastEvent = (e) => !!e.start && eventEnd(e) < new Date();
export const ticketsLive = (e) => e.status !== 'tba' && (!e.ticketsLiveAt || new Date(e.ticketsLiveAt) <= new Date());
export const eventLink = (e) => `/events?e=${e.id}`;

/** Fires due event reminders as notifications (tickets live / dates announced, and the day before). */
function syncEvents(state) {
  let s = state;
  const evs = allEvents(state);
  for (const r of state.eventReminders || []) {
    if (r.fired) continue;
    const e = evs.find((x) => x.id === r.eventId);
    if (!e) continue;
    let text = null;
    if (r.kind === 'tickets' && ticketsLive(e) && !isPastEvent(e)) {
      const when = e.start ? new Date(e.start).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
      text = ['free', 'at-venue'].includes(e.status)
        ? `📅 ${e.title} is on – ${when}${e.start ? `, ${new Date(e.start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''} at ${e.venue}.`
        : `🎟 Tickets for ${e.title} are live${when ? ` (${when})` : ''}. Book before they sell out!`;
    }
    if (r.kind === 'before' && e.start && new Date(e.start).getTime() - Date.now() <= 24 * 3600 * 1000 && !isPastEvent(e)) {
      text = `⏰ ${e.title} starts ${new Date(e.start).toDateString() === new Date().toDateString() ? 'today' : 'tomorrow'} at ${new Date(e.start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} – ${e.venue}.`;
    }
    if (text) {
      s = { ...s, eventReminders: s.eventReminders.map((x) => (x.id === r.id ? { ...x, fired: new Date().toISOString() } : x)) };
      s = notify(s, r.user, text, eventLink(e));
    }
  }
  return s;
}

const firstName = (state, u) => (state.users[u]?.name || u || '').split(' ')[0];
const sys = (g, text) => ({ ...g, messages: [...(g.messages || []), { id: uid('m'), kind: 'system', text, at: new Date().toISOString() }] });

function updateGroup(state, id, fn) {
  return { ...state, groups: state.groups.map((g) => (g.id === id ? fn(g) : g)) };
}

function reducer(state, a) {
  switch (a.type) {
    case 'reset': return freshState();
    case 'createAccount':
      return { ...state, me: a.user.username, users: { ...state.users, [a.user.username]: a.user } };
    case 'switchUser': return { ...state, me: a.username };
    case 'setSolo': return { ...state, soloMode: a.value };
    case 'updateProfile': {
      const before = state.users[state.me];
      let next = { ...state, users: { ...state.users, [state.me]: { ...before, ...a.patch } } };
      // a local who changes their name has to verify again
      if (a.patch.name && a.patch.name !== before.name && before.type === 'local' && before.local?.verification && verificationState(before.local.verification) !== 'none') {
        next = setVerif(next, state.me, { status: 'revoked', reason: 'Profile name changed – verify with DigiLocker again' }, 'system');
      }
      return next;
    }
    case 'syncTrust': return syncEvents(syncTrust(state));
    // ---------------- events
    case 'eventPref': {
      const mine = state.eventPrefs?.[state.me] || {};
      return { ...state, eventPrefs: { ...(state.eventPrefs || {}), [state.me]: { ...mine, [a.eventId]: { ...(mine[a.eventId] || {}), ...a.patch } } } };
    }
    case 'addEventReminder':
      if ((state.eventReminders || []).some((r) => r.user === state.me && r.eventId === a.eventId && r.kind === a.kind && !r.fired)) return state;
      return { ...state, eventReminders: [...(state.eventReminders || []), { id: uid('er'), user: state.me, eventId: a.eventId, kind: a.kind, createdAt: new Date().toISOString() }] };
    case 'removeEventReminder':
      return { ...state, eventReminders: state.eventReminders.filter((r) => r.id !== a.id) };
    case 'publishEventUpdate':
      return { ...state, eventOverrides: { ...(state.eventOverrides || {}), [a.eventId]: { ...(state.eventOverrides?.[a.eventId] || {}), ...a.patch } } };
    case 'shareEvent':
      return updateGroup(state, a.id, (g) => ({ ...g, messages: [...(g.messages || []), { id: uid('m'), kind: 'event', by: state.me, eventId: a.eventId, text: a.text || '', at: new Date().toISOString() }] }));
    case 'readNotices':
      return { ...state, notices: (state.notices || []).map((n) => (n.to === state.me ? { ...n, read: true } : n)) };
    // ---------------- verification lifecycle
    case 'setVerification':
      return patchLocal(state, state.me, { verification: { ...a.verification, history: [...(state.users[state.me].local?.verification?.history || []), { status: a.verification.status, reason: a.verification.status === 'review' ? 'Name on document didn’t match – manual review' : 'Verified with DigiLocker', at: now(), by: 'DigiLocker' }] } });
    case 'withdrawVerification':
      return setVerif(state, state.me, { status: 'revoked', reason: 'You withdrew DigiLocker consent' }, 'you');
    case 'adminSetStatus': {
      const v = state.users[a.username]?.local?.verification;
      if (!v) return state;
      const patch = { status: a.status, reason: a.reason || '' };
      let next = setVerif(state, a.username, patch, 'MIRAS admin');
      if (a.status === 'verified' && verificationState({ ...v, status: 'verified' }) === 'expired') next = setVerif(next, a.username, { status: 'verified', verifiedAt: now(), expiresAt: undefined }, 'MIRAS admin');
      if (a.status === 'verified' && v.status === 'review') next = notify(next, a.username, '✔ Your verification was approved after manual review.', '/hosting');
      if (a.status === 'revoked' && v.status === 'review') next = notify(next, a.username, `Your verification was not approved: ${a.reason}. Please verify again.`, '/hosting');
      if (a.status === 'verified' && v.status === 'suspended') next = notify(next, a.username, `✔ MIRAS restored your verified tag.${a.reason ? ` Note: ${a.reason}` : ''}`, '/hosting');
      return next;
    }
    case 'appeal':
      return { ...state, appeals: [{ id: uid('ap'), by: state.me, text: a.text, at: now(), status: 'open' }, ...(state.appeals || [])] };
    case 'resolveAppeal': {
      const ap = state.appeals.find((x) => x.id === a.id);
      let next = { ...state, appeals: state.appeals.map((x) => (x.id === a.id ? { ...x, status: a.restore ? 'restored' : 'rejected', resolution: a.note, resolvedAt: now() } : x)) };
      if (a.restore) next = setVerif(next, ap.by, { status: 'verified', reason: `Appeal accepted${a.note ? `: ${a.note}` : ''}` }, 'MIRAS admin');
      return notify(next, ap.by, a.restore ? `✔ Your appeal was accepted – your verified tag is back.${a.note ? ` ${a.note}` : ''}` : `Your appeal was rejected${a.note ? `: ${a.note}` : '.'}`, '/hosting');
    }
    // ---------------- reviews & reports
    case 'submitReview': {
      const r = { id: uid('rv'), at: now(), from: state.me, ...a.review };
      let next = { ...state, reviews: [r, ...(state.reviews || [])] };
      const unsafe = r.stars <= 2 || (r.cats?.Safety && r.cats.Safety <= 2) || r.noShow;
      if (unsafe) next = { ...next, reports: [{ id: uid('rp'), kind: 'flag', about: r.to, by: state.me, tripId: r.tripId, reviewId: r.id, text: r.noShow ? 'Reported a no-show' : `Low rating (${r.stars}★)${r.text ? `: ${r.text}` : ''}`, at: now(), status: 'open' }, ...(next.reports || [])] };
      if (a.safety) next = { ...next, reports: [{ id: uid('rp'), kind: 'safety', about: r.to, by: state.me, tripId: r.tripId, text: a.safety, at: now(), status: 'open' }, ...(next.reports || [])] };
      return notify(next, r.to, `${firstName(state, state.me)} reviewed your trip. It shows once you’ve reviewed them too, or when the review window closes.`, `/group/${r.tripId}`);
    }
    case 'editReview':
      return { ...state, reviews: state.reviews.map((r) => (r.id === a.id && r.from === state.me ? { ...r, ...a.patch, editedAt: now() } : r)) };
    case 'replyReview':
      return { ...state, reviews: state.reviews.map((r) => (r.id === a.id && r.to === state.me && !r.reply ? { ...r, reply: { text: a.text, at: now() } } : r)) };
    case 'reportReview': {
      const r = state.reviews.find((x) => x.id === a.id);
      return { ...state, reviews: state.reviews.map((x) => (x.id === a.id ? { ...x, reported: true } : x)), reports: [{ id: uid('rp'), kind: 'review', about: r.from, by: state.me, reviewId: r.id, text: a.text, at: now(), status: 'open' }, ...(state.reports || [])] };
    }
    case 'resolveReport': {
      const rp = state.reports.find((x) => x.id === a.id);
      let next = { ...state, reports: state.reports.map((x) => (x.id === a.id ? { ...x, status: a.confirm ? 'confirmed' : 'dismissed', resolvedAt: now() } : x)) };
      if (rp.kind === 'review' && a.confirm) next = { ...next, reviews: next.reviews.map((r) => (r.id === rp.reviewId ? { ...r, hidden: true } : r)) };
      return next;
    }
    case 'createGroup': return { ...state, groups: [a.group, ...state.groups] };
    // ---------------- Local Friends
    case 'acceptPrivacy':
      return { ...state, users: { ...state.users, [state.me]: { ...state.users[state.me], privacy: { version: a.version, acceptedAt: new Date().toISOString() } } } };
    case 'saveLocalProfile':
      return { ...state, users: { ...state.users, [state.me]: { ...state.users[state.me], type: 'local', style: 'Local friend', local: { rating: null, reviews: 0, hosted: 0, ...(state.users[state.me].local || {}), ...a.local } } } };
    case 'requestLocal':
      return { ...state, localRequests: [{ id: uid('lr'), status: 'pending', createdAt: new Date().toISOString(), by: state.me, ...a.request }, ...(state.localRequests || [])] };
    case 'cancelLocalRequest':
      return { ...state, localRequests: state.localRequests.filter((r) => r.id !== a.requestId) };
    case 'decideLocalRequest': {
      const r = state.localRequests.find((x) => x.id === a.requestId);
      if (!r || r.status !== 'pending') return state;
      let next = { ...state, localRequests: state.localRequests.map((x) => (x.id === r.id ? { ...x, status: a.accept ? 'accepted' : 'declined', reply: a.reply, decidedAt: new Date().toISOString() } : x)) };
      if (!a.accept) return next;
      const localName = firstName(state, r.local);
      if (r.groupId) {
        // join the existing group as its local friend
        next = updateGroup(next, r.groupId, (g) => sys({ ...g, localFriend: r.local }, `${localName} joined as your local friend 🤝`));
        if (a.reply) next = updateGroup(next, r.groupId, (g) => ({ ...g, messages: [...g.messages, { id: uid('m'), by: r.local, text: a.reply, at: new Date().toISOString() }] }));
        return { ...next, localRequests: next.localRequests.map((x) => (x.id === r.id ? { ...x, tripId: r.groupId } : x)) };
      }
      // solo traveller: create a private trip space for the two of them
      const id = uid('g');
      const now = new Date().toISOString();
      const trav = state.users[r.by];
      const group = {
        id, name: `${firstName(state, r.by)}’s Udaipur trip with ${localName}`, type: 'private', destination: 'Udaipur',
        startDate: r.startDate, endDate: r.endDate, description: r.message || 'Solo trip with a local friend.', vibe: ['Solo', 'Local friend'],
        maxMembers: 4, leader: r.by, members: [r.by], localFriend: r.local, requests: [], code: makeCode(), itinerary: [], suggestions: [], polls: [], createdAt: now, solo: true,
        messages: [
          { id: uid('m'), kind: 'system', text: `${localName} accepted ${trav?.name?.split(' ')[0]}’s request – say hello! 👋`, at: now },
          ...(a.reply ? [{ id: uid('m'), by: r.local, text: a.reply, at: now }] : []),
        ],
      };
      return { ...next, groups: [group, ...next.groups], localRequests: next.localRequests.map((x) => (x.id === r.id ? { ...x, tripId: id } : x)) };
    }
    case 'removeLocalFriend': {
      // a local who cancels an upcoming trip themselves – counts towards their cancellation rate
      const g0 = state.groups.find((x) => x.id === a.id);
      let st = state;
      if (a.self && g0 && g0.endDate >= todayStr()) st = patchLocal(st, g0.localFriend, { cancelled: (st.users[g0.localFriend].local?.cancelled || 0) + 1 });
      return updateGroup(st, a.id, (g) => sys({ ...g, localFriend: null }, a.self ? `${firstName(state, g.localFriend)} (local friend) left the group` : `${firstName(state, g.localFriend)} is no longer the local friend`));
    }
    case 'keepLocal':
      return updateGroup(state, a.id, (g) => sys({ ...g, localFlag: { ...g.localFlag, kept: true } }, `${firstName(state, g.leader)} chose to keep ${firstName(state, g.localFriend)} on this trip.`));
    case 'deleteGroup': return { ...state, groups: state.groups.filter((g) => g.id !== a.id) };
    case 'patchGroup': return updateGroup(state, a.id, (g) => ({ ...g, ...a.patch }));
    case 'addMember':
      return updateGroup(state, a.id, (g) => (g.members.includes(a.username) ? g : sys({
        ...g,
        members: [...g.members, a.username],
        requests: g.requests.filter((r) => r.username !== a.username),
      }, a.username === state.me && g.leader !== state.me ? `${firstName(state, a.username)} joined the group` : `${firstName(state, a.username)} was added by ${firstName(state, g.leader)}`)));
    case 'removeMember':
      return updateGroup(state, a.id, (g) => sys(
        { ...g, members: g.members.filter((m) => m !== a.username) },
        a.username === state.me ? `${firstName(state, a.username)} left the group` : `${firstName(state, a.username)} was removed`,
      ));
    case 'sendMessage':
      return updateGroup(state, a.id, (g) => ({ ...g, messages: [...(g.messages || []), { id: uid('m'), by: state.me, text: a.text, at: new Date().toISOString() }] }));
    case 'createPoll': {
      const pollId = uid('p');
      return updateGroup(state, a.id, (g) => ({
        ...g,
        polls: [...(g.polls || []), { id: pollId, by: state.me, question: a.question, multi: !!a.multi, closed: false, createdAt: new Date().toISOString(), options: a.options.map((t) => ({ id: uid('o'), text: t, votes: [] })) }],
        messages: [...(g.messages || []), { id: uid('m'), kind: 'poll', by: state.me, pollId, at: new Date().toISOString() }],
      }));
    }
    case 'vote':
      // single-choice polls move the vote; multi-choice polls toggle each option
      return updateGroup(state, a.id, (g) => ({
        ...g,
        polls: g.polls.map((p) => {
          if (p.id !== a.pollId || p.closed) return p;
          return {
            ...p,
            options: p.options.map((o) => {
              const has = o.votes.includes(state.me);
              if (o.id === a.optionId) return { ...o, votes: has ? o.votes.filter((v) => v !== state.me) : [...o.votes, state.me] };
              return p.multi ? o : { ...o, votes: o.votes.filter((v) => v !== state.me) };
            }),
          };
        }),
      }));
    case 'closePoll':
      return updateGroup(state, a.id, (g) => {
        const p = g.polls.find((x) => x.id === a.pollId);
        const top = p ? [...p.options].sort((x, y) => y.votes.length - x.votes.length)[0] : null;
        return sys(
          { ...g, polls: g.polls.map((x) => (x.id === a.pollId ? { ...x, closed: true } : x)) },
          `Poll closed: “${p?.question}”${top && top.votes.length ? ` – winner: ${top.text}` : ''}`,
        );
      });
    case 'request':
      return updateGroup(state, a.id, (g) => ({
        ...g,
        requests: [...g.requests.filter((r) => r.username !== a.username), { username: a.username, message: a.message, at: new Date().toISOString() }],
      }));
    case 'cancelRequest':
    case 'rejectRequest':
      return updateGroup(state, a.id, (g) => ({ ...g, requests: g.requests.filter((r) => r.username !== a.username) }));
    case 'addItem':
      return updateGroup(state, a.id, (g) => ({ ...g, itinerary: [...g.itinerary, { ...a.item, id: uid('i') }] }));
    case 'editItem':
      return updateGroup(state, a.id, (g) => ({ ...g, itinerary: g.itinerary.map((it) => (it.id === a.itemId ? { ...it, ...a.patch } : it)) }));
    case 'removeItem':
      return updateGroup(state, a.id, (g) => ({ ...g, itinerary: g.itinerary.filter((it) => it.id !== a.itemId) }));
    case 'suggest':
      return updateGroup(state, a.id, (g) => ({
        ...g,
        suggestions: [{ ...a.suggestion, id: uid('s'), status: 'pending', createdAt: new Date().toISOString() }, ...g.suggestions],
      }));
    case 'decide': {
      // Accept (and apply to the itinerary) or reject a suggestion, always with the leader's comment
      return updateGroup(state, a.id, (g) => {
        const s = g.suggestions.find((x) => x.id === a.suggestionId);
        if (!s || s.status !== 'pending') return g;
        let itinerary = g.itinerary;
        if (a.accept) {
          if (s.kind === 'add') itinerary = [...itinerary, { ...s.proposed, id: uid('i') }];
          if (s.kind === 'edit') itinerary = itinerary.map((it) => (it.id === s.targetId ? { ...it, ...s.proposed } : it));
          if (s.kind === 'remove') itinerary = itinerary.filter((it) => it.id !== s.targetId);
        }
        return sys({
          ...g,
          itinerary,
          suggestions: g.suggestions.map((x) => (x.id === s.id
            ? { ...x, status: a.accept ? 'accepted' : 'rejected', decisionComment: a.comment, decidedAt: new Date().toISOString() }
            : x)),
        }, `${firstName(state, g.leader)} ${a.accept ? 'accepted' : 'rejected'} ${firstName(state, s.by)}’s suggestion`);
      });
    }
    default: return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    dispatch({ type: 'syncTrust' }); // no-op unless a trust rule changes something
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  const { state, dispatch } = ctx;
  const me = state.me ? state.users[state.me] : null;
  const userByName = useCallback((u) => state.users[u], [state.users]);
  return { state, dispatch, me, userByName, uid, isVerified };
}

/** Role of the current user in a group: leader | local | member | requested | none */
export function roleIn(group, username) {
  if (!username) return 'none';
  if (group.leader === username) return 'leader';
  if (group.localFriend === username) return 'local';
  if (group.members.includes(username)) return 'member';
  if (group.requests.some((r) => r.username === username)) return 'requested';
  return 'none';
}
