'use client';

import { useState } from 'react';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type { LocalFriendProfile } from '@/lib/marketplace/store';

type Props = {
  friends: LocalFriendProfile[];
  currentUser: Member | null;
  initialRoleFilter?: string;
};

export function LocalFriendsDirectory({
  friends,
  currentUser,
  initialRoleFilter = 'all',
}: Props) {
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);
  const [selectedFriend, setSelectedFriend] = useState<LocalFriendProfile | null>(null);

  const [form, setForm] = useState({
    name: currentUser?.name || '',
    contact: '',
    dates: '',
    topics: '',
    message: '',
  });

  const [busy, setBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredFriends =
    roleFilter === 'all'
      ? friends
      : friends.filter((f) => f.role === roleFilter);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFriend) return;
    setBusy(true);
    setAlertMsg('');
    setErrorMsg('');
    try {
      await communityRequest('/api/local-friends', {
        friendAccountId: selectedFriend.accountId,
        senderName: form.name.trim(),
        senderContact: form.contact.trim(),
        dates: form.dates.trim(),
        topics: form.topics.trim(),
        message: form.message.trim(),
      }, 'POST');
      setAlertMsg(`Your connection request was sent to ${selectedFriend.displayName}! They will reply to your contact info.`);
      setSelectedFriend(null);
      setForm({ name: '', contact: '', dates: '', topics: '', message: '' });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="discovery-eyebrow">LOCAL EXPERTISE &amp; WELCOME</p>
        <h1 className="text-3xl font-display">Udaipur Local Friends</h1>
        <p className="text-sm text-ink-soft">
          Connect with trusted artisans and heritage experience managers who share living traditions and local wisdom.
        </p>
      </header>

      {/* Role Filter Tabs */}
      <div className="journal-tabs py-1" role="group" aria-label="Local Friends by role">
        {[
          { key: 'all', label: 'All Friends' },
          { key: 'artisan', label: 'Artisan Makers' },
          { key: 'event_manager', label: 'Heritage Organizers' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={roleFilter === tab.key}
            onClick={() => setRoleFilter(tab.key)}
            className="flex-1 text-xs py-2"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {alertMsg && <p role="status" className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs">{alertMsg}</p>}
      {errorMsg && <p role="alert" className="social-error">{errorMsg}</p>}

      {filteredFriends.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-line text-center space-y-2">
          <p className="text-sm font-medium">No Local Friends found.</p>
          <p className="text-xs text-muted-paper">
            Check back soon or filter by all categories.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredFriends.map((f) => (
            <li
              key={f.id}
              className="bg-white rounded-3xl border border-line p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#cbd9d2] text-ink flex items-center justify-center font-display text-xl font-bold">
                    {f.displayName.slice(0, 1)}
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-ink">{f.displayName}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider bg-paper border border-line px-2 py-0.5 rounded-full">
                        {f.role === 'artisan' ? 'Artisan Maker' : 'Event Organizer'}
                      </span>
                      {f.verificationStatus === 'verified' && (
                        <span className="text-[10px] bg-[#101718] text-white px-2 py-0.5 rounded-full font-medium">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFriend(f);
                    setForm((prev) => ({
                      ...prev,
                      topics: f.expertise.slice(0, 2).join(', '),
                    }));
                  }}
                  className="feature-primary px-3.5 py-1.5 text-xs"
                >
                  Connect ↗
                </button>
              </div>

              {f.introduction && (
                <p className="text-xs text-ink-soft leading-relaxed">{f.introduction}</p>
              )}

              {/* Expertise Tags */}
              {f.expertise.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {f.expertise.map((exp, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] bg-paper/70 border border-line px-2.5 py-0.5 rounded-full text-muted-paper"
                    >
                      {exp}
                    </span>
                  ))}
                </div>
              )}

              {/* Languages & Availability */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-paper border-t border-line/60 pt-2.5">
                <div>
                  <strong className="text-ink">Languages:</strong> {f.languages.join(', ')}
                </div>
                <div>
                  <strong className="text-ink">Availability:</strong> {f.availabilityNote || 'Flexible'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* CONNECT REQUEST MODAL */}
      {selectedFriend && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Connect with {selectedFriend.displayName}</h3>
              <button
                type="button"
                onClick={() => setSelectedFriend(null)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-muted-paper">
              Ask about {selectedFriend.role === 'artisan' ? 'studio visits, traditional craft techniques' : 'heritage routes, guided walks'} and local tips.
            </p>

            <form onSubmit={handleSendRequest} className="social-form space-y-3">
              <label className="block text-sm font-medium">
                Your Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Radhika"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Your Contact (WhatsApp, Phone or Email)
                <input
                  required
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Proposed Dates or Visiting Days
                <input
                  value={form.dates}
                  onChange={(e) => setForm({ ...form, dates: e.target.value })}
                  placeholder="e.g. This weekend or Oct 24-26"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Topics of Interest
                <input
                  value={form.topics}
                  onChange={(e) => setForm({ ...form, topics: e.target.value })}
                  placeholder="e.g. Traditional pigments, stepwells, architecture"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Message
                <textarea
                  required
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Share what you hope to discover or learn..."
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Sending…' : 'Send Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
