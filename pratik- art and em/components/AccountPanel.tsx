'use client';
import Link from 'next/link';
import { SpotImage } from './SpotImage';
import imageData from '@/content/spot-images.json';
import { AccountBackup } from './AccountBackup';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Member, Role } from '@/lib/community/store';
import { communityRequest } from '@/lib/community/client';

export function AccountPanel({ initialUser }: { initialUser: Member | null }) {
  const [user, setUser] = useState(initialUser);
  const [selectedRole, setSelectedRole] = useState<Role>('visitor');
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const router = useRouter();

  async function submit(form: HTMLFormElement, action: string) {
    setBusy(true);
    setError('');
    setMessage('');
    const fields = Object.fromEntries(new FormData(form));

    try {
      const payload: Record<string, unknown> = { ...fields, action };
      if (action === 'register') {
        payload.role = selectedRole;
      }
      const result = await communityRequest<{ ok: true; user?: Member; recoveryCode?: string }>(
        '/api/account',
        payload
      );
      if (result.user) setUser(result.user);
      if (result.recoveryCode) setCode(result.recoveryCode);
      if (action === 'logout' || action === 'delete') {
        setUser(null);
        setCode('');
        setMode('login');
      }
      setMessage(
        action === 'update'
          ? 'Profile saved.'
          : action === 'password'
          ? 'Password changed. Other sessions have been signed out.'
          : action === 'delete'
          ? 'Account deleted.'
          : action === 'logout'
          ? 'Signed out.'
          : 'You’re signed in.'
      );
      form.reset();
      router.refresh();
      // Role-aware redirect on login or register
      if ((action === 'login' || action === 'register') && result.user) {
        if (result.user.role === 'artisan') {
          router.push('/artisan/dashboard');
        } else if (result.user.role === 'event_manager') {
          router.push('/event-manager/dashboard');
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-panel social-screen">
      <header>
        <p className="discovery-eyebrow">YOUR MIRAS</p>
        <h1>{user ? `Welcome, ${user.name}` : 'Welcome to MIRAS'}</h1>
        <p>
          {user
            ? `Signed in as @${user.username} (${user.role === 'artisan' ? 'Artisan' : user.role === 'event_manager' ? 'Event Manager' : 'Visitor'})`
            : 'Choose how you want to continue in Udaipur.'}
        </p>
      </header>

      {error && <p role="alert" className="social-error">{error}</p>}
      {message && <p role="status">{message}</p>}

      {code && (
        <section className="recovery-code" aria-labelledby="recovery-title">
          <h2 id="recovery-title">Save your recovery code</h2>
          <p>
            This is shown once. Store it somewhere safe: you’ll need it if you forget your password. Recovery rotates
            the code and signs out all sessions.
          </p>
          <code>{code}</code>
          <button className="feature-secondary" onClick={() => setCode('')}>
            I have saved my code
          </button>
        </section>
      )}

      {!user ? (
        <>
          <SpotImage photo={imageData.photos['pichhola']} name="Lake Pichola" />

          {/* Account Type / Role Selection */}
          <div className="space-y-3 my-4">
            <p className="text-xs font-semibold tracking-wider text-muted-paper uppercase">Account Type</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('visitor')}
                className={`p-3 rounded-2xl border text-center transition ${
                  selectedRole === 'visitor'
                    ? 'border-[#101718] bg-white shadow-sm font-semibold'
                    : 'border-line bg-paper/60 text-muted-paper'
                }`}
              >
                <div className="text-sm">Visitor</div>
                <div className="text-[11px] text-muted-paper font-normal mt-0.5">Explore &amp; Save</div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('artisan')}
                className={`p-3 rounded-2xl border text-center transition ${
                  selectedRole === 'artisan'
                    ? 'border-[#101718] bg-white shadow-sm font-semibold'
                    : 'border-line bg-paper/60 text-muted-paper'
                }`}
              >
                <div className="text-sm">Artisan</div>
                <div className="text-[11px] text-muted-paper font-normal mt-0.5">Shop &amp; Crafts</div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('event_manager')}
                className={`p-3 rounded-2xl border text-center transition ${
                  selectedRole === 'event_manager'
                    ? 'border-[#101718] bg-white shadow-sm font-semibold'
                    : 'border-line bg-paper/60 text-muted-paper'
                }`}
              >
                <div className="text-sm">Event Mgr</div>
                <div className="text-[11px] text-muted-paper font-normal mt-0.5">Events &amp; Walks</div>
              </button>
            </div>
          </div>

          {selectedRole === 'artisan' && (
            <div className="p-3.5 bg-white/80 rounded-2xl border border-line text-xs text-muted-paper mb-3 space-y-1">
              <strong className="text-ink block">Artisan Business Account</strong>
              <p>Sign in to manage your workshop, craft listings and customer enquiries.</p>
              <p className="pt-1">
                New artisan?{' '}
                <Link href="/artisans/register" className="font-semibold text-ink underline">
                  Complete full shop registration ↗
                </Link>
              </p>
            </div>
          )}

          {selectedRole === 'event_manager' && (
            <div className="p-3.5 bg-white/80 rounded-2xl border border-line text-xs text-muted-paper mb-3 space-y-1">
              <strong className="text-ink block">Event Manager Account</strong>
              <p>Host heritage walks, cultural performances and workshops in Udaipur.</p>
              <p className="pt-1">
                New organizer?{' '}
                <Link href="/events/register" className="font-semibold text-ink underline">
                  Register organizer profile ↗
                </Link>
              </p>
            </div>
          )}

          <div className="journal-tabs" role="group" aria-label="Account action">
            {[
              ['login', 'Sign in'],
              ['register', 'Create account'],
              ['recover', 'Recover'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value as typeof mode);
                  setError('');
                  setMessage('');
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            key={`${selectedRole}-${mode}`}
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget, mode);
            }}
            className="social-form"
          >
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <small>3–24 letters, numbers or underscores.</small>
            {mode === 'register' && (
              <label>
                Your name
                <input name="name" required minLength={2} maxLength={60} autoComplete="name" />
              </label>
            )}
            {mode === 'recover' && (
              <label>
                Recovery code
                <input
                  name="recoveryCode"
                  required
                  pattern="[a-f0-9]{48}"
                  maxLength={48}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            )}
            <label>
              {mode === 'recover' ? 'New password' : 'Password'}
              <input
                name="password"
                required
                type="password"
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {mode !== 'login' && (
              <small>Use a unique password of at least 12 characters. Accounts start private.</small>
            )}
            <button className="feature-primary" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'register'
                ? `Create ${selectedRole === 'artisan' ? 'artisan' : selectedRole === 'event_manager' ? 'event manager' : 'visitor'} account`
                : mode === 'recover'
                ? 'Recover my account'
                : 'Sign in'}
            </button>
          </form>
          <p className="social-muted">
            No email address is required. Without your password or recovery code, this account cannot be recovered.
          </p>
        </>
      ) : (
        <>
          {/* Professional Role Dashboards */}
          {(user.role === 'artisan' || user.username === '123') && (
            <div className="p-4 bg-white rounded-3xl border border-line shadow-sm space-y-3 my-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold tracking-wider text-muted-paper">Artisan Workspace</span>
                <span className="text-xs bg-ink text-white px-2.5 py-0.5 rounded-full font-medium">Artisan</span>
              </div>
              <h2 className="text-xl font-medium">Manage Your Craft &amp; Shop</h2>
              <p className="text-xs text-muted-paper">
                Update your product catalogue, manage craft workshops, respond to visitor enquiries, and connect as a Local Friend.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/artisan/dashboard"
                  className="w-full text-center py-2.5 bg-[#101718] text-white rounded-full font-medium text-sm transition hover:opacity-90"
                >
                  Open Artisan Dashboard ↗
                </Link>
                <Link
                  href="/artisans"
                  className="w-full text-center py-2 border border-line bg-paper/50 rounded-full font-medium text-sm text-ink transition hover:bg-paper"
                >
                  Explore Public Artisans ↗
                </Link>
              </div>
            </div>
          )}

          {(user.role === 'event_manager' || user.username === '123') && (
            <div className="p-4 bg-white rounded-3xl border border-line shadow-sm space-y-3 my-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold tracking-wider text-muted-paper">Event Management</span>
                <span className="text-xs bg-ink text-white px-2.5 py-0.5 rounded-full font-medium">Event Manager</span>
              </div>
              <h2 className="text-xl font-medium">Manage Your Events &amp; Walks</h2>
              <p className="text-xs text-muted-paper">
                Create heritage walks, workshops, cultural gatherings, manage attendee inquiries, and act as a Local Friend.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/event-manager/dashboard"
                  className="w-full text-center py-2.5 bg-[#101718] text-white rounded-full font-medium text-sm transition hover:opacity-90"
                >
                  Open Event Manager Dashboard ↗
                </Link>
                <Link
                  href="/events"
                  className="w-full text-center py-2 border border-line bg-paper/50 rounded-full font-medium text-sm text-ink transition hover:bg-paper"
                >
                  Explore Public Events ↗
                </Link>
              </div>
            </div>
          )}

          {user.role === 'visitor' && (
            <div className="p-4 bg-white/70 rounded-3xl border border-line space-y-2 my-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold tracking-wider text-muted-paper">Professional Access</span>
                <span className="text-xs bg-paper border border-line text-muted-paper px-2.5 py-0.5 rounded-full font-medium">Visitor</span>
              </div>
              <p className="text-xs text-muted-paper">
                Are you a local maker or experience organizer? Register a professional profile to list your craft or host events in Udaipur.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/artisans/register"
                  className="text-center py-2 border border-line bg-white rounded-full text-xs font-medium hover:border-ink transition"
                >
                  Register as Artisan ↗
                </Link>
                <Link
                  href="/events/register"
                  className="text-center py-2 border border-line bg-white rounded-full text-xs font-medium hover:border-ink transition"
                >
                  Register Event Manager ↗
                </Link>
              </div>
            </div>
          )}

          <nav className="social-account-links">
            <Link href={`/people/${user.username}`}>My social profile ↗</Link>
            <Link href="/discover/community">Community ↗</Link>
            <Link href="/journeys">Journeys &amp; badges ↗</Link>
            <Link href="/local-friends">Explore Local Friends ↗</Link>
          </nav>

          <form
            className="social-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget, 'update');
            }}
          >
            <h2>Profile &amp; privacy</h2>
            <label>
              Display name
              <input name="name" defaultValue={user.name} minLength={2} maxLength={60} required />
            </label>
            <label>
              About you
              <textarea name="bio" defaultValue={user.bio} maxLength={280} />
            </label>
            <label>
              Profile visibility
              <select name="privacy" defaultValue={user.privacy}>
                <option value="private">Private — approve followers</option>
                <option value="public">Public — anyone can see public posts</option>
              </select>
            </label>
            <p className="social-muted">
              Your name, username and bio are discoverable. Private profiles show posts only to approved followers.
              Switching to public approves pending requests.
            </p>
            <button className="feature-primary" disabled={busy}>
              Save profile
            </button>
          </form>

          <AccountBackup />
          <Connections />

          <details className="social-settings">
            <summary>Change password</summary>
            <form
              className="social-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, 'password');
              }}
            >
              <label>
                Current password
                <input name="oldPassword" required type="password" maxLength={128} autoComplete="current-password" />
              </label>
              <label>
                New password
                <input name="password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" />
              </label>
              <button className="feature-secondary" disabled={busy}>
                Change password
              </button>
            </form>
          </details>

          <button
            className="feature-secondary"
            disabled={busy}
            onClick={() => void submit(document.createElement('form'), 'logout')}
          >
            Sign out
          </button>

          <details className="social-settings">
            <summary>Delete account</summary>
            <p>
              This permanently deletes your profile, posts, photos, comments, relationships and recorded journeys from the server.
              Device-only bookmarks and offline copies stay on this device.
            </p>
            <form
              className="social-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, 'delete');
              }}
            >
              <label>
                Confirm with your password
                <input type="password" name="password" required maxLength={128} autoComplete="current-password" />
              </label>
              <label className="social-check">
                <input type="checkbox" required />
                I understand this permanently deletes my account.
              </label>
              <button className="feature-secondary" disabled={busy}>
                Permanently delete my account
              </button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}

type ConnectionsData = {
  requests: { id: string; username: string; name: string }[];
  followers: { id: string; username: string; name: string }[];
  blocks: { username: string; name: string }[];
};

function Connections() {
  const [data, setData] = useState<ConnectionsData | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setData(await communityRequest<ConnectionsData>('/api/community?view=connections'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function act(value: Record<string, unknown>) {
    try {
      await communityRequest('/api/community', value);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="social-connections">
      <h2>Followers &amp; requests</h2>
      <button className="feature-secondary" onClick={() => void load()}>
        Load connections
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <h3>Follow requests ({data.requests.length})</h3>
          {data.requests.map((person) => (
            <div key={person.id}>
              <Link href={`/people/${person.username}`}>@{person.username}</Link>
              <button onClick={() => void act({ action: 'request', follower: person.id, approve: true })}>Approve</button>
              <button onClick={() => void act({ action: 'request', follower: person.id, approve: false })}>Decline</button>
            </div>
          ))}
          <h3>Approved followers ({data.followers.length})</h3>
          {data.followers.map((person) => (
            <div key={person.id}>
              <Link href={`/people/${person.username}`}>@{person.username}</Link>
              <button onClick={() => void act({ action: 'removeFollower', follower: person.id })}>Remove follower</button>
            </div>
          ))}
          <h3>Blocked accounts ({data.blocks.length})</h3>
          {data.blocks.map((person) => (
            <div key={person.username}>
              <span>@{person.username}</span>
              <button onClick={() => void act({ action: 'block', username: person.username, blocked: false })}>Unblock</button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
