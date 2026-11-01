import { useEffect, useState } from 'react';
import { roleIn, useStore } from './store.jsx';
import { Avatar } from './components/ui.jsx';
import { CreateGroup, Explore, JoinByCode, MyGroups, Onboarding, Profile, Start } from './components/pages.jsx';
import { GroupPage } from './components/GroupPage.jsx';
import { Hosting, LocalFriends } from './components/Locals.jsx';
import { Admin } from './components/Admin.jsx';
import { EventsPage } from './components/Events.jsx';
import { NoticesBell } from './components/Reviews.jsx';

// Tiny hash router: #/  #/start  #/explore  #/join  #/create  #/me  #/group/:id
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => { setPath(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (p) => { window.location.hash = p; };
  return [path, go];
}

export default function App() {
  const { state, me, dispatch } = useStore();
  const [path, go] = useHashRoute();
  const [menu, setMenu] = useState(false);

  if (!me) return <main className="shell"><Onboarding go={go} /></main>;

  const isLocal = me.type === 'local';
  const [route, query] = path.split('?');
  const hostingTodo = (state.localRequests || []).filter((r) => r.local === state.me && r.status === 'pending').length;
  const todo = state.groups
    .filter((g) => roleIn(g, state.me) === 'leader')
    .reduce((n, g) => n + g.requests.length + g.suggestions.filter((s) => s.status === 'pending').length, 0);

  let page;
  const m = route.match(/^\/group\/(.+)$/);
  if (m) page = <GroupPage id={m[1]} go={go} />;
  else if (route === '/start') page = isLocal ? <Hosting go={go} /> : <Start go={go} />;
  else if (route === '/explore') page = <Explore go={go} />;
  else if (route === '/join') page = <JoinByCode go={go} />;
  else if (route === '/create') page = <CreateGroup go={go} />;
  else if (route === '/me') page = <Profile go={go} />;
  else if (route === '/locals') page = <LocalFriends key={query} go={go} query={query} />;
  else if (route === '/hosting') page = <Hosting go={go} />;
  else if (route === '/admin') page = <Admin go={go} />;
  else if (route === '/events') page = <EventsPage key={query} go={go} query={query} />;
  else page = <MyGroups go={go} />;

  const nav = isLocal
    ? [['/hosting', 'Hosting', hostingTodo, 'Hosting'], ['/', 'My trips', todo, 'Trips'], ['/events', 'Events', 0, 'Events'], ['/locals', 'Local friends', 0, 'Locals'], ['/explore', 'Public groups', 0, 'Explore']]
    : [['/', 'My groups', todo, 'Groups'], ['/events', 'Events', 0, 'Events'], ['/locals', 'Local friends', 0, 'Locals'], ['/explore', 'Public groups', 0, 'Explore'], ['/join', 'Join with code', 0, 'Join'], ['/create', 'Make a group', 0, 'Create']];
  const active = (p) => (p === '/' ? route === '/' || route.startsWith('/group') : route === p);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => go('/')}>MIRAS<span>Groups</span></button>
        <nav className="mainnav">
          {nav.map(([p, label, n]) => (
            <button key={p} className={active(p) ? 'on' : ''} onClick={() => go(p)}>{label}{n ? <span className="count">{n}</span> : null}</button>
          ))}
        </nav>
        <NoticesBell go={go} />
        <div className="me-wrap">
          <button className="me" onClick={() => setMenu((x) => !x)} aria-expanded={menu}>
            <Avatar user={me} size={30} />
            <span className="me-text"><small>{isLocal ? 'Local friend' : 'Viewing as'}</small>@{me.username}</span>
          </button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { setMenu(false); go('/me'); }}>My profile</button>
              <button onClick={() => { setMenu(false); go('/start'); }}>Start options</button>
              <button onClick={() => { setMenu(false); go('/admin'); }}>🛡 Admin console (demo)</button>
              <hr />
              <span className="menu-label">Demo: switch traveller</span>
              {Object.values(state.users).filter((u) => u.username !== state.me && ['meera_solo', 'priya_wanders', 'kabir_foodie', 'rohan_trails', 'nandini_udaipur', 'arjun_mewar', 'zoya_lakeside', 'bhanu_hikes', 'kiran_kayak', 'manoj_tours'].includes(u.username)).map((u) => (
                <button key={u.username} onClick={() => { dispatch({ type: 'switchUser', username: u.username }); setMenu(false); }}>
                  <Avatar user={u} size={22} /> {u.name}{u.type === 'local' ? ' 🤝' : ''}
                </button>
              ))}
              <button onClick={() => { setMenu(false); go('/me'); }}>All travellers…</button>
            </div>
          )}
        </div>
      </header>
      <main>{page}</main>
      <nav className="bottomnav">
        {nav.map(([p, , n, short]) => (
          <button key={p} className={active(p) ? 'on' : ''} onClick={() => go(p)}>{short}{n ? <span className="dot" /> : null}</button>
        ))}
      </nav>
    </div>
  );
}
