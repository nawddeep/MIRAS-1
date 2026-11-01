import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Avatar, Badge, Empty, fmtRange, Modal, priceLabel, timeAgo, UserLine, useToast } from './ui.jsx';
import { DigiLockerVerify, PrivacyLink, VerifiedBadge } from './Trust.jsx';
import { GuestRating, LocalReviews, RateTripCard, RatingLine, TierBadge, TierProgress, VerificationPanel } from './Reviews.jsx';
import { displayTier, feeCap, findReview, isVerified, localStats, reviewWindowOpen, TIERS, tripEnded, verificationState } from '../trust.js';

export const EXPERTISE = ['Street food', 'Old city walks', 'History', 'Palaces & forts', 'Lakes & ghats', 'Photography', 'Sunrise & sunsets',
  'Treks & cycling', 'Art & crafts', 'Shopping', 'Nightlife', 'Hidden cafés', 'Boat rides', 'Workshops', 'Royal stories', 'Aravalli hills'];
export const LANGUAGES = ['Hindi', 'English', 'Mewari', 'Marwari', 'Gujarati', 'Urdu', 'French', 'German', 'Spanish'];


// ---------------------------------------------------------------- local profile editor (onboarding + hosting)
export function LocalProfileFields({ value, onChange, name, maxFee = TIERS.new.maxFee, hideVerification }) {
  const v = { area: '', languages: ['Hindi', 'English'], expertise: [], about: '', years: '', verification: null, ...value, pricing: { amount: 1000, unit: 'day', ...(value?.pricing || {}), mode: 'paid' } };
  const set = (patch) => onChange({ ...v, ...patch });
  const toggle = (k, item) => set({ [k]: v[k].includes(item) ? v[k].filter((x) => x !== item) : [...v[k], item] });
  return (
    <div className="form">
      {!hideVerification && <DigiLockerVerify value={v.verification} name={name} onChange={(verification) => set({ verification })} />}
      <div className="row2">
        <label>Your area in Udaipur<input value={v.area} onChange={(e) => set({ area: e.target.value })} placeholder="e.g. Gangaur Ghat, Old City" /></label>
        <label>Years in Udaipur<input type="number" min="0" value={v.years} onChange={(e) => set({ years: e.target.value })} placeholder="e.g. 25" /></label>
      </div>
      <div><span className="label">Languages you speak</span>
        <div className="tags pick">{LANGUAGES.map((l) => <button type="button" key={l} className={`tag ${v.languages.includes(l) ? 'on' : ''}`} onClick={() => toggle('languages', l)}>{l}</button>)}</div>
      </div>
      <div><span className="label">What do you love showing people? <span className="muted">(pick a few)</span></span>
        <div className="tags pick">{EXPERTISE.map((x) => <button type="button" key={x} className={`tag ${v.expertise.includes(x) ? 'on' : ''}`} onClick={() => toggle('expertise', x)}>{x}</button>)}</div>
      </div>
      <label>About you<textarea rows="3" value={v.about} onChange={(e) => set({ about: e.target.value })} placeholder="What makes your Udaipur special? Where would you take a friend?" /></label>
      <div>
        <span className="label">Your fee <span className="muted">– Local Friends are a paid service; you set the price</span></span>
        <div className="row2 price-row">
          <label>Fee (₹) <span className="muted">max ₹{maxFee.toLocaleString('en-IN')} for your tier</span><input type="number" min="100" max={maxFee} step="50" value={v.pricing.amount} onChange={(e) => set({ pricing: { ...v.pricing, mode: 'paid', amount: +e.target.value } })} /></label>
          <label>Per<select value={v.pricing.unit} onChange={(e) => set({ pricing: { ...v.pricing, mode: 'paid', unit: e.target.value } })}>
            <option value="day">day</option><option value="half-day">half-day</option><option value="trip">whole trip</option>
          </select></label>
        </div>
        {v.pricing.amount > 0 && v.pricing.amount < 100 && <small className="err">Minimum fee is ₹100.</small>}
        {v.pricing.amount > maxFee && <small className="err">Your tier allows up to ₹{maxFee.toLocaleString('en-IN')}. Earn a higher tier to charge more.</small>}
      </div>
    </div>
  );
}
const verifOk = (v) => ['verified', 'review'].includes(verificationState(v));
export const localProfileValid = (l, { cap = TIERS.new.maxFee, needVerification = true } = {}) => !!(l && (!needVerification || verifOk(l.verification)) && l.area?.trim() && l.expertise?.length && l.languages?.length && l.pricing?.amount >= 100 && l.pricing.amount <= cap);
/** What is still missing, for a helpful hint under the button. */
export const localProfileMissing = (l, { cap = TIERS.new.maxFee, needVerification = true } = {}) => [
  needVerification && !verifOk(l?.verification) && 'DigiLocker verification',
  l?.pricing?.amount > cap && `a fee within your tier limit (₹${cap.toLocaleString('en-IN')})`,
  !l?.area?.trim() && 'your area',
  !l?.languages?.length && 'languages',
  !l?.expertise?.length && 'what you love showing',
  !(l?.pricing?.amount >= 100) && 'your fee (min ₹100)',
].filter(Boolean);

// ---------------------------------------------------------------- directory card
function LocalCard({ u, onOpen }) {
  const { state } = useStore();
  const l = u.local || {};
  const st = localStats(state, u.username);
  return (
    <article className="lcard" onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="lcard-top">
        <Avatar user={u} size={56} />
        <div>
          <h3>{u.name} <VerifiedBadge v={l.verification} compact /></h3>
          <p className="muted small">📍 {l.area || 'Udaipur'} · {l.years ? `${l.years} yrs in Udaipur` : 'Udaipurite'}</p>
          <p className="small"><RatingLine stats={st} /> <span className="muted">· {st.trips} trips</span></p>
          <TierBadge u={u} compact />
        </div>
        <span className="price">{priceLabel(l.pricing)}</span>
      </div>
      <p className="lcard-about">{l.about}</p>
      <div className="tags">{(l.expertise || []).slice(0, 4).map((x) => <span key={x} className="tag">{x}</span>)}</div>
      <p className="muted small">🗣 {(l.languages || []).join(', ')}</p>
    </article>
  );
}

// ---------------------------------------------------------------- request modal
function RequestModal({ local, presetGroup, onClose, go }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const myLedGroups = state.groups.filter((g) => g.leader === state.me && !g.localFriend);
  const [target, setTarget] = useState(presetGroup || 'solo');
  const g = state.groups.find((x) => x.id === target);
  const today = new Date().toISOString().slice(0, 10);
  const [dates, setDates] = useState({ startDate: g?.startDate || today, endDate: g?.endDate || today });
  const [msg, setMsg] = useState('');
  const l = local.local || {};
  const submit = (e) => {
    e.preventDefault();
    dispatch({ type: 'requestLocal', request: { local: local.username, groupId: target === 'solo' ? null : target, startDate: dates.startDate, endDate: dates.endDate, message: msg.trim(), pricing: l.pricing } });
    toast(`Request sent to ${local.name.split(' ')[0]}`);
    onClose();
    go('/locals?tab=requests');
  };
  return (
    <Modal title={`Ask ${local.name.split(' ')[0]} to be your local friend`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>For
          <select value={target} onChange={(e) => { setTarget(e.target.value); const gg = state.groups.find((x) => x.id === e.target.value); if (gg) setDates({ startDate: gg.startDate, endDate: gg.endDate }); }}>
            <option value="solo">Just me – solo trip</option>
            {myLedGroups.map((gg) => <option key={gg.id} value={gg.id}>My group: {gg.name}</option>)}
          </select>
        </label>
        {target !== 'solo' && <p className="muted small">If {local.name.split(' ')[0]} accepts, they join this group’s chat and can suggest itinerary changes.</p>}
        {target === 'solo' && <p className="muted small">If accepted, a private trip space with chat and itinerary is created for the two of you.</p>}
        <div className="row2">
          <label>From<input type="date" value={dates.startDate} onChange={(e) => setDates((d) => ({ ...d, startDate: e.target.value }))} /></label>
          <label>To<input type="date" min={dates.startDate} value={dates.endDate} onChange={(e) => setDates((d) => ({ ...d, endDate: e.target.value }))} /></label>
        </div>
        <label>Message<textarea rows="3" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Say hi – what are you hoping to see or do?" /></label>
        <div className="pricebox">
          <span>Fee: {priceLabel(l.pricing)}</span>
          <span className="muted small">Agree the details in chat and pay the local directly – MIRAS doesn’t handle payments in this prototype.</span>
        </div>
        <p className="muted small privacy-note">🔒 {local.name.split(' ')[0]} will see your name, home city, trip dates{target !== 'solo' ? ', group size' : ''} and this message. Your phone number and email are never shared. <PrivacyLink>Privacy policy</PrivacyLink></p>
        <button className="btn primary block" disabled={dates.endDate < dates.startDate}>Send request</button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- local profile modal
function LocalProfileModal({ u, onClose, onRequest, existing }) {
  const l = u.local || {};
  return (
    <Modal title="Local friend" onClose={onClose}>
      <div className="lprofile">
        <Avatar user={u} size={72} />
        <h2>{u.name}</h2>
        <p className="muted">@{u.username} · 📍 {l.area}</p>
        <div className="badges-row"><VerifiedBadge v={l.verification} /><TierBadge u={u} /></div>
        <span className="price big">{priceLabel(l.pricing)}</span>
      </div>
      <p>{l.about}</p>
      <div><span className="label">Loves showing</span><div className="tags">{(l.expertise || []).map((x) => <span key={x} className="tag">{x}</span>)}</div></div>
      <p className="small"><strong>Speaks:</strong> {(l.languages || []).join(', ')}{l.years ? ` · ${l.years} years in Udaipur` : ''}</p>
      <div className="explain">
        <strong>What a local friend does</strong>
        <ul>
          <li>Helps you explore Udaipur like a local</li>
          <li>Joins your group chat to plan the trip</li>
          <li>Suggests itinerary stops – you accept or reject</li>
          <li>Identity verified with DigiLocker – you only see the badge, never their documents</li>
        </ul>
      </div>
      <div><span className="label">Reviews</span><LocalReviews username={u.username} limit={3} /></div>
      {existing ? <div className="notice">{existing.status === 'pending' ? '⏳ Request sent – waiting for a reply.' : existing.status === 'accepted' ? '✅ Accepted – see your trip in My groups.' : 'Your last request was declined.'}</div> : null}
      <button className="btn primary block" onClick={onRequest} disabled={existing?.status === 'pending'}>🤝 Request as local friend</button>
    </Modal>
  );
}

// ---------------------------------------------------------------- directory page (travellers)
export function LocalFriends({ go, query }) {
  const { state, dispatch, userByName } = useStore();
  const toast = useToast();
  const params = new URLSearchParams(query || '');
  const forGroup = params.get('for');
  const [tab, setTab] = useState(params.get('tab') === 'requests' ? 'requests' : 'browse');
  const [q, setQ] = useState('');
  const [price, setPrice] = useState('all');
  const [topic, setTopic] = useState('All');
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [open, setOpen] = useState(null);
  const [asking, setAsking] = useState(null);
  const locals = Object.values(state.users).filter((u) => u.type === 'local' && u.username !== state.me);
  const topics = ['All', ...new Set(locals.flatMap((u) => u.local?.expertise || []))].slice(0, 12);
  const list = useMemo(() => locals.filter((u) => {
    const l = u.local || {};
    if (!isVerified(u)) return false; // only locals with a valid DigiLocker verification are listed
    if (trustedOnly && TIERS[displayTier(u)].rank < 1) return false;
    if (price === 'low' && !(l.pricing?.amount < 1000)) return false;
    if (price === 'high' && !(l.pricing?.amount >= 1000)) return false;
    if (topic !== 'All' && !(l.expertise || []).includes(topic)) return false;
    return `${u.name} ${l.area} ${l.about} ${(l.expertise || []).join(' ')} ${(l.languages || []).join(' ')}`.toLowerCase().includes(q.toLowerCase());
  }).map((u) => ({ u, st: localStats(state, u.username), rank: TIERS[displayTier(u)].rank }))
    .sort((a, b) => (sort === 'price' ? a.u.local.pricing.amount - b.u.local.pricing.amount
      : sort === 'rating' ? b.st.adjusted - a.st.adjusted
        : b.rank - a.rank || b.st.adjusted - a.st.adjusted)) // recommended: higher tiers first
    .map((x) => x.u), [locals, price, topic, q, trustedOnly, sort, state]);
  const mine = (state.localRequests || []).filter((r) => r.by === state.me);
  const latestTo = (u) => mine.find((r) => r.local === u);
  const forG = forGroup && state.groups.find((g) => g.id === forGroup);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Local friends</h1>
          <p className="muted">Verified Udaipurites who show you their city for a fee they set. They join your chat, suggest plans and help you explore.</p>
        </div>
      </div>
      {forG && <div className="notice">Choosing a local friend for <strong>{forG.name}</strong>.</div>}
      <nav className="tabs" role="tablist">
        <button className={tab === 'browse' ? 'on' : ''} onClick={() => setTab('browse')}>Find a local</button>
        <button className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>My requests{mine.filter((r) => r.status === 'pending').length ? <span className="count">{mine.filter((r) => r.status === 'pending').length}</span> : null}</button>
      </nav>

      {tab === 'browse' && (
        <>
          <div className="filters">
            <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search food, history, photography, language…" />
            <div className="seg">{[['all', 'Any price'], ['low', 'Under ₹1,000'], ['high', '₹1,000+']].map(([k, t]) => <button key={k} className={price === k ? 'on' : ''} onClick={() => setPrice(k)}>{t}</button>)}</div>
          </div>
          <div className="filters2">
            <label className="check"><input type="checkbox" checked={trustedOnly} onChange={(e) => setTrustedOnly(e.target.checked)} /> ⭐ Trusted & above only</label>
            <label className="sort">Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">Recommended (tier, then rating)</option>
                <option value="rating">Top rated</option>
                <option value="price">Price: low to high</option>
              </select>
            </label>
          </div>
          <div className="tags pick topics">{topics.map((t) => <button key={t} className={`tag ${topic === t ? 'on' : ''}`} onClick={() => setTopic(t)}>{t}</button>)}</div>
          {list.length === 0 && <Empty title="No locals match">Try another filter.</Empty>}
          <div className="grid">{list.map((u) => <LocalCard key={u.username} u={u} onOpen={() => setOpen(u)} />)}</div>
        </>
      )}

      {tab === 'requests' && (
        <section className="panel">
          {mine.length === 0 && <Empty title="No requests yet">Find a local friend and send a request.</Empty>}
          {mine.map((r) => {
            const lu = userByName(r.local);
            const g = r.groupId && state.groups.find((x) => x.id === r.groupId);
            return (
              <article key={r.id} className="card req-card">
                <div className="sugg-head">
                  <UserLine user={lu} sub={`${priceLabel(lu?.local?.pricing)} · sent ${timeAgo(r.createdAt)}`} />
                  <Badge tone={r.status === 'pending' ? 'amber' : r.status === 'accepted' ? 'green' : 'red'}>{r.status}</Badge>
                </div>
                <p className="small"><strong>For:</strong> {g ? g.name : 'Solo trip'} · {fmtRange(r.startDate, r.endDate)}</p>
                {r.message && <p className="quote">“{r.message}”</p>}
                {r.reply && <div className={`decision ${r.status === 'accepted' ? 'accepted' : 'rejected'}`}><Avatar user={lu} size={24} /><p>{r.reply}</p></div>}
                <div className="btnrow">
                  {r.status === 'pending' && <button className="btn ghost sm" onClick={() => { dispatch({ type: 'cancelLocalRequest', requestId: r.id }); toast('Request cancelled'); }}>Cancel request</button>}
                  {r.status === 'accepted' && r.tripId && <button className="btn primary sm" onClick={() => go(`/group/${r.tripId}`)}>Open trip chat</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {open && !asking && <LocalProfileModal u={open} existing={latestTo(open.username)} onClose={() => setOpen(null)} onRequest={() => setAsking(open)} />}
      {asking && <RequestModal local={asking} presetGroup={forGroup && state.groups.find((g) => g.id === forGroup && g.leader === state.me && !g.localFriend) ? forGroup : undefined} go={go} onClose={() => { setAsking(null); setOpen(null); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- hosting dashboard (locals)
export function Hosting({ go }) {
  const { state, me, dispatch, userByName } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('requests');
  const [deciding, setDeciding] = useState(null);
  const [reply, setReply] = useState('');
  const [draft, setDraft] = useState(me?.local || {});
  const cap = feeCap(me);
  const stHost = localStats(state, state.me);
  const toRate = state.groups.filter((g) => g.localFriend === state.me && reviewWindowOpen(g) && g.members.some((m) => !findReview(state, g.id, state.me, m))).length;
  const incoming = (state.localRequests || []).filter((r) => r.local === state.me);
  const pending = incoming.filter((r) => r.status === 'pending');
  const trips = state.groups.filter((g) => g.localFriend === state.me);
  const l = me?.local || {};
  return (
    <div className="page">
      <div className="page-head">
        <div className="welcome" style={{ margin: 0 }}>
          <Avatar user={me} size={56} />
          <div>
            <h1>Hosting · {me?.name?.split(' ')[0]}</h1>
            <p className="muted host-meta">🤝 Local friend · 📍 {l.area || 'Udaipur'} · <span className="price">{priceLabel(l.pricing)}</span> <VerifiedBadge v={l.verification} /> <TierBadge u={me} /> <RatingLine stats={stHost} /></p>
          </div>
        </div>
      </div>
      <nav className="tabs" role="tablist">
        <button className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>Requests{pending.length ? <span className="count">{pending.length}</span> : null}</button>
        <button className={tab === 'trips' ? 'on' : ''} onClick={() => setTab('trips')}>My trips{trips.length ? <span className="count">{trips.length}</span> : null}</button>
        <button className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>Reviews & tier{toRate ? <span className="count">{toRate}</span> : null}</button>
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>Profile & verification</button>
      </nav>
      {!isVerified(me) && tab !== 'profile' && <div className="notice warn">You’re hidden from the Local Friends directory – {verificationState(l.verification) === 'suspended' ? 'your verified tag is suspended' : 'your DigiLocker verification isn’t valid'}. <button className="link" onClick={() => setTab('profile')}>See details</button></div>}

      {tab === 'requests' && (
        <section className="panel">
          {incoming.length === 0 && <Empty title="No requests yet">Travellers will find you in the Local Friends directory.</Empty>}
          {[...incoming].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1)).map((r) => {
            const tu = userByName(r.by);
            const g = r.groupId && state.groups.find((x) => x.id === r.groupId);
            return (
              <article key={r.id} className="card req-card">
                <div className="sugg-head">
                  <UserLine user={tu} sub={<>{tu?.city || ''} · {timeAgo(r.createdAt)} · <GuestRating username={r.by} /></>} />
                  <Badge tone={r.status === 'pending' ? 'amber' : r.status === 'accepted' ? 'green' : 'red'}>{r.status}</Badge>
                </div>
                <p className="small"><strong>{g ? `Group: ${g.name} (${g.members.length} travellers)` : 'Solo traveller'}</strong> · {fmtRange(r.startDate, r.endDate)} · {priceLabel(l.pricing)}</p>
                {r.message && <p className="quote">“{r.message}”</p>}
                {r.reply && <p className="small muted">Your reply: {r.reply}</p>}
                <div className="btnrow">
                  {r.status === 'pending' && <>
                    <button className="btn primary sm" onClick={() => { setReply(''); setDeciding({ r, accept: true }); }}>Accept</button>
                    <button className="btn ghost sm" onClick={() => { setReply(''); setDeciding({ r, accept: false }); }}>Decline</button>
                  </>}
                  {r.status === 'accepted' && r.tripId && <button className="btn ghost sm" onClick={() => go(`/group/${r.tripId}`)}>Open trip chat</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'trips' && (
        <section className="panel">
          {trips.length === 0 && <Empty title="No trips yet">Accept a request and the group’s chat and itinerary will appear here.</Empty>}
          {trips.map((g) => (
            <article key={g.id} className="card trip-row" onClick={() => go(`/group/${g.id}`)}>
              <div>
                <strong>{g.name}</strong>
                <p className="muted small">{fmtRange(g.startDate, g.endDate)} · {g.members.length} traveller{g.members.length > 1 ? 's' : ''} · led by {userByName(g.leader)?.name}</p>
              </div>
              <div className="btnrow">
                {tripEnded(g)
                  ? <span className="small muted">{reviewWindowOpen(g) && g.members.some((m) => !findReview(state, g.id, state.me, m)) ? '⭐ Rate your guests' : 'Trip finished'}</span>
                  : <span className="small muted">{g.suggestions.filter((s) => s.by === state.me && s.status === 'pending').length} tips pending</span>}
                <button className="btn primary sm">Open</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'reviews' && (
        <section className="panel">
          <TierProgress username={state.me} />
          {trips.filter((g) => reviewWindowOpen(g)).map((g) => <div key={g.id}><p className="small muted">{g.name}</p><RateTripCard g={g} /></div>)}
          <section className="card"><h3>What travellers say about you</h3><LocalReviews username={state.me} limit={6} /></section>
        </section>
      )}

      {tab === 'profile' && (
        <section className="card">
          <VerificationPanel />
          <LocalProfileFields value={draft} onChange={setDraft} name={me?.name} maxFee={cap} hideVerification />
          {!localProfileValid(draft, { cap, needVerification: false }) && <p className="err small">Still needed: {localProfileMissing(draft, { cap, needVerification: false }).join(', ')}.</p>}
          <button className="btn primary block" disabled={!localProfileValid(draft, { cap, needVerification: false })} onClick={() => { const { area, years, languages, expertise, about } = draft; dispatch({ type: 'saveLocalProfile', local: { area, years, languages, expertise, about, pricing: { ...draft.pricing, mode: 'paid' } } }); toast('Local profile saved'); }}>Save profile</button>
          <p className="muted small center">🔒 Tourists see your public profile and a “DigiLocker verified” badge – never your documents or phone number. <PrivacyLink>Privacy policy</PrivacyLink></p>
        </section>
      )}

      {deciding && (
        <Modal title={deciding.accept ? 'Accept request' : 'Decline request'} onClose={() => setDeciding(null)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: 'decideLocalRequest', requestId: deciding.r.id, accept: deciding.accept, reply: reply.trim() });
            toast(deciding.accept ? 'Accepted – you’re now in their trip chat' : 'Request declined');
            setDeciding(null);
            if (deciding.accept) setTab('trips');
          }}>
            {deciding.accept && <p className="muted small">🔒 You’ll join the trip chat and see its itinerary. Keep conversations in MIRAS; share your phone number only if you want to. <PrivacyLink>Privacy policy</PrivacyLink></p>}
            <label>{deciding.accept ? 'Say hello (posted in their trip chat)' : 'Message (optional)'}
              <textarea rows="3" value={reply} onChange={(e) => setReply(e.target.value)} autoFocus placeholder={deciding.accept ? 'Namaste! So happy to show you my Udaipur…' : 'Sorry, I’m not free on those dates.'} />
            </label>
            <button className={`btn block ${deciding.accept ? 'primary' : 'danger'}`}>{deciding.accept ? 'Accept & join trip' : 'Decline'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
