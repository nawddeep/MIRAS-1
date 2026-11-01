'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type {
  CommunityEvent,
  LocalFriendProfile,
  Product,
  Shop,
  TwoWayReview,
} from '@/lib/marketplace/store';

type Props = {
  shop: Shop;
  products: Product[];
  workshops: CommunityEvent[];
  friendProfile: LocalFriendProfile | null;
  initialReviews: TwoWayReview[];
  currentUser: Member | null;
};

export function ShopDetailView({
  shop,
  products,
  workshops,
  friendProfile,
  initialReviews,
  currentUser,
}: Props) {
  const [reviews, setReviews] = useState(initialReviews);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);

  // Enquiry Form State
  const [enquiryForm, setEnquiryForm] = useState({
    name: currentUser?.name || '',
    contactBack: '',
    message: '',
  });

  // Review Form State
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    feedback: '',
    interactionRef: 'Studio visit or purchase',
  });

  // Local Friend Request Form State
  const [friendForm, setFriendForm] = useState({
    name: currentUser?.name || '',
    contact: '',
    dates: '',
    topics: `${shop.craft} studio visit`,
    message: '',
  });

  const [busy, setBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];
  const filteredProducts =
    filterCategory === 'all'
      ? products
      : products.filter((p) => p.category === filterCategory);

  const avgRating = reviews.length
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  async function handleSendEnquiry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAlertMsg('');
    setErrorMsg('');
    try {
      // Post direct enquiry
      await communityRequest('/api/enquiries/event', {
        eventId: workshops[0]?.id || 'shop-enquiry',
        name: enquiryForm.name.trim(),
        contactBack: enquiryForm.contactBack.trim(),
        tickets: 1,
        message: `[Shop Enquiry for ${shop.name}]: ${enquiryForm.message.trim()}`,
      }, 'POST');
      setAlertMsg('Your enquiry has been sent directly to the artisan. They will contact you shortly.');
      setShowEnquiryModal(false);
      setEnquiryForm({ name: '', contactBack: '', message: '' });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      setErrorMsg('Please sign in to submit a review.');
      return;
    }
    setBusy(true);
    setAlertMsg('');
    setErrorMsg('');
    try {
      const res = await communityRequest<{ ok: true; review: TwoWayReview }>('/api/reviews', {
        targetType: 'shop',
        targetId: shop.id,
        rating: Number(reviewForm.rating),
        title: reviewForm.title.trim(),
        feedback: reviewForm.feedback.trim(),
        interactionRef: reviewForm.interactionRef.trim(),
      }, 'POST');
      setReviews([res.review, ...reviews]);
      setAlertMsg('Thank you! Your review has been published.');
      setShowReviewModal(false);
      setReviewForm({ rating: 5, title: '', feedback: '', interactionRef: '' });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendFriendRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAlertMsg('');
    setErrorMsg('');
    try {
      await communityRequest('/api/local-friends', {
        friendAccountId: shop.ownerAccountId,
        senderName: friendForm.name.trim(),
        senderContact: friendForm.contact.trim(),
        dates: friendForm.dates.trim(),
        topics: friendForm.topics.trim(),
        message: friendForm.message.trim(),
      }, 'POST');
      setAlertMsg('Your connection request has been sent to this Local Friend.');
      setShowFriendModal(false);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-line overflow-hidden shadow-sm">
        <div className="aspect-[16/7] bg-[#dbe5e7] relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shop.coverImage || '/media/placeholders/artisan-1.svg'}
            alt={shop.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold tracking-wider bg-paper border border-line px-3 py-1 rounded-full">
                {shop.craft}
              </span>
              {shop.verificationStatus === 'verified' ? (
                <span className="text-xs bg-[#101718] text-white px-2.5 py-0.5 rounded-full font-medium">
                  Verified Maker
                </span>
              ) : (
                <span className="text-xs bg-paper border border-line text-muted-paper px-2.5 py-0.5 rounded-full">
                  Self-Registered Maker
                </span>
              )}
            </div>

            {avgRating && (
              <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                <span>★</span> {avgRating} ({reviews.length} review{reviews.length > 1 ? 's' : ''})
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-display font-medium text-ink">{shop.name}</h1>
            <p className="text-xs text-muted-paper mt-1">
              {shop.locality || 'Udaipur, Rajasthan'} {shop.openingHours ? `· ${shop.openingHours}` : ''}
            </p>
          </div>

          <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line">{shop.description}</p>

          {shop.story && (
            <div className="p-4 bg-paper/50 rounded-2xl border border-line/60 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-paper">Artisan Story</span>
              <p className="text-xs text-ink leading-relaxed whitespace-pre-line">{shop.story}</p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowEnquiryModal(true)}
              className="feature-primary flex-1 py-3 text-xs text-center font-medium"
            >
              Send Enquiry to Maker
            </button>

            {friendProfile?.isEnabled && (
              <button
                type="button"
                onClick={() => setShowFriendModal(true)}
                className="feature-secondary py-3 px-5 text-xs text-center font-medium flex items-center gap-1.5"
              >
                <span>🤝</span> Connect as Local Friend
              </button>
            )}
          </div>
        </div>
      </div>

      {alertMsg && <p role="status" className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs">{alertMsg}</p>}
      {errorMsg && <p role="alert" className="social-error">{errorMsg}</p>}

      {/* PRODUCTS SECTION */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-display font-medium">Craft Collection</h2>
            <p className="text-xs text-muted-paper">Direct from the artisan&apos;s workshop in Udaipur</p>
          </div>
          <span className="text-xs text-muted-paper">{products.length} piece{products.length === 1 ? '' : 's'}</span>
        </div>

        {/* Category Pills */}
        {categories.length > 2 && (
          <div className="journal-tabs overflow-x-auto py-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={filterCategory === c}
                onClick={() => setFilterCategory(c)}
                className="whitespace-nowrap px-3 text-xs"
              >
                {c === 'all' ? 'All Pieces' : c}
              </button>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-line text-center text-xs text-muted-paper">
            No products in this category currently.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((p) => (
              <Link
                key={p.id}
                href={`/shops/${shop.slug}/products/${p.id}`}
                className="group block bg-white rounded-3xl border border-line overflow-hidden hover:border-ink transition shadow-sm"
              >
                <div className="aspect-[4/3] bg-paper relative overflow-hidden">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-muted-paper bg-[#e6eff1]">
                      🎨
                    </div>
                  )}
                  <span
                    className={`absolute top-3 left-3 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                      p.availability === 'in_stock'
                        ? 'bg-white/95 text-ink shadow-sm'
                        : p.availability === 'made_to_order'
                        ? 'bg-blue-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {p.availability === 'in_stock' ? 'In Stock' : p.availability === 'made_to_order' ? 'Made to Order' : 'Out of Stock'}
                  </span>
                </div>

                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-paper uppercase tracking-wider">{p.category}</span>
                    {p.customOrderSupported && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        Custom Size
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold group-hover:underline text-ink">{p.name}</h3>
                  <p className="text-xs text-muted-paper line-clamp-1">{p.description}</p>
                  <p className="text-sm font-semibold text-lake-deep pt-1">
                    ₹{p.priceInr.toLocaleString('en-IN')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* WORKSHOPS SECTION */}
      {workshops.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-medium">Craft Workshops by Maker</h2>
            <span className="text-xs text-muted-paper">{workshops.length} upcoming</span>
          </div>

          <div className="space-y-3">
            {workshops.map((w) => (
              <div key={w.id} className="bg-white p-5 rounded-3xl border border-line space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-paper border border-line px-2.5 py-0.5 rounded-full font-medium">
                    {w.skillLevel || 'All levels'}
                  </span>
                  <span className="text-xs font-bold text-lake-deep">{w.cost}</span>
                </div>
                <h3 className="text-lg font-medium">{w.title}</h3>
                <p className="text-xs text-muted-paper">{w.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-line/50 text-muted-paper">
                  <div>
                    <strong className="text-ink">Date:</strong>{' '}
                    {new Date(w.startsAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                  <div>
                    <strong className="text-ink">Duration:</strong> {w.durationMinutes} mins
                  </div>
                  <div>
                    <strong className="text-ink">Skill:</strong> {w.craftSkill || 'Craft techniques'}
                  </div>
                  <div>
                    <strong className="text-ink">Materials:</strong> {w.materialsProvided || 'Included'}
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    href={`/events/${w.id}`}
                    className="text-xs font-semibold text-lake-deep underline"
                  >
                    View Workshop Details &amp; Reserve ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REVIEWS SECTION */}
      <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium">Customer Reviews</h2>
            <p className="text-xs text-muted-paper">Visitor feedback for {shop.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="feature-secondary px-3.5 py-1.5 text-xs rounded-full"
          >
            + Write a Review
          </button>
        </div>

        {reviews.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-paper">
            No reviews yet. Be the first to leave feedback after visiting or commissioning work!
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
                {rev.interactionRef && (
                  <p className="text-[11px] text-muted-paper italic">Ref: {rev.interactionRef}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* DIRECT ENQUIRY MODAL */}
      {showEnquiryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Send Enquiry to {shop.name}</h3>
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
                  value={enquiryForm.name}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                  placeholder="e.g. Radhika Sharma"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Phone Number or Email
                <input
                  required
                  value={enquiryForm.contactBack}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, contactBack: e.target.value })}
                  placeholder="e.g. +91 98765 43210 or name@example.com"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Message / Inquiry
                <textarea
                  required
                  rows={4}
                  value={enquiryForm.message}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                  placeholder="Ask about pieces, custom sizes, studio visiting hours, or workshop arrangements..."
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Sending…' : 'Send Enquiry Directly'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WRITE REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Review {shop.name}</h3>
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
                <p>Please sign in with your MIRAS visitor account to leave a review.</p>
                <Link href="/account" className="feature-primary inline-block py-2 px-4">
                  Sign In ↗
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="social-form space-y-3">
                <label className="block text-sm font-medium">
                  Rating
                  <select
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                    className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
                  >
                    <option value={5}>★★★★★ (5 - Excellent)</option>
                    <option value={4}>★★★★☆ (4 - Good)</option>
                    <option value={3}>★★★☆☆ (3 - Average)</option>
                    <option value={2}>★★☆☆☆ (2 - Fair)</option>
                    <option value={1}>★☆☆☆☆ (1 - Poor)</option>
                  </select>
                </label>

                <label className="block text-sm font-medium">
                  Review Headline
                  <input
                    required
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    placeholder="e.g. Stunning craftsmanship and warm welcome"
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Feedback &amp; Details
                  <textarea
                    required
                    rows={4}
                    value={reviewForm.feedback}
                    onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                    placeholder="Share what you appreciated about the craft, quality, and artisan interaction..."
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Interaction Note
                  <input
                    value={reviewForm.interactionRef}
                    onChange={(e) => setReviewForm({ ...reviewForm, interactionRef: e.target.value })}
                    placeholder="e.g. Visited studio in October 2026"
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                  {busy ? 'Publishing…' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LOCAL FRIEND REQUEST MODAL */}
      {showFriendModal && friendProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Connect with {friendProfile.displayName}</h3>
              <button
                type="button"
                onClick={() => setShowFriendModal(false)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-muted-paper">
              Send a polite request to discuss Mewar art heritage or plan an in-person studio conversation.
            </p>

            <form onSubmit={handleSendFriendRequest} className="social-form space-y-3">
              <label className="block text-sm font-medium">
                Your Name
                <input
                  required
                  value={friendForm.name}
                  onChange={(e) => setFriendForm({ ...friendForm, name: e.target.value })}
                  placeholder="e.g. Radhika"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Contact Info (Phone/Email/WhatsApp)
                <input
                  required
                  value={friendForm.contact}
                  onChange={(e) => setFriendForm({ ...friendForm, contact: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Preferred Date / Time in Udaipur
                <input
                  value={friendForm.dates}
                  onChange={(e) => setFriendForm({ ...friendForm, dates: e.target.value })}
                  placeholder="e.g. Next Saturday around 4 PM"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Message / What you&apos;d like to talk about
                <textarea
                  required
                  rows={3}
                  value={friendForm.message}
                  onChange={(e) => setFriendForm({ ...friendForm, message: e.target.value })}
                  placeholder="Introduce yourself and share your curiosity about this craft..."
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Sending…' : 'Send Connection Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
