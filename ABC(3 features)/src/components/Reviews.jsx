import { useState } from 'react';
import { useStore } from '../store.jsx';
import { Avatar, Modal, timeAgo, useToast } from './ui.jsx';
import { DigiLockerFlow } from './Trust.jsx';
import {
  canEdit, daysToExpiry, displayTier, EDIT_HOURS, expiresAt, findReview, GRACE_DAYS, guestStats, isRevealed, L2T_CATS, L2T_TAGS, localStats,
  monthLabel, reviewDeadline, reviewTargets, reviewWindowOpen, STATUS_LABEL, T2L_CATS, T2L_TAGS, TIER_ORDER, tierChecks, TIERS, tripEnded, verificationState,
} from '../trust.js';

const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ---------------------------------------------------------------- stars
export function Stars({ value, size = 14 }) {
  const v = Math.round((value || 0) * 2) / 2;
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${(value || 0).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= v ? 'on' : i - 0.5 === v ? 'half' : ''}>★</span>)}
    </span>
  );
}
function StarInput({ value, onChange, label, small }) {
  return (
    <div className={`star-input ${small ? 'small' : ''}`} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} className={i <= value ? 'on' : ''} onClick={() => onChange(i === value && small ? 0 : i)}>★</button>
      ))}
    </div>
  );
}
/** "★ 4.8 (52)" or "New – no reviews yet" (fewer than 3 reviews). */
export function RatingLine({ stats, guest }) {
  if (!stats.count && !stats.reviews) return <span className="muted small">{guest ? 'No ratings from locals yet' : '✨ New – no reviews yet'}</span>;
  const count = stats.count ?? stats.reviews;
  const avg = stats.avg ?? stats.rating;
  if (count < 3 && !guest) return <span className="muted small">✨ New – {count} review{count > 1 ? 's' : ''} so far</span>;
  return <span className="rating">★ {avg.toFixed(1)} <span className="muted small">({count})</span></span>;
}

// ---------------------------------------------------------------- tier badge
export function TierBadge({ u, compact }) {
  const [open, setOpen] = useState(false);
  const t = displayTier(u);
  if (!t) return null;
  const T = TIERS[t];
  return (
    <>
      <button type="button" className={`tier tier-${t}`} title={`${T.name}: ${T.blurb}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {T.emoji} {compact ? T.short : T.name}
      </button>
      {open && (
        <Modal title="Local Friend tiers" onClose={() => setOpen(false)}>
          <p className="muted small">Tiers are earned from completed trips, ratings, reliability and behaviour – and recalculated after every trip and review. Every tier also needs a valid DigiLocker verification.</p>
          <div className="tier-list">
            {TIER_ORDER.map((id) => (
              <div key={id} className={`tier-row ${id === t ? 'on' : ''}`}>
                <span className={`tier tier-${id}`}>{TIERS[id].emoji} {TIERS[id].name}</span>
                <p className="small">{TIERS[id].blurb}</p>
              </div>
            ))}
          </div>
          <p className="muted small">Drops happen after a {GRACE_DAYS}-day grace period – except a confirmed safety report, which resets the tier straight away.</p>
        </Modal>
      )}
    </>
  );
}

/** Traveller rating – only rendered for locals (and for the traveller themselves). */
export function GuestRating({ username, showTags }) {
  const { state } = useStore();
  const g = guestStats(state, username);
  return (
    <span className="guest-rating">
      {g.count ? <>★ {g.avg.toFixed(1)} <span className="muted">from {g.count} local{g.count > 1 ? 's' : ''}</span></> : <span className="muted">No ratings from locals yet</span>}
      {g.goodGuest && <span className="good-guest">🏡 Good guest</span>}
      {showTags && g.tags.length > 0 && <span className="muted"> · {g.tags.join(', ')}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- review form
export function ReviewModal({ g, to, dir, existing, onClose }) {
  const { dispatch, userByName } = useStore();
  const toast = useToast();
  const target = userByName(to);
  const CATS = dir === 't2l' ? T2L_CATS : L2T_CATS;
  const TAGS = dir === 't2l' ? T2L_TAGS : L2T_TAGS;
  const [stars, setStars] = useState(existing?.stars || 0);
  const [cats, setCats] = useState(existing?.cats || {});
  const [tags, setTags] = useState(existing?.tags || []);
  const [text, setText] = useState(existing?.text || '');
  const [noShow, setNoShow] = useState(!!existing?.noShow);
  const [safetyOn, setSafetyOn] = useState(false);
  const [safety, setSafety] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!stars) return;
    const clean = Object.fromEntries(Object.entries(cats).filter(([, v]) => v));
    const review = { tripId: g.id, to, dir, stars, cats: clean, tags, text: text.trim(), noShow: dir === 't2l' && noShow, tripEnd: g.endDate };
    if (existing) { dispatch({ type: 'editReview', id: existing.id, patch: review }); toast('Review updated'); }
    else {
      dispatch({ type: 'submitReview', review, safety: safetyOn && safety.trim() ? safety.trim() : null });
      toast(safetyOn && safety.trim() ? 'Review saved – your safety report went privately to MIRAS' : 'Thanks! Your review is saved');
    }
    onClose();
  };
  return (
    <Modal title={existing ? 'Edit your review' : `Rate ${target?.name?.split(' ')[0]}`} onClose={onClose}>
      <form className="form review-form" onSubmit={submit}>
        <div className="review-who"><Avatar user={target} size={40} /><div><strong>{target?.name}</strong><span className="muted small">{dir === 't2l' ? 'Your Local Friend' : 'Your guest'} · {g.name}</span></div></div>
        <div><span className="label">Overall</span><StarInput value={stars} onChange={setStars} label="Overall rating" /></div>
        <div className="cat-grid">
          <span className="label">Details <span className="muted">(optional)</span></span>
          {CATS.map((c) => (
            <div key={c} className="cat-row"><span className="small">{c}</span><StarInput small value={cats[c] || 0} onChange={(v) => setCats((x) => ({ ...x, [c]: v }))} label={c} /></div>
          ))}
        </div>
        <div><span className="label">Quick tags</span>
          <div className="tags pick">{TAGS.map((t) => <button type="button" key={t} className={`tag ${tags.includes(t) ? 'on' : ''}`} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</button>)}</div>
        </div>
        <label>Your review<textarea rows="3" value={text} onChange={(e) => setText(e.target.value)} placeholder={dir === 't2l' ? 'What made the trip special? Anything to improve?' : 'How was it hosting them?'} /></label>
        {dir === 't2l' && <label className="check"><input type="checkbox" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} /> {target?.name?.split(' ')[0]} didn’t show up</label>}
        {!existing && (
          <div className="safety-box">
            <label className="check"><input type="checkbox" checked={safetyOn} onChange={(e) => setSafetyOn(e.target.checked)} /> Report a safety concern <span className="muted">(private – only MIRAS sees this)</span></label>
            {safetyOn && <textarea rows="2" value={safety} onChange={(e) => setSafety(e.target.value)} placeholder="What happened? MIRAS will look into it." />}
          </div>
        )}
        <p className="muted small">{dir === 't2l'
          ? 'Shown publicly on their profile with your first name and trip month.'
          : 'Visible to other Local Friends only – it helps them decide on requests. Never shown publicly.'} Reviews stay hidden until you both have reviewed, or the window closes. You can edit for {EDIT_HOURS} hours.</p>
        <button className="btn primary block" disabled={!stars}>{existing ? 'Save changes' : 'Submit review'}</button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- "rate your trip" card on finished trips
export function RateTripCard({ g }) {
  const { state, userByName } = useStore();
  const [writing, setWriting] = useState(null);
  const targets = reviewTargets(g, state.me);
  if (!targets.length || !tripEnded(g)) return null;
  const open = reviewWindowOpen(g);
  const deadline = fmtDay(reviewDeadline(g));
  const mine = targets.map((t) => ({ ...t, mine: findReview(state, g.id, state.me, t.to), theirs: findReview(state, g.id, t.to, state.me) }));
  if (!open && mine.every((m) => !m.mine && !m.theirs)) return null;
  return (
    <section className="card rate-card">
      <div className="rate-head">
        <strong>⭐ {open ? 'Rate your trip' : 'Trip reviews'}</strong>
        <span className="muted small">{open ? `Reviews close on ${deadline}` : 'Review window closed'}</span>
      </div>
      {mine.map(({ to, dir, mine: r, theirs }) => {
        const u = userByName(to);
        return (
          <div key={to} className="rate-row">
            <Avatar user={u} size={32} />
            <div className="rate-mid">
              <strong>{u?.name}</strong>
              <span className="muted small">
                {r ? `✓ You rated ${r.stars}★${r.editedAt ? ' (edited)' : ''}` : open ? 'Not rated yet' : 'You didn’t leave a review'}
                {theirs && !r && open && ` · ${u?.name?.split(' ')[0]} has reviewed you – submit yours to see it`}
                {theirs && (r || !open) && isRevealed(state, theirs) && ` · They gave you ${theirs.stars}★`}
                {r && !theirs && open && ` · Theirs shows when they review or on ${deadline}`}
              </span>
              {theirs && isRevealed(state, theirs) && theirs.text && <span className="quote small">“{theirs.text}”</span>}
            </div>
            {open && !r && <button className="btn primary sm" onClick={() => setWriting({ to, dir })}>Rate</button>}
            {r && canEdit(r) && <button className="btn ghost sm" onClick={() => setWriting({ to, dir, existing: r })}>Edit</button>}
          </div>
        );
      })}
      {writing && <ReviewModal g={g} to={writing.to} dir={writing.dir} existing={writing.existing} onClose={() => setWriting(null)} />}
    </section>
  );
}

// ---------------------------------------------------------------- one review
export function ReviewItem({ r }) {
  const { state, dispatch, userByName } = useStore();
  const toast = useToast();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const from = userByName(r.from);
  const g = state.groups.find((x) => x.id === r.tripId);
  const canReply = r.to === state.me && !r.reply && !r.historic;
  const canReport = r.from !== state.me && !r.reported && !r.historic;
  return (
    <article className="review">
      <div className="review-top">
        <Avatar user={from} size={30} />
        <div><strong>{from?.name?.split(' ')[0]}</strong><span className="muted small">{monthLabel(g?.endDate || r.tripEnd || r.at)} trip</span></div>
        <Stars value={r.stars} />
      </div>
      {r.tags?.length > 0 && <div className="tags">{r.tags.map((t) => <span key={t} className="tag sm">{t}</span>)}</div>}
      {r.text && <p>{r.text}</p>}
      {r.reply && <div className="review-reply"><strong>Reply from {userByName(r.to)?.name?.split(' ')[0]}</strong><p>{r.reply.text}</p></div>}
      <div className="btnrow">
        {canReply && !replying && <button className="link small" onClick={() => setReplying(true)}>Reply publicly</button>}
        {canReport && <button className="link small muted-link" onClick={() => { const why = window.prompt('Why should MIRAS look at this review? (fake, abusive, personal info…)'); if (why) { dispatch({ type: 'reportReview', id: r.id, text: why }); toast('Thanks – MIRAS will review it'); } }}>Report</button>}
        {r.reported && r.from !== state.me && <span className="muted small">Reported</span>}
      </div>
      {replying && (
        <form className="reply-form" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; dispatch({ type: 'replyReview', id: r.id, text: reply.trim() }); toast('Reply posted'); setReplying(false); }}>
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your one public reply…" autoFocus />
          <button className="btn primary sm" disabled={!reply.trim()}>Post</button>
        </form>
      )}
    </article>
  );
}

/** Public reputation of a Local Friend: rating, trips, top tags, category scores, recent reviews. */
export function LocalReviews({ username, limit = 4 }) {
  const { state } = useStore();
  const s = localStats(state, username);
  const [all, setAll] = useState(false);
  const list = all ? s.list : s.list.slice(0, limit);
  return (
    <div className="rep">
      <div className="rep-summary">
        <div className="rep-big">{s.reviews >= 3 ? <><strong>{s.rating.toFixed(1)}</strong><Stars value={s.rating} /><span className="muted small">{s.reviews} reviews</span></> : <span className="muted">✨ New – not enough reviews yet</span>}</div>
        <div className="rep-facts small">
          <span><strong>{s.trips}</strong> trips completed</span>
          {s.responseRate != null && <span><strong>{Math.round(s.responseRate * 100)}%</strong> response rate</span>}
          {s.tags.length > 0 && <span>Known for: {s.tags.join(', ')}</span>}
        </div>
      </div>
      {Object.keys(s.cats).length > 0 && (
        <div className="cat-bars">{Object.entries(s.cats).map(([c, v]) => <div key={c} className="cat-bar"><span className="small">{c}</span><span className="bar"><i style={{ width: `${(v / 5) * 100}%` }} /></span><span className="small">{v.toFixed(1)}</span></div>)}</div>
      )}
      {list.map((r) => <ReviewItem key={r.id} r={r} />)}
      {s.list.length > limit && <button className="link small" onClick={() => setAll((x) => !x)}>{all ? 'Show fewer' : `Show all ${s.list.length} written reviews`}</button>}
    </div>
  );
}

// ---------------------------------------------------------------- tier progress (hosting)
export function TierProgress({ username }) {
  const { state } = useStore();
  const u = state.users[username];
  const t = displayTier(u);
  if (!t) return null;
  const s = localStats(state, username);
  const T = TIERS[t];
  const nextId = TIER_ORDER[T.rank + 1];
  const warn = u.local?.tierState?.warning;
  const left = warn ? Math.max(0, GRACE_DAYS - Math.floor((Date.now() - new Date(warn.at).getTime()) / 86400000)) : 0;
  return (
    <section className="card tier-card">
      <div className="tier-card-head">
        <div><span className="label">Your tier</span><TierBadge u={u} /></div>
        <p className="muted small">Max fee for your tier: <strong>₹{T.maxFee.toLocaleString('en-IN')}</strong>. Higher tiers rank higher in the directory.</p>
      </div>
      {warn && <div className="notice warn">⚠️ You no longer meet the {T.name} requirements. In <strong>{left} day{left === 1 ? '' : 's'}</strong> you’ll drop to {TIERS[warn.to].emoji} {TIERS[warn.to].name} unless you’re back on track.</div>}
      {(warn ? [t] : nextId ? [nextId] : []).map((id) => (
        <div key={id}>
          <span className="label">{warn ? `Keep ${TIERS[id].name}` : `Next: ${TIERS[id].emoji} ${TIERS[id].name}`}</span>
          <ul className="checks">{tierChecks(id, s).map((c) => <li key={c.label} className={c.ok ? 'ok' : ''}><span>{c.ok ? '✓' : '○'}</span> {c.label} <span className="muted small">· {c.have}</span></li>)}</ul>
        </div>
      ))}
      {!nextId && !warn && <p className="small">👑 You’re at the highest tier – thank you for being an amazing host!</p>}
    </section>
  );
}

// ---------------------------------------------------------------- verification panel (hosting)
export function VerificationPanel() {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [flow, setFlow] = useState(false);
  const [appealing, setAppealing] = useState(false);
  const [appeal, setAppeal] = useState('');
  const v = me?.local?.verification;
  const vs = verificationState(v);
  const days = daysToExpiry(v);
  const openAppeal = (state.appeals || []).find((a) => a.by === state.me && a.status === 'open');
  const lastAppeal = (state.appeals || []).find((a) => a.by === state.me);
  const tone = vs === 'verified' ? (days <= 30 ? 'warn' : 'ok') : vs === 'review' ? 'warn' : 'bad';
  return (
    <section className={`card verif-panel ${tone}`}>
      <div className="verif-head">
        <span className="dl-logo">DL</span>
        <div>
          <strong>{vs === 'verified' ? '✔ DigiLocker verified' : STATUS_LABEL[vs]}</strong>
          <span className="muted small">
            {vs === 'verified' && `${v.document} · ${v.masked} · verified ${monthLabel(v.verifiedAt)} · ${days <= 30 ? `expires in ${days} day${days === 1 ? '' : 's'}` : `valid until ${new Date(expiresAt(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}`}
            {vs === 'expired' && 'Your verification is more than 12 months old. You’re hidden from the directory until you renew.'}
            {vs === 'review' && 'The name on your document didn’t match your profile. MIRAS is checking it – you’ll be listed once approved.'}
            {vs === 'revoked' && (v?.reason || 'Please verify again to be listed.')}
            {vs === 'suspended' && `Reason: ${v?.reason || 'not given'}. You’re hidden from the directory and can’t take new requests.`}
            {vs === 'none' && 'Verify to be listed in the directory.'}
          </span>
        </div>
      </div>
      <div className="btnrow">
        {(vs === 'expired' || vs === 'revoked' || vs === 'none' || (vs === 'verified' && days <= 30)) && <button className="btn primary sm" onClick={() => setFlow(true)}>{vs === 'verified' || vs === 'expired' ? 'Renew verification' : 'Verify with DigiLocker'}</button>}
        {vs === 'verified' && <button className="btn ghost sm" onClick={() => { if (window.confirm('Withdraw DigiLocker consent? Your verified tag and tier will be removed, you’ll be hidden from the directory, pending requests will be declined and upcoming trips flagged.')) { dispatch({ type: 'withdrawVerification' }); toast('Consent withdrawn'); } }}>Withdraw consent</button>}
        {vs === 'suspended' && !openAppeal && <button className="btn ghost sm" onClick={() => setAppealing(true)}>Appeal</button>}
      </div>
      {vs === 'suspended' && openAppeal && <p className="small notice">⏳ Appeal sent {timeAgo(openAppeal.at)} – MIRAS will get back to you.</p>}
      {vs === 'suspended' && !openAppeal && lastAppeal?.status === 'rejected' && <p className="small muted">Your last appeal was rejected{lastAppeal.resolution ? `: ${lastAppeal.resolution}` : ''}.</p>}
      {v?.history?.length > 0 && (
        <details className="history"><summary className="small">History</summary>
          <ul className="small">{[...v.history].reverse().map((h, i) => <li key={i}><strong>{STATUS_LABEL[h.status] || h.status}</strong> · {h.reason} <span className="muted">· {timeAgo(h.at)} · {h.by}</span></li>)}</ul>
        </details>
      )}
      {flow && <DigiLockerFlow name={me.name} onClose={() => setFlow(false)} onDone={(nv) => { dispatch({ type: 'setVerification', verification: nv }); setFlow(false); toast(nv.status === 'verified' ? 'Verified – valid for 12 months' : 'Sent for manual review'); }} />}
      {appealing && (
        <Modal title="Appeal your suspension" onClose={() => setAppealing(false)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'appeal', text: appeal.trim() }); toast('Appeal sent to MIRAS'); setAppealing(false); }}>
            <p className="muted small">Reason given: {v?.reason}</p>
            <label>Your side of the story<textarea rows="4" value={appeal} onChange={(e) => setAppeal(e.target.value)} autoFocus /></label>
            <button className="btn primary block" disabled={appeal.trim().length < 10}>Send appeal</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- notifications
export function NoticesBell({ go }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState([]); // highlight what was unread when the list was opened
  const mine = (state.notices || []).filter((n) => n.to === state.me);
  const unread = mine.filter((n) => !n.read).length;
  return (
    <>
      <button className="bell" aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} onClick={() => { setFresh(mine.filter((n) => !n.read).map((n) => n.id)); setOpen(true); if (unread) dispatch({ type: 'readNotices' }); }}>
        🔔{unread ? <span className="count">{unread}</span> : null}
      </button>
      {open && (
        <Modal title="Notifications" onClose={() => setOpen(false)}>
          {mine.length === 0 && <p className="muted">Nothing new.</p>}
          <div className="notices">
            {mine.slice(0, 30).map((n) => (
              <button key={n.id} className={`notice-item ${fresh.includes(n.id) ? 'unread' : ''}`} onClick={() => { setOpen(false); if (n.link) go(n.link); }}>
                <span>{n.text}</span><span className="muted small">{timeAgo(n.at)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
