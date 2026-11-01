'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type {
  CommunityEvent,
  EventEnquiry,
  EventType,
  LocalFriendProfile,
  LocalFriendRequest,
  OrganizerProfile,
  TwoWayReview,
} from '@/lib/marketplace/store';

type Props = {
  user: Member;
  initialProfile: OrganizerProfile | null;
  initialEvents: CommunityEvent[];
  initialEnquiries: EventEnquiry[];
  initialFriendProfile: LocalFriendProfile | null;
  initialFriendRequests: LocalFriendRequest[];
  initialReviews: TwoWayReview[];
};

const EVENT_TYPES: { type: EventType; label: string }[] = [
  { type: 'heritage_walk', label: 'Heritage Walk' },
  { type: 'workshop', label: 'Cultural / Craft Workshop' },
  { type: 'cultural_performance', label: 'Cultural Performance' },
  { type: 'guided_experience', label: 'Guided Experience' },
  { type: 'festival', label: 'Festival / Celebration' },
  { type: 'exhibition', label: 'Exhibition' },
  { type: 'community_event', label: 'Community Gathering' },
  { type: 'other', label: 'Other Experience' },
];

export function EventManagerDashboard({
  user,
  initialProfile,
  initialEvents,
  initialEnquiries,
  initialFriendProfile,
  initialFriendRequests,
  initialReviews,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'events' | 'create' | 'enquiries' | 'friend' | 'feedback' | 'settings'
  >('overview');

  const [profile, setProfile] = useState(initialProfile);
  const [events, setEvents] = useState(initialEvents);
  const [enquiries, setEnquiries] = useState(initialEnquiries);
  const [friendProfile, setFriendProfile] = useState(initialFriendProfile);
  const [friendRequests, setFriendRequests] = useState(initialFriendRequests);
  const [reviews] = useState(initialReviews);

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Create Event Form State
  const [eventForm, setEventForm] = useState(() => ({
    eventType: 'heritage_walk' as EventType,
    title: '',
    description: '',
    location: profile?.locality || 'Clock Tower, Old City, Udaipur',
    startsAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    durationMinutes: 90,
    language: 'Hindi & English',
    capacity: 20,
    cost: '₹500',
    howToBook: 'Register via WhatsApp or email',
    craftSkill: '',
    materialsProvided: '',
    skillLevel: 'All levels',
    instructorInfo: profile?.organizationName || user.name,
  }));

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    organizationName: profile?.organizationName || `${user.name} Events`,
    description: profile?.description || '',
    contactInfo: profile?.contactInfo || '',
    locality: profile?.locality || 'Udaipur',
  });

  // Local Friend Edit State
  const [friendForm, setFriendForm] = useState({
    isEnabled: friendProfile?.isEnabled ?? false,
    displayName: friendProfile?.displayName || user.name,
    introduction: friendProfile?.introduction || '',
    expertise: friendProfile?.expertise?.join(', ') || 'Architecture, Stepwells & baoris, Photography spots',
    availabilityNote: friendProfile?.availabilityNote || 'Mornings and weekends',
    contactPreference: friendProfile?.contactPreference || 'WhatsApp or Email',
  });

  function clearAlerts() {
    setStatusMsg('');
    setErrorMsg('');
  }

  // Create Event
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      const isoStartsAt = new Date(eventForm.startsAt).toISOString();
      const res = await communityRequest<{ ok: true; event: CommunityEvent }>('/api/events', {
        ...eventForm,
        startsAt: isoStartsAt,
        durationMinutes: Number(eventForm.durationMinutes),
        capacity: Number(eventForm.capacity),
        status: 'published',
      }, 'POST');
      setEvents((prev) => [res.event, ...prev]);
      setStatusMsg('New event published successfully.');
      setActiveTab('events');
      setEventForm({
        eventType: 'heritage_walk',
        title: '',
        description: '',
        location: profile?.locality || 'Old City, Udaipur',
        startsAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
        durationMinutes: 90,
        language: 'Hindi & English',
        capacity: 20,
        cost: '₹500',
        howToBook: 'Register via WhatsApp or email',
        craftSkill: '',
        materialsProvided: '',
        skillLevel: 'All levels',
        instructorInfo: profile?.organizationName || user.name,
      });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Delete Event
  async function handleDeleteEvent(id: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    setBusy(true);
    clearAlerts();
    try {
      await communityRequest(`/api/events/${id}`, {}, 'DELETE');
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      setStatusMsg('Event removed.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Cancel Event
  async function handleCancelEvent(id: string) {
    if (!confirm('Mark this event as cancelled?')) return;
    setBusy(true);
    clearAlerts();
    try {
      const res = await communityRequest<{ ok: true; event: CommunityEvent }>(`/api/events/${id}`, {
        status: 'cancelled',
      }, 'PUT');
      setEvents((prev) => prev.map((ev) => (ev.id === id ? res.event : ev)));
      setStatusMsg('Event status updated to cancelled.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Save Profile Changes
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      const res = await communityRequest<{ ok: true; profile: OrganizerProfile }>('/api/event-manager/profile', {
        ...profileForm,
      }, 'PUT');
      setProfile(res.profile);
      setStatusMsg('Organizer profile saved.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Save Local Friend Opt-in
  async function handleSaveFriend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      const expList = friendForm.expertise.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await communityRequest<{ ok: true; profile: LocalFriendProfile }>('/api/local-friends', {
        action: 'toggle',
        isEnabled: friendForm.isEnabled,
        displayName: friendForm.displayName,
        introduction: friendForm.introduction,
        expertise: expList,
        availabilityNote: friendForm.availabilityNote,
        contactPreference: friendForm.contactPreference,
      }, 'PUT');
      setFriendProfile(res.profile);
      setStatusMsg(res.profile.isEnabled ? 'Local Friend profile enabled and discoverable.' : 'Local Friend profile disabled.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Respond to Friend Request
  async function handleRespondFriend(requestId: string, status: 'accepted' | 'declined') {
    const note = prompt(`Optional message to traveller (${status === 'accepted' ? 'e.g. Happy to meet at 8 AM for the walk' : 'Reason'}):`) || '';
    setBusy(true);
    clearAlerts();
    try {
      const res = await communityRequest<{ ok: true; request: LocalFriendRequest }>('/api/local-friends', {
        action: 'respond',
        requestId,
        status,
        responseNote: note,
      }, 'PUT');
      setFriendRequests((prev) => prev.map((r) => (r.id === res.request.id ? res.request : r)));
      setStatusMsg(`Request ${status}.`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Update Enquiry Status
  async function handleUpdateEnquiryStatus(enquiryId: string, status: 'replied' | 'archived') {
    setBusy(true);
    clearAlerts();
    try {
      const res = await communityRequest<{ ok: true; enquiry: EventEnquiry }>('/api/enquiries/event', {
        enquiryId,
        status,
      }, 'PUT');
      setEnquiries((prev) => prev.map((enq) => (enq.id === res.enquiry.id ? res.enquiry : enq)));
      setStatusMsg(`Enquiry marked as ${status}.`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: `My Events (${events.length})` },
    { id: 'create', label: '+ Create Event' },
    { id: 'enquiries', label: `Enquiries (${enquiries.length})` },
    { id: 'friend', label: 'Local Friend' },
    { id: 'feedback', label: `Feedback (${reviews.length})` },
    { id: 'settings', label: 'Settings' },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#101718] text-white px-2.5 py-0.5 rounded-full font-medium">Event Manager</span>
            {profile?.verificationStatus === 'verified' ? (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Verified Host</span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Registered Organizer</span>
            )}
          </div>
          <h1 className="text-3xl font-display mt-1">{profile?.organizationName || `${user.name}’s Events`}</h1>
          <p className="text-xs text-muted-paper">
            {profile?.locality || 'Udaipur, Rajasthan'} · Heritage Walks &amp; Cultural Experiences
          </p>
        </div>

        <Link
          href="/events"
          className="text-xs font-semibold px-4 py-2 border border-line rounded-full bg-white hover:bg-paper transition"
        >
          View Public Events ↗
        </Link>
      </header>

      {/* Notifications */}
      {statusMsg && <p role="status" className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs">{statusMsg}</p>}
      {errorMsg && <p role="alert" className="social-error">{errorMsg}</p>}

      {/* Navigation Tabs */}
      <nav className="journal-tabs overflow-x-auto py-1" aria-label="Event Manager sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              clearAlerts();
            }}
            className="whitespace-nowrap px-3 text-xs"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{events.length}</span>
              <p className="text-xs text-muted-paper mt-1">Events Managed</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{enquiries.filter((e) => e.status === 'new').length}</span>
              <p className="text-xs text-muted-paper mt-1">New Enquiries</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{friendRequests.length}</span>
              <p className="text-xs text-muted-paper mt-1">Friend Requests</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{reviews.length}</span>
              <p className="text-xs text-muted-paper mt-1">Feedback Items</p>
            </div>
          </div>

          <section className="bg-white p-5 rounded-3xl border border-line space-y-3">
            <h2 className="text-lg font-medium">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEventForm((prev) => ({ ...prev, eventType: 'heritage_walk' }));
                  setActiveTab('create');
                }}
                className="feature-primary py-2.5 text-xs text-center"
              >
                + Host Heritage Walk
              </button>
              <button
                type="button"
                onClick={() => {
                  setEventForm((prev) => ({ ...prev, eventType: 'workshop' }));
                  setActiveTab('create');
                }}
                className="feature-secondary py-2.5 text-xs text-center"
              >
                + Host Workshop
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('enquiries')}
                className="feature-secondary py-2.5 text-xs text-center"
              >
                View Inquiries ({enquiries.length})
              </button>
            </div>
          </section>

          <div className="bg-[#f0f5f7] p-4 rounded-3xl border border-line text-xs space-y-1.5">
            <strong className="text-ink block">Organizer Guidelines &amp; Scope</strong>
            <p className="text-muted-paper">
              As an Event Manager, you curate walking tours, stepwell immersions, workshops, and cultural gatherings.
              Your account is isolated to event management and does not manage commercial artisan shops.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: MY EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Managed Experiences &amp; Events</h2>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="feature-primary px-4 py-2 text-xs"
            >
              + Create Event
            </button>
          </div>

          {events.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-line text-center space-y-2">
              <p className="text-sm font-medium">No events created yet.</p>
              <p className="text-xs text-muted-paper">
                Host your first walking tour, stepwell exploration, or workshop.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="bg-white p-5 rounded-3xl border border-line space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-paper border border-line px-2.5 py-0.5 rounded-full font-medium">
                        {ev.eventType.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          ev.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-lake-deep">{ev.cost}</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium">{ev.title}</h3>
                    <p className="text-xs text-muted-paper mt-0.5">
                      {new Date(ev.startsAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      IST · {ev.durationMinutes} mins · {ev.capacity} spots max
                    </p>
                    <p className="text-xs text-ink-soft mt-1">{ev.location}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line/60">
                    <Link
                      href={`/events/${ev.id}`}
                      className="text-xs font-medium text-lake-deep underline"
                    >
                      View Public Page ↗
                    </Link>

                    <div className="flex gap-2">
                      {ev.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleCancelEvent(ev.id)}
                          className="px-3 py-1 border border-line rounded-full text-xs hover:border-ink"
                        >
                          Cancel Event
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="px-3 py-1 border border-rose-200 text-rose-700 bg-rose-50 rounded-full text-xs hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* TAB 3: CREATE EVENT */}
      {activeTab === 'create' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <h2 className="text-xl font-medium">Create New Event or Workshop</h2>
          <p className="text-xs text-muted-paper">
            Host a heritage walk, craft workshop, cultural performance, or gathering in Udaipur.
          </p>

          <form onSubmit={handleCreateEvent} className="social-form space-y-3">
            <label className="block text-sm font-medium">
              Event Type
              <select
                value={eventForm.eventType}
                onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value as EventType })}
                className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Title
              <input
                required
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="e.g. Old City Stepwells &amp; Pols Heritage Walk"
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Description
              <textarea
                required
                rows={4}
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Detail what attendees will see, hear, experience, and why it matters..."
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Starts At (Date and Time)
                <input
                  type="datetime-local"
                  required
                  value={eventForm.startsAt}
                  onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Duration (Minutes)
                <input
                  type="number"
                  min={15}
                  value={eventForm.durationMinutes}
                  onChange={(e) => setEventForm({ ...eventForm, durationMinutes: Number(e.target.value) })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>
            </div>

            <label className="block text-sm font-medium">
              Meeting Location / Venue
              <input
                required
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="e.g. Starts in front of Clock Tower (Ghanta Ghar), Old City"
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-sm font-medium">
                Cost
                <input
                  value={eventForm.cost}
                  onChange={(e) => setEventForm({ ...eventForm, cost: e.target.value })}
                  placeholder="e.g. ₹500 or Free"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Capacity
                <input
                  type="number"
                  min={1}
                  value={eventForm.capacity}
                  onChange={(e) => setEventForm({ ...eventForm, capacity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Language
                <input
                  value={eventForm.language}
                  onChange={(e) => setEventForm({ ...eventForm, language: e.target.value })}
                  placeholder="Hindi &amp; English"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>
            </div>

            <label className="block text-sm font-medium">
              How to Book / Attend Instructions
              <input
                value={eventForm.howToBook}
                onChange={(e) => setEventForm({ ...eventForm, howToBook: e.target.value })}
                placeholder="e.g. Direct message on WhatsApp +91 94140 12345 to reserve your spot"
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            {/* Workshop specific fields */}
            {eventForm.eventType === 'workshop' && (
              <div className="p-4 bg-paper/60 rounded-2xl space-y-3 border border-line">
                <p className="text-xs font-semibold text-ink uppercase tracking-wider">Workshop Particulars</p>

                <label className="block text-sm font-medium">
                  Craft / Skill Taught
                  <input
                    value={eventForm.craftSkill}
                    onChange={(e) => setEventForm({ ...eventForm, craftSkill: e.target.value })}
                    placeholder="e.g. Puppetry storytelling &amp; manipulation"
                    className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Materials Provided
                  <input
                    value={eventForm.materialsProvided}
                    onChange={(e) => setEventForm({ ...eventForm, materialsProvided: e.target.value })}
                    placeholder="e.g. Traditional puppet kits, strings, fabric"
                    className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Skill Level
                  <select
                    value={eventForm.skillLevel}
                    onChange={(e) => setEventForm({ ...eventForm, skillLevel: e.target.value })}
                    className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
                  >
                    <option value="All levels">All levels</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                  </select>
                </label>
              </div>
            )}

            <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
              {busy ? 'Publishing…' : 'Publish Event to MIRAS'}
            </button>
          </form>
        </section>
      )}

      {/* TAB 4: ENQUIRIES */}
      {activeTab === 'enquiries' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Attendee Inquiries ({enquiries.length})</h2>
            <span className="text-xs text-muted-paper">Messages from prospective attendees</span>
          </div>

          {enquiries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-paper">
              No inquiries received yet. When visitors have questions about tickets or schedules, they will appear here.
            </div>
          ) : (
            <ul className="space-y-3">
              {enquiries.map((enq) => (
                <li key={enq.id} className="p-4 bg-paper/50 rounded-2xl border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm font-medium">{enq.name}</strong>
                      <span className="text-xs text-muted-paper ml-2">({enq.tickets} ticket{enq.tickets > 1 ? 's' : ''})</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        enq.status === 'replied'
                          ? 'bg-emerald-100 text-emerald-800'
                          : enq.status === 'archived'
                          ? 'bg-paper text-muted-paper'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {enq.status}
                    </span>
                  </div>

                  <p className="text-xs text-muted-paper">Contact: <strong>{enq.contactBack}</strong></p>
                  <p className="text-xs text-ink bg-white p-3 rounded-xl border border-line/60">{enq.message}</p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-paper">{new Date(enq.createdAt).toLocaleDateString()}</span>
                    {enq.status === 'new' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateEnquiryStatus(enq.id, 'replied')}
                        className="px-3 py-1 bg-[#101718] text-white rounded-full text-xs"
                      >
                        Mark as Replied
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* TAB 5: LOCAL FRIEND */}
      {activeTab === 'friend' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Local Friend Availability</h2>
            <span className="text-xs text-muted-paper">Heritage Host Network</span>
          </div>

          <p className="text-xs text-muted-paper">
            Opting in allows interested travellers to connect with you for recommendations on heritage routes, architecture,
            and hidden stepwells in Udaipur.
          </p>

          <form onSubmit={handleSaveFriend} className="social-form space-y-3">
            <label className="flex items-center gap-2 p-3 bg-paper/60 rounded-2xl cursor-pointer">
              <input
                type="checkbox"
                checked={friendForm.isEnabled}
                onChange={(e) => setFriendForm({ ...friendForm, isEnabled: e.target.checked })}
              />
              <span className="text-xs font-semibold text-ink">
                Opt-in as a Local Friend (Visible on Local Friends page)
              </span>
            </label>

            <label className="block text-sm font-medium">
              Display Name
              <input
                value={friendForm.displayName}
                onChange={(e) => setFriendForm({ ...friendForm, displayName: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Introduction for Travellers
              <textarea
                rows={3}
                value={friendForm.introduction}
                onChange={(e) => setFriendForm({ ...friendForm, introduction: e.target.value })}
                placeholder="Share your passion for Udaipur's history and what experiences you enjoy hosting..."
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Expertise &amp; Topics (comma-separated)
              <input
                value={friendForm.expertise}
                onChange={(e) => setFriendForm({ ...friendForm, expertise: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Availability Note
              <input
                value={friendForm.availabilityNote}
                onChange={(e) => setFriendForm({ ...friendForm, availabilityNote: e.target.value })}
                placeholder="e.g. Early mornings on weekends, stepwell sunset walks"
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <button className="feature-primary w-full py-3 mt-2" disabled={busy}>
              {busy ? 'Saving…' : 'Save Local Friend Settings'}
            </button>
          </form>

          {/* Incoming Requests */}
          <div className="pt-4 border-t border-line space-y-3">
            <h3 className="text-lg font-medium">Incoming Requests ({friendRequests.length})</h3>
            {friendRequests.length === 0 ? (
              <p className="text-xs text-muted-paper">No connection requests yet.</p>
            ) : (
              <ul className="space-y-3">
                {friendRequests.map((req) => (
                  <li key={req.id} className="p-4 bg-paper/50 rounded-2xl border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm">{req.senderName}</strong>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          req.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'declined'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-paper">Contact: {req.senderContact}</p>
                    {req.dates && <p className="text-xs text-muted-paper">Dates: {req.dates}</p>}
                    <p className="text-xs text-ink">{req.message}</p>
                    {req.responseNote && <p className="text-xs italic text-lake-deep">Your note: {req.responseNote}</p>}

                    {req.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleRespondFriend(req.id, 'accepted')}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondFriend(req.id, 'declined')}
                          className="px-3 py-1 border border-line rounded-full text-xs"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* TAB 6: FEEDBACK */}
      {activeTab === 'feedback' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Attendee Feedback</h2>
            <span className="text-xs text-muted-paper">Verified Reviews</span>
          </div>

          <p className="text-xs text-muted-paper">
            Feedback and ratings from visitors who joined your walks and workshops.
          </p>

          {reviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-paper">
              No event feedback received yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {reviews.map((rev) => (
                <li key={rev.id} className="p-4 bg-paper/40 rounded-2xl border border-line space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{rev.authorName}</span>
                    <span className="text-xs text-amber-600 font-bold">★ {rev.rating}/5</span>
                  </div>
                  <strong className="text-xs block text-ink">{rev.title}</strong>
                  <p className="text-xs text-muted-paper">{rev.feedback}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* TAB 7: SETTINGS */}
      {activeTab === 'settings' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <h2 className="text-xl font-medium">Organizer Settings &amp; Organization Profile</h2>

          <form onSubmit={handleSaveProfile} className="social-form space-y-3">
            <label className="block text-sm font-medium">
              Organization Name
              <input
                required
                value={profileForm.organizationName}
                onChange={(e) => setProfileForm({ ...profileForm, organizationName: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              About the Organization
              <textarea
                rows={3}
                value={profileForm.description}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Contact Info
              <input
                required
                value={profileForm.contactInfo}
                onChange={(e) => setProfileForm({ ...profileForm, contactInfo: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Operating Locality
              <input
                value={profileForm.locality}
                onChange={(e) => setProfileForm({ ...profileForm, locality: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <button className="feature-primary w-full py-3 mt-2" disabled={busy}>
              {busy ? 'Saving…' : 'Save Organization Details'}
            </button>
          </form>

          <div className="pt-4 border-t border-line">
            <Link href="/account" className="feature-secondary py-2.5 px-4 text-xs inline-block">
              Open Main Account &amp; Password Settings ↗
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
