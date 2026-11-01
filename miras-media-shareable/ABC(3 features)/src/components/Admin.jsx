import { useState } from 'react';
import { useStore } from '../store.jsx';
import { Avatar, Badge, Empty, timeAgo, useToast } from './ui.jsx';
import { Stars, TierBadge } from './Reviews.jsx';
import { EventsAdmin } from './Events.jsx';
import { daysToExpiry, displayTier, localStats, STATUS_LABEL, verificationState } from '../trust.js';

const TONE = { verified: 'green', review: 'amber', expired: 'amber', suspended: 'red', revoked: 'red', none: 'neutral' };
const KIND = { safety: '🚨 Safety report', flag: '🚩 Auto-flag', review: '📝 Reported review' };

/** MIRAS trust & safety console (demo – in production this is a separate staff tool with real sign-in). */
export function Admin({ go }) {
  const { state, dispatch, userByName } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('queue');
  const locals = Object.values(state.users).filter((u) => u.type === 'local');
  const queue = locals.filter((u) => verificationState(u.local?.verification) === 'review');
  const reports = (state.reports || []).filter((r) => r.status === 'open');
  const appeals = (state.appeals || []).filter((a) => a.status === 'open');
  const ask = (q) => { const r = window.prompt(q); return r == null ? null : r.trim(); };
  const set = (u, status, label) => {
    const reason = ask(`${label} @${u.username} – reason (shown to the local):`);
    if (reason == null || (status !== 'verified' && !reason)) return;
    dispatch({ type: 'adminSetStatus', username: u.username, status, reason });
    toast(`${label}: ${u.name}`);
  };
  const reviewOf = (id) => (state.reviews || []).find((r) => r.id === id);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Demo · staff only</p>
          <h1>MIRAS trust & safety</h1>
          <p className="muted">Approve verifications, suspend or restore verified tags, handle reports and appeals. Every action is logged with a reason and the local is notified.</p>
        </div>
        <button className="btn ghost" onClick={() => go('/me')}>Back to profile</button>
      </div>
      <nav className="tabs" role="tablist">
        {[['queue', 'Verification queue', queue.length], ['reports', 'Reports', reports.length], ['appeals', 'Appeals', appeals.length], ['locals', 'All locals', null], ['events', 'Events', null]].map(([k, l, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{n ? <span className="count">{n}</span> : null}</button>
        ))}
      </nav>

      {tab === 'queue' && (
        <section className="panel">
          {queue.length === 0 && <Empty title="Queue is empty">Name mismatches from DigiLocker land here for a manual check.</Empty>}
          {queue.map((u) => {
            const v = u.local.verification;
            return (
              <article key={u.username} className="card admin-row">
                <Avatar user={u} size={40} />
                <div className="admin-mid">
                  <strong>{u.name} <span className="muted small">@{u.username}</span></strong>
                  <span className="small">Profile name “{u.name}” · name on {v.document}: “{v.nameOnDoc}” · {v.masked}</span>
                </div>
                <div className="btnrow">
                  <button className="btn primary sm" onClick={() => { dispatch({ type: 'adminSetStatus', username: u.username, status: 'verified', reason: 'Approved after manual review' }); toast('Approved'); }}>Approve</button>
                  <button className="btn ghost sm" onClick={() => set(u, 'revoked', 'Rejected')}>Reject</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'reports' && (
        <section className="panel">
          {reports.length === 0 && <Empty title="No open reports">Safety reports, low-rating flags and reported reviews appear here.</Empty>}
          {reports.map((r) => {
            const about = userByName(r.about);
            const rv = r.reviewId && reviewOf(r.reviewId);
            return (
              <article key={r.id} className="card admin-report">
                <div className="sugg-head">
                  <strong>{KIND[r.kind]}</strong>
                  <span className="muted small">by @{r.by} · {timeAgo(r.at)}</span>
                </div>
                <p className="small">About <strong>{about?.name}</strong> {about?.type === 'local' ? '(Local Friend)' : '(traveller)'}</p>
                <p className="quote">“{r.text}”</p>
                {rv && <div className="review-mini"><Stars value={rv.stars} /> {rv.text}</div>}
                <div className="btnrow">
                  <button className="btn danger sm" onClick={() => { dispatch({ type: 'resolveReport', id: r.id, confirm: true }); toast(r.kind === 'review' ? 'Review hidden' : 'Confirmed – counts against the tier'); }}>{r.kind === 'review' ? 'Hide review' : 'Confirm'}</button>
                  <button className="btn ghost sm" onClick={() => { dispatch({ type: 'resolveReport', id: r.id, confirm: false }); toast('Dismissed'); }}>Dismiss</button>
                  {about?.type === 'local' && verificationState(about.local?.verification) === 'verified' && r.kind !== 'review' && <button className="btn ghost sm" onClick={() => set(about, 'suspended', 'Suspended')}>Suspend {about.name.split(' ')[0]}</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'appeals' && (
        <section className="panel">
          {appeals.length === 0 && <Empty title="No open appeals">Suspended locals can appeal from their Hosting page.</Empty>}
          {appeals.map((a) => {
            const u = userByName(a.by);
            return (
              <article key={a.id} className="card admin-report">
                <div className="sugg-head"><strong>{u?.name}</strong><span className="muted small">{timeAgo(a.at)}</span></div>
                <p className="small muted">Suspended for: {u?.local?.verification?.reason}</p>
                <p className="quote">“{a.text}”</p>
                <div className="btnrow">
                  <button className="btn primary sm" onClick={() => { const note = ask('Note to the local (optional):'); if (note == null) return; dispatch({ type: 'resolveAppeal', id: a.id, restore: true, note }); toast('Tag restored'); }}>Restore tag</button>
                  <button className="btn ghost sm" onClick={() => { const note = ask('Why is the appeal rejected?'); if (!note) return; dispatch({ type: 'resolveAppeal', id: a.id, restore: false, note }); toast('Appeal rejected'); }}>Reject appeal</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'events' && <EventsAdmin />}

      {tab === 'locals' && (
        <section className="card list">
          {locals.map((u) => {
            const v = u.local?.verification;
            const vs = verificationState(v);
            const s = localStats(state, u.username);
            const d = daysToExpiry(v);
            return (
              <div key={u.username} className="admin-row">
                <Avatar user={u} size={36} />
                <div className="admin-mid">
                  <strong>{u.name} {displayTier(u) && <TierBadge u={u} compact />}</strong>
                  <span className="small muted">{s.reviews ? `★ ${s.rating.toFixed(1)} (${s.reviews})` : 'no reviews'} · {s.trips} trips · reply {s.responseRate == null ? '–' : `${Math.round(s.responseRate * 100)}%`} · cancel {Math.round(s.cancelRate * 100)}%{s.safety ? ` · 🚨 ${s.safety}` : ''}{vs === 'verified' && d <= 30 ? ` · expires in ${d}d` : ''}</span>
                </div>
                <Badge tone={TONE[vs]}>{STATUS_LABEL[vs]}</Badge>
                <div className="btnrow">
                  {vs === 'verified' && <button className="btn ghost sm" onClick={() => set(u, 'suspended', 'Suspended')}>Suspend</button>}
                  {vs === 'suspended' && <button className="btn primary sm" onClick={() => set(u, 'verified', 'Restored')}>Restore</button>}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
