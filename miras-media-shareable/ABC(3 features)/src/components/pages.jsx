import { useMemo, useState } from 'react';
import { makeCode, roleIn, useStore, USERNAME_RE } from '../store.jsx';
import { MOCK_USERS } from '../mockData.js';
import { Avatar, Badge, Empty, fmtRange, UserLine, useToast } from './ui.jsx';
import { LocalProfileFields, localProfileMissing, localProfileValid } from './Locals.jsx';
import { PRIVACY_VERSION, PrivacyConsent, PrivacyLink } from './Trust.jsx';
import { GuestRating } from './Reviews.jsx';
import { verificationState } from '../trust.js';

const STYLES = ['Culture & history', 'Photography', 'Adventure', 'Solo & slow travel', 'Food trails', 'Art & crafts', 'Architecture', 'Music & dance', 'Digital nomad'];
const COLORS = ['#c2410c', '#7c3aed', '#0f766e', '#be185d', '#b45309', '#2563eb', '#15803d', '#9333ea', '#a16207', '#db2777'];
const VIBES = ['Heritage', 'Sunsets', 'Food', 'Trek', 'Photography', 'Art', 'Family', 'Solo-friendly', 'Nightlife', 'Easy pace'];

// ---------------------------------------------------------------- account
export function Onboarding({ go }) {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({ name: '', username: '', city: '', style: STYLES[0], bio: '', color: COLORS[1] });
  const [touchedUser, setTouchedUser] = useState(false);
  const [kind, setKind] = useState('traveller'); // traveller | local
  const [local, setLocal] = useState({});
  const [agreed, setAgreed] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const suggested = f.name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '').slice(0, 18);
  const username = touchedUser ? f.username : suggested;
  const taken = !!state.users[username];
  const valid = USERNAME_RE.test(username);
  const canSubmit = f.name.trim().length >= 2 && valid && !taken && agreed && (kind === 'traveller' || localProfileValid(local));

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const now = new Date().toISOString();
    const base = { ...f, username, name: f.name.trim(), createdAt: now, privacy: { version: PRIVACY_VERSION, acceptedAt: now } };
    if (kind === 'local') {
      dispatch({ type: 'createAccount', user: { ...base, city: 'Udaipur', style: 'Local friend', type: 'local', local: { rating: null, reviews: 0, hosted: 0, ...local, pricing: { ...local.pricing, mode: 'paid' } } } });
      go('/hosting');
    } else {
      dispatch({ type: 'createAccount', user: { ...base, type: 'traveller' } });
      go('/start');
    }
  };

  return (
    <div className="onboard">
      <div className="hero">
        <p className="eyebrow">MIRAS · मिरास</p>
        <h1>Travel Udaipur together</h1>
        <p className="lead">Plan with friends in private groups, meet fellow travellers in public ones, explore solo – and book a DigiLocker-verified Udaipurite as your Local Friend. Create your profile to start – no login needed.</p>
        <p className="small muted">Your privacy matters to us – read our <PrivacyLink>privacy policy</PrivacyLink>.</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <h2>Create your account</h2>
        <div className="typepick">
          <button type="button" className={`typeopt ${kind === 'traveller' ? 'on' : ''}`} onClick={() => setKind('traveller')}>
            <strong>🧳 I’m a traveller</strong><span className="muted small">Visiting Udaipur – plan with groups or solo.</span>
          </button>
          <button type="button" className={`typeopt ${kind === 'local' ? 'on' : ''}`} onClick={() => setKind('local')}>
            <strong>🤝 I’m a local</strong><span className="muted small">From Udaipur – be a paid Local Friend to travellers.</span>
          </button>
        </div>
        <label>Your name
          <input value={f.name} onChange={set('name')} placeholder="e.g. Riya Kapoor" autoFocus required />
        </label>
        <label>MIRAS username <span className="muted">· friends add you with this</span>
          <div className="prefix-input">
            <span>@</span>
            <input value={username} onChange={(e) => { setTouchedUser(true); setF((x) => ({ ...x, username: e.target.value.toLowerCase() })); }} placeholder="riya_travels" />
          </div>
          {username && !valid && <small className="err">3–20 characters: lowercase letters, numbers, _ or .</small>}
          {username && valid && taken && <small className="err">@{username} is taken – try another.</small>}
          {username && valid && !taken && <small className="ok">@{username} is available</small>}
        </label>
        {kind === 'traveller' ? (
          <div className="row2">
            <label>Home city<input value={f.city} onChange={set('city')} placeholder="e.g. Pune" /></label>
            <label>Travel style
              <select value={f.style} onChange={set('style')}>{STYLES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
          </div>
        ) : (
          <div className="local-fields">
            <p className="muted small">Local Friends are a paid service – you set your fee. Verify your identity with DigiLocker to get listed.</p>
            <LocalProfileFields value={local} onChange={setLocal} name={f.name} />
          </div>
        )}
        <label>Short bio <span className="muted">(optional)</span><input value={f.bio} onChange={set('bio')} placeholder="What do you love about travelling?" /></label>
        <div className="colors" role="radiogroup" aria-label="Profile colour">
          {COLORS.map((c) => (
            <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF((x) => ({ ...x, color: c }))} aria-label={`Colour ${c}`} />
          ))}
        </div>
        <PrivacyConsent checked={agreed} onChange={setAgreed} who={kind} />
        {kind === 'local' && !localProfileValid(local) && <p className="err small">Still needed: {localProfileMissing(local).join(', ')}.</p>}
        <button className="btn primary block" disabled={!canSubmit}>{kind === 'local' ? 'Create local friend account' : 'Create account'}</button>
        <p className="muted small center">Just looking? <button type="button" className="link" onClick={() => { dispatch({ type: 'switchUser', username: 'meera_solo' }); go('/start'); }}>Continue as a demo traveller</button></p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- start choices
export function Start({ go }) {
  const { me, dispatch } = useStore();
  const options = [
    { k: 'create', icon: '✦', title: 'Make a group', text: 'Start a private trip for friends & family, or a public one anyone can join.', to: '/create' },
    { k: 'join', icon: '⌁', title: 'Join a group', text: 'Got an invite code from a friend? Enter it to join or request to join.', to: '/join' },
    { k: 'solo', icon: '◎', title: 'Travel solo & explore', text: 'Explore Udaipur on your own – and hop into public groups whenever you like.', solo: true, to: '/explore' },
    { k: 'public', icon: '☼', title: 'Browse public groups', text: 'Meet solo travellers and like-minded explorers heading the same way.', to: '/explore' },
    { k: 'events', icon: '🎟️', title: 'Discover events', text: 'Gigs, tech meetups, comedy, melas and workshops happening in Udaipur – book, set reminders, share with your group.', to: '/events' },
    { k: 'local', icon: '🤝', title: 'Find a local friend', text: 'A DigiLocker-verified Udaipurite who shows you their city, joins your chat and suggests plans – for a fee they set.', to: '/locals' },
  ];
  return (
    <div className="page">
      <div className="welcome">
        <Avatar user={me} size={56} />
        <div>
          <h1>Namaste, {me?.name?.split(' ')[0]}!</h1>
          <p className="muted">How would you like to travel?</p>
        </div>
      </div>
      <div className="choices">
        {options.map((o) => (
          <button key={o.k} className="choice" onClick={() => { dispatch({ type: 'setSolo', value: !!o.solo }); go(o.to); }}>
            <span className="choice-icon">{o.icon}</span>
            <strong>{o.title}</strong>
            <span className="muted">{o.text}</span>
          </button>
        ))}
      </div>
      <p className="center"><button className="link" onClick={() => go('/')}>Skip – take me to my groups</button></p>
    </div>
  );
}

// ---------------------------------------------------------------- group card
export function GroupCard({ g, go, children }) {
  const { state, userByName } = useStore();
  const role = roleIn(g, state.me);
  const leader = userByName(g.leader);
  const spots = g.maxMembers - g.members.length;
  return (
    <article className="gcard" onClick={() => go(`/group/${g.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`/group/${g.id}`)}>
      <div className="gcard-cover" data-dest={g.destination}>
        <Badge tone={g.type === 'private' ? 'dark' : 'light'}>{g.type === 'private' ? '🔒 Private' : '🌐 Public'}</Badge>
        {role === 'leader' && <Badge tone="gold">Leader</Badge>}
        {role === 'member' && <Badge tone="green">Joined</Badge>}
        {role === 'local' && <Badge tone="green">🤝 Local friend</Badge>}
        {g.localFriend && role !== 'local' && <Badge tone="light">🤝 Has a local</Badge>}
        {role === 'requested' && <Badge tone="amber">Requested</Badge>}
      </div>
      <div className="gcard-body">
        <h3>{g.name}</h3>
        <p className="muted small">{g.destination} · {fmtRange(g.startDate, g.endDate)}</p>
        <p className="gcard-desc">{g.description}</p>
        <div className="tags">{(g.vibe || []).slice(0, 3).map((v) => <span key={v} className="tag">{v}</span>)}</div>
        <div className="gcard-foot">
          <div className="stack">
            {g.members.slice(0, 4).map((m) => <Avatar key={m} user={userByName(m)} size={26} />)}
            <span className="muted small">{g.members.length}/{g.maxMembers} · led by {leader?.name?.split(' ')[0]}</span>
          </div>
          {spots <= 2 && spots > 0 && <span className="small warn">{spots} spot{spots > 1 ? 's' : ''} left</span>}
          {spots <= 0 && <span className="small warn">Full</span>}
        </div>
        {children && <div className="gcard-actions" onClick={(e) => e.stopPropagation()}>{children}</div>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- explore public groups
export function Explore({ go }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [dest, setDest] = useState('All');
  const publics = state.groups.filter((g) => g.type === 'public');
  const dests = ['All', ...new Set(publics.map((g) => g.destination))];
  const list = publics.filter((g) => (dest === 'All' || g.destination === dest)
    && (`${g.name} ${g.description} ${(g.vibe || []).join(' ')}`).toLowerCase().includes(q.toLowerCase()));

  const join = (g) => {
    if (g.members.length >= g.maxMembers) return toast('This group is full', 'warn');
    dispatch({ type: 'addMember', id: g.id, username: state.me });
    toast(`You joined ${g.name}`);
  };
  const leave = (g) => { dispatch({ type: 'removeMember', id: g.id, username: state.me }); toast(`You left ${g.name}`); };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Public groups</h1>
          <p className="muted">{state.soloMode ? 'Travelling solo – join any group for a day or the whole trip, and leave whenever you like.' : 'Anyone can join. Leave any time.'}</p>
        </div>
        {state.soloMode && <Badge tone="green">◎ Solo traveller</Badge>}
      </div>
      <div className="filters">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, vibe, food, trek…" />
        <div className="seg">{dests.map((d) => <button key={d} className={d === dest ? 'on' : ''} onClick={() => setDest(d)}>{d}</button>)}</div>
      </div>
      {list.length === 0 && <Empty title="No public groups match">Try another search, or <button className="link" onClick={() => go('/create')}>start your own</button>.</Empty>}
      <div className="grid">
        {list.map((g) => {
          const role = roleIn(g, state.me);
          return (
            <GroupCard key={g.id} g={g} go={go}>
              {role === 'none' && <button className="btn primary sm" onClick={() => join(g)}>Join group</button>}
              {role === 'member' && <button className="btn ghost sm" onClick={() => leave(g)}>Leave</button>}
              {role === 'leader' && <span className="small muted">You lead this group</span>}
            </GroupCard>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- join with a code
export function JoinByCode({ go }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const found = useMemo(() => state.groups.find((g) => g.code.toUpperCase() === code.trim().toUpperCase()), [code, state.groups]);
  const role = found ? roleIn(found, state.me) : 'none';

  const act = () => {
    if (!found) return;
    if (role === 'leader' || role === 'member' || role === 'local') return go(`/group/${found.id}`);
    if (found.members.length >= found.maxMembers) return toast('This group is full', 'warn');
    if (found.type === 'public') {
      dispatch({ type: 'addMember', id: found.id, username: state.me });
      toast(`You joined ${found.name}`);
      go(`/group/${found.id}`);
    } else {
      dispatch({ type: 'request', id: found.id, username: state.me, message: msg.trim() });
      toast('Request sent – the leader will review it');
    }
  };

  return (
    <div className="page narrow">
      <h1>Join with a code</h1>
      <p className="muted">Ask your group leader for their MIRAS invite code (it looks like <code>MIR-LAKE42</code>).</p>
      <div className="card">
        <label>Invite code
          <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MIR-XXXXXX" autoFocus />
        </label>
        {code.length >= 6 && !found && <p className="err small">No group found with that code.</p>}
        {found && (
          <div className="found">
            <GroupCard g={found} go={go} />
            {found.type === 'private' && role === 'none' && (
              <label>Message to the leader <span className="muted">(optional)</span>
                <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hi! Priya told me about this trip…" />
              </label>
            )}
            {role === 'requested' ? (
              <div className="notice">⏳ Your request is waiting for the leader. <button className="link" onClick={() => { dispatch({ type: 'cancelRequest', id: found.id, username: state.me }); toast('Request cancelled'); }}>Cancel request</button></div>
            ) : (
              <button className="btn primary block" onClick={act}>
                {role === 'leader' || role === 'member' ? 'Open group' : found.type === 'public' ? 'Join group' : 'Request to join'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- create a group
export function CreateGroup({ go }) {
  const { state, dispatch, uid } = useStore();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ name: '', type: 'private', destination: 'Udaipur', startDate: today, endDate: later, description: '', maxMembers: 8, vibe: [] });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggleVibe = (v) => setF((x) => ({ ...x, vibe: x.vibe.includes(v) ? x.vibe.filter((y) => y !== v) : [...x.vibe, v] }));
  const ok = f.name.trim().length >= 3 && f.endDate >= f.startDate;

  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const id = uid('g');
    dispatch({
      type: 'createGroup',
      group: { ...f, id, name: f.name.trim(), maxMembers: +f.maxMembers || 8, leader: state.me, members: [state.me], requests: [], code: makeCode(), itinerary: [], suggestions: [], polls: [], messages: [{ id: uid('m'), kind: 'system', text: `${state.users[state.me]?.name?.split(' ')[0]} created the group`, at: new Date().toISOString() }], createdAt: new Date().toISOString() },
    });
    toast(`${f.type === 'private' ? 'Private' : 'Public'} group created`);
    go(`/group/${id}`);
  };

  return (
    <div className="page narrow">
      <h1>Make a group</h1>
      <form className="card form" onSubmit={submit}>
        <div className="typepick">
          {[
            ['private', '🔒 Private', 'Only people you add or approve. Share a code to invite.'],
            ['public', '🌐 Public', 'Anyone can join and leave – great for solo travellers.'],
          ].map(([v, t, d]) => (
            <button type="button" key={v} className={`typeopt ${f.type === v ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, type: v }))}>
              <strong>{t}</strong><span className="muted small">{d}</span>
            </button>
          ))}
        </div>
        <label>Group name<input value={f.name} onChange={set('name')} placeholder="e.g. College Gang – Udaipur 2026" required /></label>
        <div className="row2">
          <label>Destination<input value={f.destination} onChange={set('destination')} /></label>
          <label>Max members<input type="number" min="2" max="50" value={f.maxMembers} onChange={set('maxMembers')} /></label>
        </div>
        <div className="row2">
          <label>Start date<input type="date" value={f.startDate} onChange={set('startDate')} /></label>
          <label>End date<input type="date" value={f.endDate} min={f.startDate} onChange={set('endDate')} /></label>
        </div>
        <label>Description<textarea rows="3" value={f.description} onChange={set('description')} placeholder="What's the plan? Who is it for?" /></label>
        <div>
          <span className="label">Vibe</span>
          <div className="tags pick">{VIBES.map((v) => <button type="button" key={v} className={`tag ${f.vibe.includes(v) ? 'on' : ''}`} onClick={() => toggleVibe(v)}>{v}</button>)}</div>
        </div>
        <button className="btn primary block" disabled={!ok}>Create group</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- my groups (home)
export function MyGroups({ go }) {
  const { state, me } = useStore();
  const mine = state.groups.filter((g) => ['leader', 'member', 'local'].includes(roleIn(g, state.me)));
  const pending = state.groups.filter((g) => roleIn(g, state.me) === 'requested');
  const leading = mine.filter((g) => g.leader === state.me);
  const todo = leading.reduce((n, g) => n + g.requests.length + g.suggestions.filter((s) => s.status === 'pending').length, 0);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My groups</h1>
          <p className="muted">{mine.length ? `${mine.length} trip${mine.length > 1 ? 's' : ''}${todo ? ` · ${todo} item${todo > 1 ? 's' : ''} need your decision` : ''}` : 'You are not in any group yet.'}</p>
        </div>
        <div className="btnrow">
          <button className="btn ghost" onClick={() => go('/join')}>Join with code</button>
          <button className="btn primary" onClick={() => go('/create')}>+ Make a group</button>
        </div>
      </div>
      {mine.length === 0 && (
        <Empty title={`${me?.name?.split(' ')[0] || 'Hey'}, start your first trip`} action={<div className="btnrow center"><button className="btn primary" onClick={() => go('/create')}>Make a group</button><button className="btn ghost" onClick={() => go('/explore')}>Browse public groups</button></div>}>
          Make a group, join one with a code, or hop into a public group.
        </Empty>
      )}
      <div className="grid">{mine.map((g) => <GroupCard key={g.id} g={g} go={go} />)}</div>
      {pending.length > 0 && (
        <>
          <h2 className="section">Waiting for approval</h2>
          <div className="grid">{pending.map((g) => <GroupCard key={g.id} g={g} go={go} />)}</div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- profile + demo switcher
export function Profile({ go }) {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [bio, setBio] = useState(me?.bio || '');
  const [name, setName] = useState(me?.name || '');
  const verifiedLocal = me?.type === 'local' && ['verified', 'review'].includes(verificationState(me.local?.verification));
  const saveName = () => {
    const n = name.trim();
    if (n.length < 2 || n === me.name) { setName(me.name); return; }
    if (verifiedLocal && !window.confirm('Changing your name means you must verify with DigiLocker again. Until then you’re hidden from the directory. Continue?')) { setName(me.name); return; }
    dispatch({ type: 'updateProfile', patch: { name: n } });
    toast(verifiedLocal ? 'Name changed – please verify again in Hosting' : 'Name updated');
  };
  const others = Object.values(state.users).filter((u) => u.username !== state.me);
  return (
    <div className="page narrow">
      <div className="card profile">
        <Avatar user={me} size={72} />
        <h1>{me?.name}</h1>
        <p className="muted">@{me?.username} · {me?.city || 'Somewhere in India'} · {me?.style}</p>
        <label className="left">Name<input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          {me?.type === 'local' && <small className="muted">Changing your name requires DigiLocker verification again.</small>}
        </label>
        <label className="left">Bio<input value={bio} onChange={(e) => setBio(e.target.value)} onBlur={() => { dispatch({ type: 'updateProfile', patch: { bio } }); }} /></label>
        <p className="small muted">Share your username <strong>@{me?.username}</strong> so group leaders can add you.</p>
        <p className="small">🎟 {Object.values(state.eventPrefs?.[state.me] || {}).filter((x) => x.attended).length} events attended · {Object.values(state.eventPrefs?.[state.me] || {}).filter((x) => x.going && !x.attended).length} going · <button className="link" onClick={() => go('/events?tab=mine')}>My events</button></p>
        {me?.type !== 'local' && <p className="small">Your guest rating <span className="muted">(only Local Friends see this)</span>: <GuestRating username={me?.username} showTags /></p>}
        <p className="small muted">{me?.privacy ? `Privacy policy v${me.privacy.version} accepted ${new Date(me.privacy.acceptedAt).toLocaleDateString('en-IN')}` : 'Privacy policy'} · <PrivacyLink>Read it</PrivacyLink></p>
      </div>
      {me?.type !== 'local' && <BecomeLocal go={go} />}
      <div className="card">
        <h3>Demo: view as another traveller</h3>
        <p className="muted small">No login yet – switch traveller to try the leader and member sides of the same group.</p>
        <div className="userlist">
          {others.map((u) => (
            <UserLine key={u.username} user={u} sub={u.style} right={<button className="btn ghost sm" onClick={() => { dispatch({ type: 'switchUser', username: u.username }); toast(`Now viewing as ${u.name}`); go('/'); }}>Switch</button>} />
          ))}
        </div>
      </div>
      <div className="card">
        <h3>🛡 Trust & safety console (demo)</h3>
        <p className="muted small">Approve DigiLocker reviews, suspend or restore verified tags, handle reports and appeals.</p>
        <button className="btn ghost" onClick={() => go('/admin')}>Open admin console</button>
      </div>
      <div className="card">
        <h3>Reset</h3>
        <p className="muted small">Restore the original demo travellers and groups (your created data will be cleared).</p>
        <div className="btnrow">
          <button className="btn danger" onClick={() => { if (confirmReset()) { dispatch({ type: 'reset' }); go('/'); } }}>Reset demo data</button>
          <button className="btn ghost" onClick={() => { dispatch({ type: 'switchUser', username: null }); go('/'); }}>Create a new traveller</button>
        </div>
      </div>
    </div>
  );
}
const confirmReset = () => window.confirm('Reset all MIRAS Groups data in this browser?');
export const DEMO_USERS = Object.keys(MOCK_USERS);

function BecomeLocal({ go }) {
  const { dispatch, me } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState({});
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="card">
      <h3>🤝 Live in Udaipur?</h3>
      <p className="muted small">Become a Local Friend: help travellers explore your city, join their group chats and suggest plans – a paid service at a fee you set. DigiLocker identity verification is required.</p>
      {!open ? <button className="btn ghost" onClick={() => setOpen(true)}>Become a local friend</button> : (
        <>
          <LocalProfileFields value={local} onChange={setLocal} name={me?.name} />
          <PrivacyConsent checked={agreed} onChange={setAgreed} who="local" />
          {!localProfileValid(local) && <p className="err small">Still needed: {localProfileMissing(local).join(', ')}.</p>}
          <button className="btn primary block" disabled={!localProfileValid(local) || !agreed} onClick={() => { dispatch({ type: 'acceptPrivacy', version: PRIVACY_VERSION }); dispatch({ type: 'saveLocalProfile', local: { ...local, pricing: { ...local.pricing, mode: 'paid' } } }); toast('You are now a Local Friend 🤝'); go('/hosting'); }}>Save & start hosting</button>
        </>
      )}
    </div>
  );
}
