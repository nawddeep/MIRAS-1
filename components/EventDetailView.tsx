'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type { CommunityEvent, TwoWayReview } from '@/lib/marketplace/store';

type Props = {
  event: CommunityEvent;
  initialReviews: TwoWayReview[];
  currentUser: Member | null;
};

export function EventDetailView({ event, initialReviews, currentUser }: Props) {
  const [reviews, setReviews] = useState(initialReviews);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Enquiry Form State
  const [enqForm, setEnqForm] = useState({
    name: currentUser?.name || '',
    contactBack: '',
    tickets: 1,
    message: '',
  });

  // Review Form State
  const [revForm, setRevForm] = useState({
    rating: 5,
    title: '',
    feedback: '',
  });

  const [busy, setBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const formattedTime = new Date(event.startsAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  async function handleSendEnquiry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAlertMsg('');
    setErrorMsg('');
    try {
      await communityRequest('/api/enquiries/event', {
        eventId: event.id,
        name: enqForm.name.trim(),
        contactBack: enqForm.contactBack.trim(),
        tickets: Number(enqForm.tickets),
        message: enqForm.message.trim(),
      }, 'POST');
      setAlertMsg('Your inquiry has been delivered to the organizer.');
      setShowEnquiryModal(false);
      setEnqForm({ name: '', contactBack: '', tickets: 1, message: '' });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      setErrorMsg('Please sign in to leave feedback.');
      return;
    }
    setBusy(true);
    setAlertMsg('');
    setErrorMsg('');
    try {
      const res = await communityRequest<{ ok: true; review: TwoWayReview }>('/api/reviews', {
        targetType: 'event',
        targetId: event.id,
        rating: Number(revForm.rating),
        title: revForm.title.trim(),
        feedback: revForm.feedback.trim(),
        interactionRef: `Attended ${event.title}`,
      }, 'POST');
      setReviews([res.review, ...reviews]);
      setAlertMsg('Thank you for your feedback!');
      setShowReviewModal(false);
      setRevForm({ rating: 5, title: '', feedback: '' });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Navigation */}
      <nav className="text-xs text-muted-paper">
        <Link href="/events" className="hover:text-ink underline">
          ← Back to All Events
        </Link>
      </nav>

      {/* Main Event Card */}
      <div className="bg-white rounded-3xl border border-line p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase font-semibold tracking-wider bg-paper border border-line px-3 py-1 rounded-full">
            {event.eventType.replace('_', ' ')}
          </span>
          <span className="text-base font-bold text-lake-deep font-display">{event.cost}</span>
        </div>

        <h1 className="text-3xl font-display font-medium text-ink">{event.title}</h1>

        <div className="p-3.5 bg-paper/60 rounded-2xl border border-line/60 space-y-1 text-xs">
          <p className="font-semibold text-ink">📅 {formattedTime} IST</p>
          <p className="text-muted-paper">📍 {event.location}</p>
        </div>

        <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line">{event.description}</p>

        {/* Details Grid */}
        <dl className="grid grid-cols-2 gap-3 text-xs border-t border-line/60 pt-3">
          <div>
            <dt className="text-muted-paper">Organized By</dt>
            <dd className="font-semibold text-ink mt-0.5">{event.organizerName}</dd>
          </div>
          <div>
            <dt className="text-muted-paper">Duration</dt>
            <dd className="font-semibold text-ink mt-0.5">{event.durationMinutes} Minutes</dd>
          </div>
          <div>
            <dt className="text-muted-paper">Language</dt>
            <dd className="font-semibold text-ink mt-0.5">{event.language}</dd>
          </div>
          <div>
            <dt className="text-muted-paper">Capacity</dt>
            <dd className="font-semibold text-ink mt-0.5">{event.capacity} Spots</dd>
          </div>
        </dl>

        {/* Workshop specific highlights */}
        {event.eventType === 'workshop' && (
          <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200/60 text-xs space-y-1.5">
            <strong className="text-purple-950 block">Workshop Specifics</strong>
            {event.craftSkill && <p><strong>Skill Focus:</strong> {event.craftSkill}</p>}
            {event.materialsProvided && <p><strong>Materials:</strong> {event.materialsProvided}</p>}
            {event.skillLevel && <p><strong>Level:</strong> {event.skillLevel}</p>}
          </div>
        )}

        {/* How to Book */}
        {event.howToBook && (
          <div className="p-4 bg-paper/50 rounded-2xl border border-line text-xs space-y-1">
            <strong className="text-ink block">How to Reserve / Attend</strong>
            <p className="text-muted-paper">{event.howToBook}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowEnquiryModal(true)}
            className="feature-primary w-full py-3 text-center text-sm font-medium"
          >
            Inquire or Reserve Spot with Organizer
          </button>
        </div>
      </div>

      {alertMsg && <p role="status" className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs">{alertMsg}</p>}
      {errorMsg && <p role="alert" className="social-error">{errorMsg}</p>}

      {/* FEEDBACK SECTION */}
      <section className="bg-white p-6 rounded-3xl border border-line space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Attendee Feedback ({reviews.length})</h2>
          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="feature-secondary px-3.5 py-1.5 text-xs rounded-full"
          >
            + Leave Feedback
          </button>
        </div>

        {reviews.length === 0 ? (
          <p className="text-xs text-muted-paper text-center py-4">
            No feedback left for this experience yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((rev) => (
              <li key={rev.id} className="p-3.5 bg-paper/40 rounded-2xl border border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">{rev.authorName}</span>
                  <span className="text-xs text-amber-600 font-bold">★ {rev.rating}/5</span>
                </div>
                <strong className="text-xs block text-ink">{rev.title}</strong>
                <p className="text-xs text-muted-paper">{rev.feedback}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ENQUIRY MODAL */}
      {showEnquiryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Inquiry for {event.title}</h3>
              <button
                type="button"
                onClick={() => setShowEnquiryModal(false)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSendEnquiry} className="social-form space-y-3">
              <label className="block text-sm font-medium">
                Your Name
                <input
                  required
                  value={enqForm.name}
                  onChange={(e) => setEnqForm({ ...enqForm, name: e.target.value })}
                  placeholder="e.g. Radhika"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Contact Phone or Email
                <input
                  required
                  value={enqForm.contactBack}
                  onChange={(e) => setEnqForm({ ...enqForm, contactBack: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Number of Attendees / Tickets
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={enqForm.tickets}
                  onChange={(e) => setEnqForm({ ...enqForm, tickets: Number(e.target.value) })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Questions or Message
                <textarea
                  required
                  rows={3}
                  value={enqForm.message}
                  onChange={(e) => setEnqForm({ ...enqForm, message: e.target.value })}
                  placeholder="Ask about accessibility, meeting points, children, or confirmation..."
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Sending…' : 'Send Inquiry to Organizer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Feedback for {event.title}</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            {!currentUser ? (
              <div className="p-4 bg-paper/60 rounded-2xl text-center space-y-2 text-xs">
                <p>Please sign in to leave attendee feedback.</p>
                <Link href="/account" className="feature-primary inline-block py-2 px-4">
                  Sign In ↗
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="social-form space-y-3">
                <label className="block text-sm font-medium">
                  Rating
                  <select
                    value={revForm.rating}
                    onChange={(e) => setRevForm({ ...revForm, rating: Number(e.target.value) })}
                    className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
                  >
                    <option value={5}>★★★★★ (5 - Outstanding)</option>
                    <option value={4}>★★★★☆ (4 - Good)</option>
                    <option value={3}>★★★☆☆ (3 - Average)</option>
                    <option value={2}>★★☆☆☆ (2 - Fair)</option>
                    <option value={1}>★☆☆☆☆ (1 - Poor)</option>
                  </select>
                </label>

                <label className="block text-sm font-medium">
                  Headline
                  <input
                    required
                    value={revForm.title}
                    onChange={(e) => setRevForm({ ...revForm, title: e.target.value })}
                    placeholder="e.g. Fascinating walk through stepwell history"
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Experience Feedback
                  <textarea
                    required
                    rows={4}
                    value={revForm.feedback}
                    onChange={(e) => setRevForm({ ...revForm, feedback: e.target.value })}
                    placeholder="What did you learn? How was the host?"
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit Feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
