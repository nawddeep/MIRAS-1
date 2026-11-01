import { useMemo, useState } from 'react';
import { allEvents, eventEnd, isPastEvent, roleIn, ticketsLive, useStore } from '../store.jsx';
import { CATEGORIES, EVENTS_CHECKED } from '../eventsData.js';
import { Empty, Modal, useToast } from './ui.jsx';

const DAY = 86400000;
const d = (iso) => new Date(iso);
const sameDay = (a, b) => d(a).toDateString() === d(b).toDateString();
const t = (iso) => d(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dm = (iso, y) => d(iso).toLocaleDateString('en-IN', { weekday: y ? undefined : 'short', day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) });

export function whenLabel(e) {
  if (!e.start) return e.expected ? `${e.expected} · dates TBA` : `${e.recurring ? `${e.recurring} · ` : ''}Next date TBA`;
  if (!e.end || sameDay(e.start, e.end)) return `${dm(e.start)} · ${t(e.start)}${e.end ? ` – ${t(e.end)}` : ''}`;
  return `${dm(e.start)} – ${dm(e.end, true)}`;
}
const STATUS = {
  'on-sale': ['Tickets on sale', 'green'], 'few-left': ['Few tickets left', 'amber'], 'sold-out': ['Sold out', 'red'],
  free: ['Free', 'green'], 'at-venue': ['Tickets at the venue', 'neutral'], tba: ['Dates & tickets TBA', 'neutral'], past: ['Ended', 'neutral'],
};
function statusOf(e) {
  if (isPastEvent(e)) return STATUS.past;
  if (e.ticketsLiveAt && !ticketsLive(e)) return [`Tickets live ${dm(e.ticketsLiveAt)} · ${t(e.ticketsLiveAt)}`, 'amber'];
  return STATUS[e.status] || STATUS['on-sale'];
}
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

function DateBadge({ e }) {
  if (!e.start) return <div className="ev-date tba"><span>TBA</span></div>;
  return (
    <div className="ev-date">
      <span className="m">{d(e.start).toLocaleDateString('en-IN', { month: 'short' })}</span>
      <span className="dd">{d(e.start).getDate()}</span>
      <span className="w">{d(e.start).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
    </div>
  );
}

function useMine() {
  const { state } = useStore();
  const prefs = state.eventPrefs?.[state.me] || {};
  const reminders = (state.eventReminders || []).filter((r) => r.user === state.me && !r.fired);
  return { prefs, reminders };
}

export function EventCard({ e, onOpen, compact }) {
  const { prefs, reminders } = useMine();
  const c = CATEGORIES[e.category];
  const [label, tone] = statusOf(e);
  const p = prefs[e.id] || {};
  const bell = reminders.some((r) => r.eventId === e.id);
  return (
    <article className={`ev-card ${compact ? 'compact' : ''}`} onClick={onOpen} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && onOpen()} style={{ '--cat': c.color }}>
      <DateBadge e={e} />
      <div className="ev-body">
        <span className="ev-cat">{c.emoji} {c.label}{e.recurring && e.start ? ` · ${e.recurring}` : ''}</span>
        <h3>{e.title}</h3>
        <p className="muted small">{whenLabel(e)}</p>
        <p className="muted small">📍 {e.venue}</p>
        <div className="ev-foot">
          <span className="ev-price">{e.price}</span>
          <span className={`badge badge-${tone}`}>{label}</span>
          {p.attended && <span className="badge badge-gold">✓ Attended</span>}
          {!p.attended && p.going && <span className="badge badge-gold">Going</span>}
          {bell && <span className="ev-bell" title="Reminder set">🔔</span>}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- .ics calendar file
function downloadIcs(e) {
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const start = d(e.start);
  const end = e.end ? d(e.end) : new Date(start.getTime() + 3 * 3600 * 1000);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MIRAS//Events//EN', 'BEGIN:VEVENT', `UID:${e.id}@miras`,
    `DTSTART;TZID=Asia/Kolkata:${fmt(start)}`, `DTEND;TZID=Asia/Kolkata:${fmt(end)}`,
    `SUMMARY:${e.title}`, `LOCATION:${e.venue}, Udaipur`, `DESCRIPTION:${(e.about || '').replace(/\n/g, ' ')} Tickets: ${e.bookingUrl}`, `URL:${e.bookingUrl}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${e.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- detail
export function EventDetail({ e, onClose }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { prefs, reminders } = useMine();
  const [clicked, setClicked] = useState(false);
  const [shareTo, setShareTo] = useState('');
  const p = prefs[e.id] || {};
  const past = isPastEvent(e);
  const c = CATEGORIES[e.category];
  const [label, tone] = statusOf(e);
  const rem = (kind) => reminders.find((r) => r.eventId === e.id && r.kind === kind);
  const canTicketsReminder = !past && (e.status === 'tba' || e.status === 'sold-out' || (e.ticketsLiveAt && !ticketsLive(e)));
  const canBeforeReminder = !past && !!e.start && d(e.start).getTime() - Date.now() > DAY;
  const myGroups = state.groups.filter((g) => ['leader', 'member', 'local'].includes(roleIn(g, state.me)) && !(g.endDate < new Date().toISOString().slice(0, 10)));
  const toggleRem = (kind, on, msg) => {
    if (on) { dispatch({ type: 'removeEventReminder', id: on.id }); toast('Reminder removed'); }
    else { dispatch({ type: 'addEventReminder', eventId: e.id, kind }); toast(msg); }
  };
  return (
    <Modal title={`${c.emoji} ${c.label}`} onClose={onClose}>
      <div className="ev-detail" style={{ '--cat': c.color }}>
        <div className="ev-hero">
          <DateBadge e={e} />
          <div>
            <h2>{e.title}</h2>
            <p className="small">{whenLabel(e)}{e.recurring && e.start ? ` · ${e.recurring}` : ''}</p>
            <p className="small">📍 {e.venue}, Udaipur · by {e.organiser}</p>
          </div>
        </div>
        <div className="ev-foot"><span className="ev-price big">{e.price}</span><span className={`badge badge-${tone}`}>{label}</span></div>
        <p>{e.about}</p>
        {e.tiers && (
          <div className="ev-tiers">
            <span className="label">Tickets</span>
            {e.tiers.map((x) => (
              <div key={x.name} className={`ev-tier ${x.status === 'sold-out' ? 'out' : ''}`}>
                <div><strong>{x.name}</strong>{x.note && <span className="muted small">{x.note}</span>}</div>
                <span>{x.price}</span>
                <span className={`badge badge-${STATUS[x.status][1]}`}>{STATUS[x.status][0]}</span>
              </div>
            ))}
          </div>
        )}
        {e.includes && <ul className="ev-includes small">{e.includes.map((x) => <li key={x}>{x}</li>)}</ul>}

        {!past && (
          <>
            <a className={`btn primary block ${e.status === 'tba' ? 'ghost-like' : ''}`} href={e.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={() => setClicked(true)}>
              {e.status === 'tba' ? `Check ${e.bookingSite} ↗` : e.status === 'at-venue' || e.status === 'free' ? `Details on ${e.bookingSite} ↗` : `Book on ${e.bookingSite} ↗`}
            </a>
            <p className="muted small center">Booking happens on {host(e.bookingUrl)} – MIRAS doesn’t sell tickets or see your payment.</p>
            {clicked && !p.going && e.status !== 'tba' && (
              <div className="notice">Got your tickets? <button className="link" onClick={() => { dispatch({ type: 'eventPref', eventId: e.id, patch: { going: true } }); toast('Added to My events'); }}>Mark me as going</button></div>
            )}
          </>
        )}

        <div className="ev-actions">
          {!past && <button className={`btn sm ${p.going ? 'primary' : 'ghost'}`} onClick={() => { dispatch({ type: 'eventPref', eventId: e.id, patch: { going: !p.going } }); toast(p.going ? 'Removed from My events' : 'You’re going! 🎉'); }}>{p.going ? '✓ Going' : 'I’m going'}</button>}
          {past && <button className={`btn sm ${p.attended ? 'primary' : 'ghost'}`} onClick={() => { dispatch({ type: 'eventPref', eventId: e.id, patch: { attended: !p.attended } }); toast(p.attended ? 'Removed' : 'Marked as attended'); }}>{p.attended ? '✓ I attended' : 'I attended this'}</button>}
          {canTicketsReminder && <button className={`btn sm ${rem('tickets') ? 'primary' : 'ghost'}`} onClick={() => toggleRem('tickets', rem('tickets'), e.status === 'tba' ? 'We’ll tell you when dates & tickets are out' : 'We’ll tell you when tickets go live')}>🔔 {rem('tickets') ? 'Reminder set' : e.status === 'tba' ? (e.recurring ? 'Notify me when the next date is announced' : 'Notify me when tickets go live') : e.status === 'sold-out' ? 'Notify me if tickets open' : 'Remind me when tickets go live'}</button>}
          {canBeforeReminder && <button className={`btn sm ${rem('before') ? 'primary' : 'ghost'}`} onClick={() => toggleRem('before', rem('before'), 'We’ll remind you the day before')}>⏰ {rem('before') ? 'Day-before reminder on' : 'Remind me the day before'}</button>}
          {!past && e.start && <button className="btn ghost sm" onClick={() => downloadIcs(e)}>📅 Add to calendar</button>}
        </div>

        {!past && myGroups.length > 0 && (
          <div className="ev-share">
            <select value={shareTo} onChange={(ev) => setShareTo(ev.target.value)} aria-label="Share to group chat">
              <option value="">Share to a group chat…</option>
              {myGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="btn ghost sm" disabled={!shareTo} onClick={() => { dispatch({ type: 'shareEvent', id: shareTo, eventId: e.id }); toast('Shared in the group chat'); setShareTo(''); }}>Share</button>
          </div>
        )}
        <p className="muted small">Info from <a href={e.source || e.bookingUrl} target="_blank" rel="noopener noreferrer">{host(e.source || e.bookingUrl)}</a>, checked {d(EVENTS_CHECKED).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Always confirm details on the booking page.</p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- page
const WHEN = [['all', 'Any time'], ['week', 'This week'], ['month', 'Next 30 days'], ['later', 'Later'], ['tba', 'Dates TBA']];

export function EventsPage({ go, query }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const params = new URLSearchParams(query || '');
  const [tab, setTab] = useState(params.get('tab') || 'upcoming');
  const [cat, setCat] = useState('all');
  const [when, setWhen] = useState('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(params.get('e'));
  const { prefs, reminders } = useMine();
  const events = allEvents(state);
  const open = events.find((e) => e.id === openId);
  const close = () => { setOpenId(null); if (params.get('e')) go('/events'); };

  const upcoming = events.filter((e) => !isPastEvent(e)).sort((a, b) => (a.start ? d(a.start) : Infinity) - (b.start ? d(b.start) : Infinity));
  const past = events.filter(isPastEvent).sort((a, b) => d(b.start) - d(a.start));
  const filt = (list) => list.filter((e) => {
    if (cat !== 'all' && e.category !== cat) return false;
    if (freeOnly && !/free/i.test(e.price)) return false;
    if (q && !`${e.title} ${e.venue} ${e.organiser} ${e.about} ${CATEGORIES[e.category].label}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (tab === 'upcoming' && when !== 'all') {
      if (when === 'tba') return !e.start;
      if (!e.start) return false;
      const days = (d(e.start) - Date.now()) / DAY;
      if (when === 'week') return days <= 7;
      if (when === 'month') return days <= 30;
      if (when === 'later') return days > 30;
    }
    return true;
  });
  const list = filt(tab === 'past' ? past : upcoming);
  const featured = upcoming.filter((e) => e.featured);

  const going = upcoming.filter((e) => prefs[e.id]?.going);
  const attended = past.filter((e) => prefs[e.id]?.attended);
  const didYouGo = past.filter((e) => prefs[e.id]?.going && prefs[e.id]?.attended === undefined);
  const counts = { upcoming: upcoming.length, past: past.length, mine: going.length + reminders.length + attended.length };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Events & workshops in Udaipur</h1>
          <p className="muted">Tech meetups, gigs, comedy, parties, melas and hands-on workshops – for travellers and Udaipurites alike. Book on the organiser’s page, set reminders and keep track of what you’ve been to.</p>
        </div>
      </div>
      <nav className="tabs" role="tablist">
        {[['upcoming', 'Upcoming'], ['past', 'Past events'], ['mine', 'My events']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{counts[k] ? <span className="count">{counts[k]}</span> : null}</button>
        ))}
      </nav>

      {tab !== 'mine' && (
        <>
          {tab === 'upcoming' && featured.length > 0 && !q && cat === 'all' && when === 'all' && (
            <section className="ev-featured">
              {featured.map((e) => (
                <button key={e.id} className="ev-feat" style={{ '--cat': CATEGORIES[e.category].color }} onClick={() => setOpenId(e.id)}>
                  <span className="ev-cat">{CATEGORIES[e.category].emoji} {CATEGORIES[e.category].label}</span>
                  <strong>{e.title}</strong>
                  <span className="small">{whenLabel(e)}</span>
                  <span className="small">📍 {e.venue}</span>
                  <span className="ev-feat-cta">{e.status === 'tba' ? '🔔 Get notified' : `${e.price} · Book ↗`}</span>
                </button>
              ))}
            </section>
          )}
          <div className="filters">
            <input className="search" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search events, venues, organisers…" />
            {tab === 'upcoming' && <div className="seg">{WHEN.map(([k, l]) => <button key={k} className={when === k ? 'on' : ''} onClick={() => setWhen(k)}>{l}</button>)}</div>}
          </div>
          <div className="filters2">
            <div className="tags pick topics">
              <button className={`tag ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
              {Object.entries(CATEGORIES).map(([k, c]) => <button key={k} className={`tag ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{c.emoji} {c.label}</button>)}
            </div>
            <label className="check"><input type="checkbox" checked={freeOnly} onChange={(ev) => setFreeOnly(ev.target.checked)} /> Free only</label>
          </div>
          {list.length === 0 && <Empty title="No events match">Try another category or time.</Empty>}
          <div className="ev-grid">{list.map((e) => <EventCard key={e.id} e={e} onOpen={() => setOpenId(e.id)} />)}</div>
        </>
      )}

      {tab === 'mine' && (
        <section className="panel">
          {didYouGo.length > 0 && (
            <div className="card">
              <h3>Did you go?</h3>
              {didYouGo.map((e) => (
                <div key={e.id} className="ev-ask">
                  <span><strong>{e.title}</strong> <span className="muted small">· {whenLabel(e)}</span></span>
                  <span className="btnrow">
                    <button className="btn primary sm" onClick={() => { dispatch({ type: 'eventPref', eventId: e.id, patch: { attended: true } }); toast('Added to attended'); }}>Yes</button>
                    <button className="btn ghost sm" onClick={() => dispatch({ type: 'eventPref', eventId: e.id, patch: { attended: false } })}>No</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <h3>Going ({going.length})</h3>
          {going.length === 0 ? <p className="muted small">Mark events as “I’m going” to see them here.</p> : <div className="ev-grid">{going.map((e) => <EventCard key={e.id} e={e} onOpen={() => setOpenId(e.id)} />)}</div>}
          <h3>Reminders ({reminders.length})</h3>
          {reminders.length === 0 ? <p className="muted small">Set a reminder on any upcoming event – e.g. to hear when tickets go live.</p> : (
            <div className="card list">
              {reminders.map((r) => {
                const e = events.find((x) => x.id === r.eventId);
                if (!e) return null;
                return (
                  <div key={r.id} className="ev-ask">
                    <button className="link left" onClick={() => setOpenId(e.id)}>{r.kind === 'tickets' ? '🔔' : '⏰'} {e.title}</button>
                    <span className="muted small">{r.kind === 'tickets' ? (e.status === 'tba' ? 'When dates & tickets are announced' : 'When tickets go live') : 'A day before it starts'}</span>
                    <button className="btn ghost sm" onClick={() => { dispatch({ type: 'removeEventReminder', id: r.id }); toast('Reminder removed'); }}>Remove</button>
                  </div>
                );
              })}
            </div>
          )}
          <h3>Attended ({attended.length})</h3>
          {attended.length === 0 ? <p className="muted small">Events you’ve been to will show up here.</p> : <div className="ev-grid">{attended.map((e) => <EventCard key={e.id} e={e} onOpen={() => setOpenId(e.id)} />)}</div>}
        </section>
      )}

      {open && <EventDetail e={open} onClose={close} />}
    </div>
  );
}

/** Small event card inside a group chat message. */
export function EventChip({ eventId }) {
  const { state } = useStore();
  const e = allEvents(state).find((x) => x.id === eventId);
  if (!e) return null;
  const c = CATEGORIES[e.category];
  return (
    <button className="ev-chip" style={{ '--cat': c.color }} onClick={() => { window.location.hash = `/events?e=${e.id}`; }}>
      <span className="ev-cat">{c.emoji} {c.label} · shared event</span>
      <strong>{e.title}</strong>
      <span className="small">{whenLabel(e)} · {e.venue}</span>
      <span className="small ev-chip-cta">{isPastEvent(e) ? 'Ended' : `${e.price} · View & book →`}</span>
    </button>
  );
}

/** For the admin console: publish dates / ticket status (fires "tickets live" reminders). */
export function EventsAdmin() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const events = allEvents(state).filter((e) => !isPastEvent(e));
  const [edit, setEdit] = useState({});
  const subs = (id) => (state.eventReminders || []).filter((r) => r.eventId === id && r.kind === 'tickets' && !r.fired).length;
  const list = useMemo(() => [...events].sort((a, b) => (a.status === 'tba' ? -1 : 1) - (b.status === 'tba' ? -1 : 1)), [events]);
  return (
    <section className="card list">
      <p className="muted small">When an organiser announces dates or opens tickets, publish it here – everyone with a reminder is notified.</p>
      {list.map((e) => {
        const v = edit[e.id] || { start: e.start || '', status: e.status };
        return (
          <div key={e.id} className="admin-row">
            <div className="admin-mid">
              <strong>{e.title}</strong>
              <span className="small muted">{whenLabel(e)} · {STATUS[e.status]?.[0]} · 🔔 {subs(e.id)} waiting</span>
            </div>
            <input type="datetime-local" value={v.start} onChange={(ev) => setEdit((x) => ({ ...x, [e.id]: { ...v, start: ev.target.value } }))} aria-label="Start" style={{ width: 'auto' }} />
            <select value={v.status} onChange={(ev) => setEdit((x) => ({ ...x, [e.id]: { ...v, status: ev.target.value } }))} style={{ width: 'auto' }}>
              {Object.entries(STATUS).filter(([k]) => k !== 'past').map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn primary sm" onClick={() => { dispatch({ type: 'publishEventUpdate', eventId: e.id, patch: { start: v.start || null, status: v.status } }); toast('Published'); }}>Publish</button>
          </div>
        );
      })}
    </section>
  );
}
void eventEnd;
