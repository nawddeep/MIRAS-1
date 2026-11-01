import { useMemo, useState } from 'react';
import { makeCode, roleIn, useStore } from '../store.jsx';
import { Avatar, Badge, Empty, fmtRange, Modal, timeAgo, tripDays, UserLine, useToast } from './ui.jsx';
import { ChatPanel } from './Chat.jsx';
import { priceLabel } from './ui.jsx';
import { GuestRating, RateTripCard, RatingLine, TierBadge } from './Reviews.jsx';
import { VerifiedBadge } from './Trust.jsx';
import { isVerified, localStats, todayStr } from '../trust.js';

export function GroupPage({ id, go }) {
  const { state, dispatch, userByName } = useStore();
  const toast = useToast();
  const g = state.groups.find((x) => x.id === id);
  const [tab, setTab] = useState(() => (window.location.hash.includes('tab=chat') ? 'chat' : 'itinerary'));
  if (!g) return <div className="page"><Empty title="Group not found" action={<button className="btn primary" onClick={() => go('/')}>Back to my groups</button>} /></div>;

  const role = roleIn(g, state.me);
  const isLeader = role === 'leader';
  const isMember = role === 'leader' || role === 'member' || role === 'local';
  const local = g.localFriend ? userByName(g.localFriend) : null;
  const pendingS = g.suggestions.filter((s) => s.status === 'pending').length;
  const leader = userByName(g.leader);
  const full = g.members.length >= g.maxMembers;

  const tabs = [
    ['itinerary', 'Itinerary', g.itinerary.length],
    ['chat', 'Chat', null],
    ['suggestions', 'Suggestions', pendingS || null],
    ['members', 'Members', g.members.length],
    ...(isLeader && g.type === 'private' ? [['requests', 'Requests', g.requests.length || null]] : []),
  ];

  const join = () => {
    if (full) return toast('This group is full', 'warn');
    if (g.type === 'public') { dispatch({ type: 'addMember', id: g.id, username: state.me }); toast(`Welcome to ${g.name}!`); }
    else { dispatch({ type: 'request', id: g.id, username: state.me, message: '' }); toast('Request sent to the leader'); }
  };
  const leave = () => {
    if (!window.confirm(`Leave ${g.name}?`)) return;
    dispatch({ type: 'removeMember', id: g.id, username: state.me });
    toast(`You left ${g.name}`);
    if (g.type === 'private') go('/');
  };
  const del = () => {
    if (!window.confirm(`Delete ${g.name} for everyone? This cannot be undone.`)) return;
    dispatch({ type: 'deleteGroup', id: g.id });
    toast('Group deleted');
    go('/');
  };

  return (
    <div className="page">
      <button className="link back" onClick={() => go('/')}>← My groups</button>
      <header className="ghead" data-dest={g.destination}>
        <div className="ghead-badges">
          <Badge tone={g.type === 'private' ? 'dark' : 'light'}>{g.type === 'private' ? '🔒 Private group' : '🌐 Public group'}</Badge>
          {isLeader && <Badge tone="gold">You are the leader</Badge>}
          {role === 'member' && <Badge tone="green">Member</Badge>}
          {role === 'local' && <Badge tone="green">🤝 You are the local friend</Badge>}
          {role === 'requested' && <Badge tone="amber">Request pending</Badge>}
        </div>
        <h1>{g.name}</h1>
        <p>{g.destination} · {fmtRange(g.startDate, g.endDate)} · {tripDays(g)} day{tripDays(g) > 1 ? 's' : ''} · {g.members.length}/{g.maxMembers} travellers</p>
        {g.description && <p className="ghead-desc">{g.description}</p>}
        <div className="ghead-foot">
          <div className="stack">
            {g.members.slice(0, 6).map((m) => <Avatar key={m} user={userByName(m)} size={30} />)}
            <span className="small">Led by {leader?.name}</span>
            {local && <span className="local-chip" title="Local friend"><Avatar user={local} size={24} /> 🤝 Local friend: {local.name.split(' ')[0]} <TierBadge u={local} compact /></span>}
          </div>
          <div className="btnrow">
            {role === 'none' && <button className="btn primary" onClick={join} disabled={full}>{full ? 'Group full' : g.type === 'public' ? 'Join group' : 'Request to join'}</button>}
            {role === 'requested' && <button className="btn ghost" onClick={() => { dispatch({ type: 'cancelRequest', id: g.id, username: state.me }); toast('Request cancelled'); }}>Cancel request</button>}
            {role === 'member' && <button className="btn ghost light" onClick={leave}>Leave group</button>}
            {isLeader && !g.localFriend && <button className="btn ghost light" onClick={() => go(`/locals?for=${g.id}`)}>🤝 Find a local friend</button>}
            {role === 'local' && g.endDate >= todayStr() && <button className="btn ghost light" onClick={() => { if (window.confirm('Stop being the local friend for this trip? Cancelling an accepted trip counts towards your cancellation rate.')) { dispatch({ type: 'removeLocalFriend', id: g.id, self: true }); toast('You left the group'); go('/hosting'); } }}>Leave as local friend</button>}
            {isLeader && <button className="btn ghost light" onClick={del}>Delete group</button>}
          </div>
        </div>
      </header>

      {local && g.localFlag && !isVerified(local) && isMember && (
        <div className={`notice ${g.localFlag.kept ? '' : 'warn'}`}>
          ⚠️ {local.name.split(' ')[0]} is no longer DigiLocker verified.{' '}
          {g.localFlag.kept ? 'The leader chose to keep them on this trip.' : isLeader ? 'Do you want to keep them on this trip?' : 'Your leader will decide whether to keep them.'}
          {isLeader && !g.localFlag.kept && (
            <span className="btnrow inline">
              <button className="btn ghost sm" onClick={() => { dispatch({ type: 'keepLocal', id: g.id }); toast('Local friend kept'); }}>Keep</button>
              <button className="btn danger sm" onClick={() => { dispatch({ type: 'removeLocalFriend', id: g.id }); toast('Local friend removed'); }}>Remove</button>
            </span>
          )}
        </div>
      )}
      <RateTripCard g={g} />
      {isMember && <InviteCard g={g} isLeader={isLeader} />}

      <nav className="tabs" role="tablist">
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}{n ? <span className="count">{n}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'itinerary' && <Itinerary g={g} role={role} />}
      {tab === 'chat' && <ChatPanel g={g} role={role} />}
      {tab === 'suggestions' && <Suggestions g={g} role={role} />}
      {tab === 'members' && <Members g={g} role={role} />}
      {tab === 'requests' && isLeader && <Requests g={g} />}
    </div>
  );
}

// ---------------------------------------------------------------- invite code
function InviteCard({ g, isLeader }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`); }
    catch (e) { toast(text); }
  };
  const share = `Join my MIRAS group "${g.name}" (${g.destination}). Code: ${g.code}`;
  return (
    <div className="invite card">
      <div>
        <span className="label">Invite code</span>
        <div className="code">{g.code}</div>
        <p className="muted small">{g.type === 'private' ? 'People who enter this code send you a join request.' : 'Anyone with this code joins instantly.'}</p>
      </div>
      <div className="btnrow">
        <button className="btn ghost sm" onClick={() => copy(g.code, 'Code')}>Copy code</button>
        <button className="btn ghost sm" onClick={() => copy(share, 'Invite message')}>Copy invite</button>
        {isLeader && <button className="btn ghost sm" onClick={() => { dispatch({ type: 'patchGroup', id: g.id, patch: { code: makeCode() } }); toast('New code created – the old one no longer works'); }}>New code</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- members
function Members({ g, role }) {
  const { state, dispatch, userByName } = useStore();
  const toast = useToast();
  const isLeader = role === 'leader';
  const [u, setU] = useState('');
  const handle = u.trim().replace(/^@/, '').toLowerCase();
  const candidates = Object.values(state.users).filter((x) => !g.members.includes(x.username));
  const add = (e) => {
    e.preventDefault();
    if (!handle) return;
    if (!state.users[handle]) return toast(`No MIRAS traveller with username @${handle}`, 'warn');
    if (g.members.includes(handle)) return toast(`@${handle} is already in the group`, 'warn');
    if (g.members.length >= g.maxMembers) return toast('Group is full – raise the limit first', 'warn');
    dispatch({ type: 'addMember', id: g.id, username: handle });
    toast(`Added ${state.users[handle].name}`);
    setU('');
  };
  const remove = (m) => {
    if (!window.confirm(`Remove ${userByName(m)?.name} from the group?`)) return;
    dispatch({ type: 'removeMember', id: g.id, username: m });
    toast('Member removed');
  };
  return (
    <section className="panel">
      {isLeader && (
        <form className="card addmember" onSubmit={add}>
          <label>Add a traveller by MIRAS username
            <div className="prefix-input">
              <span>@</span>
              <input value={u} onChange={(e) => setU(e.target.value)} list="mir-users" placeholder="username" />
              <button className="btn primary sm">Add</button>
            </div>
          </label>
          <datalist id="mir-users">{candidates.map((c) => <option key={c.username} value={c.username}>{c.name}</option>)}</datalist>
          <p className="muted small">Try <button type="button" className="link" onClick={() => setU(candidates[0]?.username || '')}>@{candidates[0]?.username}</button></p>
        </form>
      )}
      {g.localFriend ? (
        <div className="card local-card">
          <UserLine user={userByName(g.localFriend)} sub={<>🤝 Local friend · {userByName(g.localFriend)?.local?.area || 'Udaipur'} <TierBadge u={userByName(g.localFriend)} compact /></>}
            right={isLeader ? <button className="btn ghost sm danger-text" onClick={() => { if (window.confirm('Remove your local friend from this group?')) { dispatch({ type: 'removeLocalFriend', id: g.id }); toast('Local friend removed'); } }}>Remove</button> : null} />
          <p className="muted small local-meta">{isVerified(userByName(g.localFriend)) ? <VerifiedBadge v={userByName(g.localFriend).local.verification} compact /> : <span className="err">⚠ Not verified right now</span>} <RatingLine stats={localStats(state, g.localFriend)} /> · {priceLabel(userByName(g.localFriend)?.local?.pricing)} · in the chat and suggests itinerary changes</p>
        </div>
      ) : isLeader ? (
        <div className="card local-card cta">
          <div><strong>🤝 Add a local friend</strong><p className="muted small">A DigiLocker-verified Udaipurite who helps you explore – in your chat and suggesting plans, for a fee they set.</p></div>
          <button className="btn primary sm" onClick={() => { window.location.hash = `/locals?for=${g.id}`; }}>Find a local</button>
        </div>
      ) : null}
      <div className="card list">
        {g.members.map((m) => {
          const user = userByName(m);
          return (
            <UserLine key={m} user={user} sub={<>{m === g.leader ? '👑 Leader' : user?.style}{role === 'local' && <> · <GuestRating username={m} /></>}</>}
              right={isLeader && m !== g.leader ? <button className="btn ghost sm danger-text" onClick={() => remove(m)}>Remove</button> : null} />
          );
        })}
      </div>
      {g.type === 'public' && !isLeader && <p className="muted small">Public group: members can leave any time from the top of the page.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- join requests (private)
function Requests({ g }) {
  const { dispatch, userByName } = useStore();
  const toast = useToast();
  if (!g.requests.length) return <Empty title="No pending requests">Share your invite code – people who use it will appear here for you to accept.</Empty>;
  return (
    <section className="panel card list">
      {g.requests.map((r) => {
        const user = userByName(r.username);
        return (
          <div key={r.username} className="request">
            <UserLine user={user} sub={`requested ${timeAgo(r.at)}`} />
            {r.message && <p className="quote">“{r.message}”</p>}
            <div className="btnrow">
              <button className="btn primary sm" onClick={() => {
                if (g.members.length >= g.maxMembers) return toast('Group is full', 'warn');
                dispatch({ type: 'addMember', id: g.id, username: r.username }); toast(`${user?.name} joined the group`);
              }}>Accept</button>
              <button className="btn ghost sm" onClick={() => { dispatch({ type: 'rejectRequest', id: g.id, username: r.username }); toast('Request declined'); }}>Decline</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------- itinerary
const emptyItem = { day: 1, time: '10:00', title: '', place: '', note: '' };

function ItemForm({ initial, days, onSubmit, submitLabel, withReason }) {
  const [f, setF] = useState({ ...emptyItem, ...initial });
  const [reason, setReason] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'day' ? +e.target.value : e.target.value }));
  const ok = f.title.trim() && (!withReason || reason.trim());
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit({ ...f, title: f.title.trim() }, reason.trim()); }}>
      <div className="row3">
        <label>Day<select value={f.day} onChange={set('day')}>{Array.from({ length: days }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}</select></label>
        <label>Time<input type="time" value={f.time} onChange={set('time')} /></label>
      </div>
      <label>What<input value={f.title} onChange={set('title')} placeholder="e.g. Sunset boat ride" autoFocus /></label>
      <label>Where<input value={f.place} onChange={set('place')} placeholder="e.g. Lake Pichola" /></label>
      <label>Notes<input value={f.note} onChange={set('note')} placeholder="Tickets, meeting point…" /></label>
      {withReason && <label>Why are you suggesting this? <span className="req">*</span><textarea rows="2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Help the leader decide…" /></label>}
      <button className="btn primary block" disabled={!ok}>{submitLabel}</button>
    </form>
  );
}

function Itinerary({ g, role }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const isLeader = role === 'leader';
  const isMember = role === 'member' || role === 'local';
  const days = Math.max(tripDays(g), ...g.itinerary.map((i) => i.day));
  const [modal, setModal] = useState(null); // {mode: add|edit|suggest-add|suggest-edit|suggest-remove, item}
  const byDay = useMemo(() => {
    const m = {};
    for (const it of g.itinerary) (m[it.day] ||= []).push(it);
    Object.values(m).forEach((l) => l.sort((a, b) => a.time.localeCompare(b.time)));
    return m;
  }, [g.itinerary]);
  const pendingFor = (itemId) => g.suggestions.filter((s) => s.status === 'pending' && s.targetId === itemId).length;

  const close = () => setModal(null);
  const suggest = (s) => { dispatch({ type: 'suggest', id: g.id, suggestion: { ...s, by: state.me } }); toast('Suggestion sent to the leader'); close(); };

  return (
    <section className="panel">
      <div className="panel-head">
        <p className="muted small">{isLeader ? 'You can edit the plan directly. Members send suggestions for you to accept or reject.' : isMember ? (role === 'local' ? 'As the local friend, suggest stops and changes – they show up as Local tips for the leader to accept.' : 'Want a change? Suggest it – the leader accepts or rejects with a comment.') : 'Join the group to suggest changes.'}</p>
        {isLeader && <button className="btn primary sm" onClick={() => setModal({ mode: 'add' })}>+ Add stop</button>}
        {isMember && <button className="btn primary sm" onClick={() => setModal({ mode: 'suggest-add' })}>+ Suggest a stop</button>}
      </div>
      {g.itinerary.length === 0 && <Empty title="No plan yet">{isLeader ? 'Add the first stop of your trip.' : 'The leader hasn’t added any stops yet.'}</Empty>}
      {Array.from({ length: days }, (_, i) => i + 1).filter((d) => byDay[d]).map((d) => (
        <div key={d} className="day">
          <h3 className="day-title">Day {d}</h3>
          <ol className="timeline">
            {byDay[d].map((it) => (
              <li key={it.id} className="stop">
                <span className="stop-time">{it.time}</span>
                <div className="stop-body">
                  <strong>{it.title}</strong>
                  {it.place && <span className="muted small">📍 {it.place}</span>}
                  {it.note && <span className="small">{it.note}</span>}
                  {pendingFor(it.id) > 0 && <span className="small warn">{pendingFor(it.id)} pending suggestion{pendingFor(it.id) > 1 ? 's' : ''}</span>}
                </div>
                <div className="stop-actions">
                  {isLeader && <>
                    <button className="btn ghost xs" onClick={() => setModal({ mode: 'edit', item: it })}>Edit</button>
                    <button className="btn ghost xs danger-text" onClick={() => { if (window.confirm('Remove this stop?')) { dispatch({ type: 'removeItem', id: g.id, itemId: it.id }); toast('Stop removed'); } }}>Remove</button>
                  </>}
                  {isMember && <>
                    <button className="btn ghost xs" onClick={() => setModal({ mode: 'suggest-edit', item: it })}>Suggest change</button>
                    <button className="btn ghost xs" onClick={() => setModal({ mode: 'suggest-remove', item: it })}>Suggest removal</button>
                  </>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {modal?.mode === 'add' && (
        <Modal title="Add a stop" onClose={close}>
          <ItemForm days={days} submitLabel="Add to itinerary" onSubmit={(item) => { dispatch({ type: 'addItem', id: g.id, item }); toast('Stop added'); close(); }} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit stop" onClose={close}>
          <ItemForm days={days} initial={modal.item} submitLabel="Save changes" onSubmit={(item) => { const { id: _drop, ...patch } = item; dispatch({ type: 'editItem', id: g.id, itemId: modal.item.id, patch }); toast('Stop updated'); close(); }} />
        </Modal>
      )}
      {modal?.mode === 'suggest-add' && (
        <Modal title="Suggest a new stop" onClose={close}>
          <ItemForm days={days} withReason submitLabel="Send suggestion" onSubmit={(item, reason) => suggest({ kind: 'add', proposed: item, reason })} />
        </Modal>
      )}
      {modal?.mode === 'suggest-edit' && (
        <Modal title={`Suggest a change: ${modal.item.title}`} onClose={close}>
          <ItemForm days={days} initial={modal.item} withReason submitLabel="Send suggestion" onSubmit={(item, reason) => {
            const proposed = {};
            for (const k of ['day', 'time', 'title', 'place', 'note']) if (item[k] !== modal.item[k]) proposed[k] = item[k];
            if (!Object.keys(proposed).length) return toast('Change at least one field', 'warn');
            suggest({ kind: 'edit', targetId: modal.item.id, proposed, reason });
          }} />
        </Modal>
      )}
      {modal?.mode === 'suggest-remove' && (
        <Modal title={`Suggest removing: ${modal.item.title}`} onClose={close}>
          <RemoveForm onSubmit={(reason) => suggest({ kind: 'remove', targetId: modal.item.id, reason })} />
        </Modal>
      )}
    </section>
  );
}

function RemoveForm({ onSubmit }) {
  const [reason, setReason] = useState('');
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); }}>
      <label>Why should it be removed? <span className="req">*</span><textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      <button className="btn primary block" disabled={!reason.trim()}>Send suggestion</button>
    </form>
  );
}

// ---------------------------------------------------------------- suggestions
const FIELD = { day: 'Day', time: 'Time', title: 'What', place: 'Where', note: 'Notes' };

function Change({ s, g }) {
  const target = g.itinerary.find((i) => i.id === s.targetId);
  if (s.kind === 'add') {
    const p = s.proposed;
    return <div className="change add"><span className="kind">+ New stop</span><strong>{p.title}</strong><span className="muted small">Day {p.day} · {p.time}{p.place ? ` · ${p.place}` : ''}</span>{p.note && <span className="small">{p.note}</span>}</div>;
  }
  if (s.kind === 'remove') {
    return <div className="change remove"><span className="kind">− Remove stop</span><strong className={target ? 'strike' : ''}>{target?.title || 'A stop that no longer exists'}</strong></div>;
  }
  return (
    <div className="change edit">
      <span className="kind">✎ Change</span><strong>{target?.title || 'A stop'}</strong>
      <ul className="diff">
        {Object.entries(s.proposed).map(([k, v]) => (
          <li key={k}><span className="muted">{FIELD[k]}:</span> {s.status === 'pending' && target && <><span className="strike">{k === 'day' ? `Day ${target[k]}` : target[k] || '—'}</span> → </>}<strong>{k === 'day' ? `Day ${v}` : v || '—'}</strong></li>
        ))}
      </ul>
    </div>
  );
}

function Suggestions({ g, role }) {
  const { dispatch, userByName } = useStore();
  const toast = useToast();
  const isLeader = role === 'leader';
  const [deciding, setDeciding] = useState(null); // {s, accept}
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState('all');
  const sorted = [...g.suggestions].sort((a, b) => (a.status === 'pending') === (b.status === 'pending') ? b.createdAt.localeCompare(a.createdAt) : a.status === 'pending' ? -1 : 1);
  const list = sorted.filter((s) => filter === 'all' || s.status === filter);

  if (!g.suggestions.length) return <Empty title="No suggestions yet">{role === 'member' || role === 'local' ? 'Open the itinerary and use “Suggest change” on any stop.' : 'Members can suggest changes to the itinerary – they will show up here.'}</Empty>;

  return (
    <section className="panel">
      <div className="seg small-seg">
        {['all', 'pending', 'accepted', 'rejected'].map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
      </div>
      {list.map((s) => {
        const by = userByName(s.by);
        return (
          <article key={s.id} className={`card sugg ${s.status}`}>
            <div className="sugg-head">
              <UserLine user={by} sub={timeAgo(s.createdAt)} />
              <div className="btnrow">
                {s.by === g.localFriend && <Badge tone="gold">🤝 Local tip</Badge>}
                <Badge tone={s.status === 'pending' ? 'amber' : s.status === 'accepted' ? 'green' : 'red'}>{s.status}</Badge>
              </div>
            </div>
            <Change s={s} g={g} />
            <p className="quote">“{s.reason}”</p>
            {s.status !== 'pending' && (
              <div className={`decision ${s.status}`}>
                <Avatar user={userByName(g.leader)} size={24} />
                <div><strong>{userByName(g.leader)?.name?.split(' ')[0]} {s.status} this</strong>{s.decidedAt && <span className="muted small"> · {timeAgo(s.decidedAt)}</span>}<p>{s.decisionComment}</p></div>
              </div>
            )}
            {s.status === 'pending' && isLeader && (
              <div className="btnrow">
                <button className="btn primary sm" onClick={() => { setComment(''); setDeciding({ s, accept: true }); }}>Accept</button>
                <button className="btn ghost sm danger-text" onClick={() => { setComment(''); setDeciding({ s, accept: false }); }}>Reject</button>
              </div>
            )}
            {s.status === 'pending' && !isLeader && <p className="muted small">Waiting for the leader’s decision.</p>}
          </article>
        );
      })}

      {deciding && (
        <Modal title={deciding.accept ? 'Accept suggestion' : 'Reject suggestion'} onClose={() => setDeciding(null)}>
          <Change s={deciding.s} g={g} />
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            dispatch({ type: 'decide', id: g.id, suggestionId: deciding.s.id, accept: deciding.accept, comment: comment.trim() });
            toast(deciding.accept ? 'Accepted – itinerary updated' : 'Suggestion rejected');
            setDeciding(null);
          }}>
            <label>{deciding.accept ? 'Why are you accepting it?' : 'Why are you rejecting it?'} <span className="req">*</span>
              <textarea rows="3" value={comment} onChange={(e) => setComment(e.target.value)} autoFocus placeholder={deciding.accept ? 'e.g. Great idea – fits perfectly before dinner.' : 'e.g. Too far from the hotel for that day.'} />
            </label>
            <p className="muted small">Your comment is shown to everyone in the group.</p>
            <button className={`btn block ${deciding.accept ? 'primary' : 'danger'}`} disabled={!comment.trim()}>{deciding.accept ? 'Accept & update itinerary' : 'Reject suggestion'}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
