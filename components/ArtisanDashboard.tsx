'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type {
  CommunityEvent,
  LocalFriendProfile,
  LocalFriendRequest,
  Product,
  Shop,
  TwoWayReview,
} from '@/lib/marketplace/store';

type Props = {
  user: Member;
  initialShop: Shop | null;
  initialProducts: Product[];
  initialWorkshops: CommunityEvent[];
  initialFriendProfile: LocalFriendProfile | null;
  initialFriendRequests: LocalFriendRequest[];
  initialReviews: TwoWayReview[];
};

export function ArtisanDashboard({
  user,
  initialShop,
  initialProducts,
  initialWorkshops,
  initialFriendProfile,
  initialFriendRequests,
  initialReviews,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'shop' | 'products' | 'enquiries' | 'workshops' | 'friend' | 'reviews' | 'settings'
  >('overview');

  const [shop, setShop] = useState(initialShop);
  const [products, setProducts] = useState(initialProducts);
  const [workshops, setWorkshops] = useState(initialWorkshops);
  const [friendProfile, setFriendProfile] = useState(initialFriendProfile);
  const [friendRequests, setFriendRequests] = useState(initialFriendRequests);
  const [reviews, setReviews] = useState(initialReviews);

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // New Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    description: '',
    category: shop?.craft || 'Miniature painting',
    priceInr: 1000,
    materials: 'Natural stone pigments, Silk cloth',
    availability: 'in_stock' as Product['availability'],
    customOrderSupported: true,
  });

  // New Workshop Modal State
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);
  const [wsForm, setWsForm] = useState(() => ({
    title: '',
    description: '',
    location: shop?.locality || 'Studio, Old City, Udaipur',
    startsAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    durationMinutes: 120,
    capacity: 10,
    cost: '₹1,200',
    craftSkill: 'Pigment grinding & fine brushwork',
    materialsProvided: 'Natural pigments, brushes, handmade wasli paper',
    skillLevel: 'Beginner',
    howToBook: 'Register via WhatsApp or in person',
  }));

  // Customer Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [customerReviewForm, setCustomerReviewForm] = useState({
    visitorUsernameOrId: '',
    rating: 5,
    title: '',
    feedback: '',
  });

  // Shop Edit State
  const [shopForm, setShopForm] = useState({
    name: shop?.name || '',
    craft: shop?.craft || '',
    description: shop?.description || '',
    story: shop?.story || '',
    locality: shop?.locality || '',
    openingHours: shop?.openingHours || '',
    contactMethod: shop?.contactMethod || '',
    status: shop?.status || 'published',
  });

  // Local Friend Edit State
  const [friendForm, setFriendForm] = useState({
    isEnabled: friendProfile?.isEnabled ?? false,
    displayName: friendProfile?.displayName || user.name,
    introduction: friendProfile?.introduction || '',
    expertise: friendProfile?.expertise?.join(', ') || 'Miniature painting, Mewar court art, Old City alleys',
    availabilityNote: friendProfile?.availabilityNote || 'Evenings 5 PM – 7 PM',
    contactPreference: friendProfile?.contactPreference || 'WhatsApp or studio visit',
  });

  // Helper clear alerts
  function clearAlerts() {
    setStatusMsg('');
    setErrorMsg('');
  }

  // Save Shop Details
  async function handleSaveShop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      const res = await communityRequest<{ ok: true; shop: Shop }>('/api/artisan/shop', {
        ...shopForm,
      }, 'PUT');
      setShop(res.shop);
      setStatusMsg('Shop details saved successfully.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Create or Update Product
  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      const materialsList = prodForm.materials.split(',').map((s) => s.trim()).filter(Boolean);
      if (editingProduct) {
        const res = await communityRequest<{ ok: true; product: Product }>('/api/artisan/products', {
          id: editingProduct.id,
          name: prodForm.name,
          description: prodForm.description,
          category: prodForm.category,
          priceInr: Number(prodForm.priceInr),
          materials: materialsList,
          availability: prodForm.availability,
          customOrderSupported: prodForm.customOrderSupported,
        }, 'PUT');
        setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
        setStatusMsg('Product updated.');
      } else {
        const res = await communityRequest<{ ok: true; product: Product }>('/api/artisan/products', {
          name: prodForm.name,
          description: prodForm.description,
          category: prodForm.category,
          priceInr: Number(prodForm.priceInr),
          materials: materialsList,
          availability: prodForm.availability,
          customOrderSupported: prodForm.customOrderSupported,
          status: 'published',
        }, 'POST');
        setProducts((prev) => [res.product, ...prev]);
        setStatusMsg('New product published to your shop.');
      }
      setShowProductModal(false);
      setEditingProduct(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Delete Product
  async function handleDeleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete this product listing?')) return;
    setBusy(true);
    clearAlerts();
    try {
      await communityRequest('/api/artisan/products', { id }, 'DELETE');
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setStatusMsg('Product removed.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Create Craft Workshop
  async function handleSaveWorkshop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      const isoStartsAt = new Date(wsForm.startsAt).toISOString();
      const res = await communityRequest<{ ok: true; event: CommunityEvent }>('/api/events', {
        eventType: 'workshop',
        title: wsForm.title,
        description: wsForm.description,
        location: wsForm.location,
        startsAt: isoStartsAt,
        durationMinutes: Number(wsForm.durationMinutes),
        capacity: Number(wsForm.capacity),
        cost: wsForm.cost,
        craftSkill: wsForm.craftSkill,
        materialsProvided: wsForm.materialsProvided,
        skillLevel: wsForm.skillLevel,
        howToBook: wsForm.howToBook,
        status: 'published',
      }, 'POST');
      setWorkshops((prev) => [res.event, ...prev]);
      setStatusMsg('Craft workshop announced and published.');
      setShowWorkshopModal(false);
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
    const note = prompt(`Optional message to traveller (${status === 'accepted' ? 'e.g. Welcome to visit my studio at 4 PM' : 'Reason'}):`) || '';
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

  // Report Review
  async function handleReportReview(reviewId: string) {
    if (!confirm('Report this review for moderation?')) return;
    try {
      await communityRequest('/api/reviews', { reviewId }, 'PUT');
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setStatusMsg('Review reported to MIRAS moderators.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  }

  // Review a customer
  async function handleSubmitCustomerReview(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearAlerts();
    try {
      await communityRequest('/api/reviews', {
        targetType: 'visitor',
        targetId: customerReviewForm.visitorUsernameOrId.trim(),
        rating: Number(customerReviewForm.rating),
        title: customerReviewForm.title.trim(),
        feedback: customerReviewForm.feedback.trim(),
      }, 'POST');
      setStatusMsg('Customer review submitted successfully.');
      setShowReviewModal(false);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'shop', label: 'My Shop' },
    { id: 'products', label: `Products (${products.length})` },
    { id: 'workshops', label: `Workshops (${workshops.length})` },
    { id: 'friend', label: 'Local Friend' },
    { id: 'reviews', label: `Reviews (${reviews.length})` },
    { id: 'settings', label: 'Settings' },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#101718] text-white px-2.5 py-0.5 rounded-full font-medium">Artisan</span>
            {shop?.verificationStatus === 'verified' ? (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Verified Maker</span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Unverified / Self-Registered</span>
            )}
          </div>
          <h1 className="text-3xl font-display mt-1">{shop?.name || `${user.name}’s Studio`}</h1>
          <p className="text-xs text-muted-paper">
            {shop?.craft || 'Handicrafts'} · Udaipur, Rajasthan
          </p>
        </div>

        {shop && (
          <Link
            href={`/shops/${shop.slug}`}
            className="text-xs font-semibold px-4 py-2 border border-line rounded-full bg-white hover:bg-paper transition"
          >
            View Public Shop ↗
          </Link>
        )}
      </header>

      {/* Notifications */}
      {statusMsg && <p role="status" className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs">{statusMsg}</p>}
      {errorMsg && <p role="alert" className="social-error">{errorMsg}</p>}

      {/* Navigation Tabs */}
      <nav className="journal-tabs overflow-x-auto py-1" aria-label="Artisan sections">
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
              <span className="text-2xl font-bold font-display">{products.length}</span>
              <p className="text-xs text-muted-paper mt-1">Products Listed</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{workshops.length}</span>
              <p className="text-xs text-muted-paper mt-1">Craft Workshops</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{friendRequests.length}</span>
              <p className="text-xs text-muted-paper mt-1">Friend Requests</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-line text-center">
              <span className="text-2xl font-bold font-display">{reviews.length}</span>
              <p className="text-xs text-muted-paper mt-1">Customer Reviews</p>
            </div>
          </div>

          {/* Quick Actions */}
          <section className="bg-white p-5 rounded-3xl border border-line space-y-3">
            <h2 className="text-lg font-medium">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setProdForm({
                    name: '',
                    description: '',
                    category: shop?.craft || 'Miniature painting',
                    priceInr: 1500,
                    materials: 'Natural pigments, handmade paper',
                    availability: 'in_stock',
                    customOrderSupported: true,
                  });
                  setShowProductModal(true);
                }}
                className="feature-primary py-2.5 text-xs text-center"
              >
                + Add New Product
              </button>
              <button
                type="button"
                onClick={() => setShowWorkshopModal(true)}
                className="feature-secondary py-2.5 text-xs text-center"
              >
                + Announce Workshop
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shop')}
                className="feature-secondary py-2.5 text-xs text-center"
              >
                Edit Shop Details
              </button>
            </div>
          </section>

          {/* Verification Banner */}
          <div className="bg-[#f0f5f7] p-4 rounded-3xl border border-line text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <strong className="text-ink">Trust &amp; Verification Status</strong>
              <span className="font-semibold text-lake-deep">
                {shop?.verificationStatus === 'verified' ? 'Verified Partner' : 'Self-Registered (Unverified)'}
              </span>
            </div>
            <p className="text-muted-paper">
              MIRAS verifies authenticity through personal studio visits and material checks in Udaipur. Verified artisans
              receive the &ldquo;Verified Maker&rdquo; badge on public listings.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: MY SHOP */}
      {activeTab === 'shop' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Shop Profile</h2>
            <span className="text-xs text-muted-paper">Public Listing Information</span>
          </div>

          <form onSubmit={handleSaveShop} className="social-form space-y-3">
            <label className="block text-sm font-medium">
              Shop Name
              <input
                required
                value={shopForm.name}
                onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Craft Category
              <input
                required
                value={shopForm.craft}
                onChange={(e) => setShopForm({ ...shopForm, craft: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Short Summary Description
              <textarea
                required
                rows={3}
                value={shopForm.description}
                onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Artisan Story &amp; Heritage
              <textarea
                rows={4}
                value={shopForm.story}
                onChange={(e) => setShopForm({ ...shopForm, story: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Locality
                <input
                  value={shopForm.locality}
                  onChange={(e) => setShopForm({ ...shopForm, locality: e.target.value })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Opening Hours
                <input
                  value={shopForm.openingHours}
                  onChange={(e) => setShopForm({ ...shopForm, openingHours: e.target.value })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>
            </div>

            <label className="block text-sm font-medium">
              Contact Method / Phone / WhatsApp
              <input
                value={shopForm.contactMethod}
                onChange={(e) => setShopForm({ ...shopForm, contactMethod: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Shop Status
              <select
                value={shopForm.status}
                onChange={(e) => setShopForm({ ...shopForm, status: e.target.value as 'draft' | 'published' })}
                className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
              >
                <option value="published">Published (Visible to visitors)</option>
                <option value="draft">Draft (Hidden from public)</option>
              </select>
            </label>

            <button className="feature-primary w-full py-3 mt-2" disabled={busy}>
              {busy ? 'Saving…' : 'Save Shop Changes'}
            </button>
          </form>
        </section>
      )}

      {/* TAB 3: MY PRODUCTS */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Craft Product Listings</h2>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setProdForm({
                  name: '',
                  description: '',
                  category: shop?.craft || 'Miniature painting',
                  priceInr: 1500,
                  materials: 'Natural stone pigments, Silk cloth',
                  availability: 'in_stock',
                  customOrderSupported: true,
                });
                setShowProductModal(true);
              }}
              className="feature-primary px-4 py-2 text-xs"
            >
              + Add Product
            </button>
          </div>

          {products.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-line text-center space-y-2">
              <p className="text-sm font-medium">No products listed yet.</p>
              <p className="text-xs text-muted-paper">
                Add your hand-crafted pieces so visitors can view your collection and inquire.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="bg-white p-4 rounded-3xl border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-paper border border-line px-2.5 py-0.5 rounded-full font-medium">
                        {p.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.availability === 'in_stock'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.availability === 'made_to_order'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.availability === 'in_stock' ? 'In Stock' : p.availability === 'made_to_order' ? 'Made to Order' : 'Out of Stock'}
                      </span>
                      {p.customOrderSupported && (
                        <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full">
                          Custom Orders
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <p className="text-xs text-muted-paper line-clamp-1">{p.description}</p>
                    <p className="text-sm font-medium text-lake-deep">₹{p.priceInr.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(p);
                        setProdForm({
                          name: p.name,
                          description: p.description,
                          category: p.category,
                          priceInr: p.priceInr,
                          materials: p.materials.join(', '),
                          availability: p.availability,
                          customOrderSupported: p.customOrderSupported,
                        });
                        setShowProductModal(true);
                      }}
                      className="px-3 py-1.5 border border-line rounded-full text-xs hover:border-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id)}
                      className="px-3 py-1.5 border border-rose-200 text-rose-700 bg-rose-50 rounded-full text-xs hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* TAB 4: CRAFT WORKSHOPS */}
      {activeTab === 'workshops' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Craft Workshops</h2>
            <button
              type="button"
              onClick={() => setShowWorkshopModal(true)}
              className="feature-primary px-4 py-2 text-xs"
            >
              + Host Workshop
            </button>
          </div>

          <p className="text-xs text-muted-paper">
            Workshops let travellers sit with you, learn traditional techniques, and support living heritage.
          </p>

          {workshops.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-line text-center space-y-2">
              <p className="text-sm font-medium">No craft workshops hosted yet.</p>
              <p className="text-xs text-muted-paper">
                Create your first workshop to offer hands-on heritage experiences.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {workshops.map((w) => (
                <li key={w.id} className="bg-white p-5 rounded-3xl border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-paper border border-line px-2.5 py-0.5 rounded-full font-medium">
                      {w.skillLevel || 'All levels'}
                    </span>
                    <span className="text-xs text-lake-deep font-semibold">{w.cost}</span>
                  </div>
                  <h3 className="text-lg font-medium">{w.title}</h3>
                  <p className="text-xs text-muted-paper">{w.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-line/50">
                    <div>
                      <span className="text-muted-paper">Duration:</span> {w.durationMinutes} mins
                    </div>
                    <div>
                      <span className="text-muted-paper">Location:</span> {w.location}
                    </div>
                    <div>
                      <span className="text-muted-paper">Skill Taught:</span> {w.craftSkill || 'Craft basics'}
                    </div>
                    <div>
                      <span className="text-muted-paper">Materials:</span> {w.materialsProvided || 'Provided'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* TAB 5: LOCAL FRIEND */}
      {activeTab === 'friend' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Local Friend Availability</h2>
            <span className="text-xs text-muted-paper">Cultural Host Network</span>
          </div>

          <p className="text-xs text-muted-paper">
            Opting in allows interested travellers to ask questions, plan respectful visits, or request informal guidance
            in Udaipur’s craft quarters.
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
                placeholder="Share your passion for Udaipur's arts and what you enjoy discussing with travellers..."
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Topics / Expertise (comma-separated)
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
                placeholder="e.g. Weekday evenings after 4 PM, closed on Tuesdays"
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

      {/* TAB 6: REVIEWS */}
      {activeTab === 'reviews' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Customer Reviews &amp; Feedback</h2>
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="feature-secondary px-3.5 py-1.5 text-xs rounded-full"
            >
              + Review a Customer
            </button>
          </div>

          <p className="text-xs text-muted-paper">
            Reviews from visitors who purchased craftwork, attended workshops, or visited your studio.
          </p>

          {reviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-paper">
              No reviews received yet. Reviews will appear here once visitors leave feedback on your shop.
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
                  <div className="flex items-center justify-between text-[11px] text-muted-paper pt-1">
                    <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                    <button
                      type="button"
                      onClick={() => handleReportReview(rev.id)}
                      className="underline text-rose-700 hover:text-rose-900"
                    >
                      Report
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* TAB 7: SETTINGS */}
      {activeTab === 'settings' && (
        <section className="bg-white p-6 rounded-3xl border border-line space-y-4">
          <h2 className="text-xl font-medium">Account Settings</h2>
          <div className="text-xs text-muted-paper space-y-1">
            <p>Signed in as: <strong>@{user.username}</strong> ({user.name})</p>
            <p>Role: <strong>Artisan Business Listing</strong></p>
          </div>

          <div className="pt-2">
            <Link href="/account" className="feature-secondary py-2.5 px-4 text-xs inline-block">
              Open Main Account &amp; Password Settings ↗
            </Link>
          </div>
        </section>
      )}

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{editingProduct ? 'Edit Product' : 'Add Craft Product'}</h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="social-form space-y-3">
              <label className="block text-sm font-medium">
                Product Title
                <input
                  required
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  placeholder="e.g. Royal Pichwai Peacock Painting"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Category
                <input
                  required
                  value={prodForm.category}
                  onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Price in INR (₹)
                <input
                  type="number"
                  required
                  min={0}
                  value={prodForm.priceInr}
                  onChange={(e) => setProdForm({ ...prodForm, priceInr: Number(e.target.value) })}
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Description &amp; Technique
                <textarea
                  required
                  rows={3}
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  placeholder="Describe the motif, technique, and craft tradition..."
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Materials Used (comma-separated)
                <input
                  value={prodForm.materials}
                  onChange={(e) => setProdForm({ ...prodForm, materials: e.target.value })}
                  placeholder="e.g. Natural stone pigments, Wasli paper, Gold leaf"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Availability
                <select
                  value={prodForm.availability}
                  onChange={(e) => setProdForm({ ...prodForm, availability: e.target.value as Product['availability'] })}
                  className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="made_to_order">Made to Order</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={prodForm.customOrderSupported}
                  onChange={(e) => setProdForm({ ...prodForm, customOrderSupported: e.target.checked })}
                />
                <span className="text-xs text-ink font-medium">Accept custom size or motif commissions</span>
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Saving…' : editingProduct ? 'Update Product' : 'Add to Catalogue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WORKSHOP MODAL */}
      {showWorkshopModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Host a Craft Workshop</h3>
              <button
                type="button"
                onClick={() => setShowWorkshopModal(false)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveWorkshop} className="social-form space-y-3">
              <label className="block text-sm font-medium">
                Workshop Title
                <input
                  required
                  value={wsForm.title}
                  onChange={(e) => setWsForm({ ...wsForm, title: e.target.value })}
                  placeholder="e.g. Masterclass in Mewar Miniature Painting"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Description
                <textarea
                  required
                  rows={3}
                  value={wsForm.description}
                  onChange={(e) => setWsForm({ ...wsForm, description: e.target.value })}
                  placeholder="What will participants learn and take home?"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Date and Time
                  <input
                    type="datetime-local"
                    required
                    value={wsForm.startsAt}
                    onChange={(e) => setWsForm({ ...wsForm, startsAt: e.target.value })}
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Duration (Minutes)
                  <input
                    type="number"
                    min={30}
                    value={wsForm.durationMinutes}
                    onChange={(e) => setWsForm({ ...wsForm, durationMinutes: Number(e.target.value) })}
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Cost
                  <input
                    value={wsForm.cost}
                    onChange={(e) => setWsForm({ ...wsForm, cost: e.target.value })}
                    placeholder="e.g. ₹1,200 (Materials included)"
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Capacity (Spots)
                  <input
                    type="number"
                    min={1}
                    value={wsForm.capacity}
                    onChange={(e) => setWsForm({ ...wsForm, capacity: Number(e.target.value) })}
                    className="mt-1 w-full rounded-2xl border border-line p-3"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium">
                Location in Udaipur
                <input
                  required
                  value={wsForm.location}
                  onChange={(e) => setWsForm({ ...wsForm, location: e.target.value })}
                  placeholder="e.g. Mohan Arts Studio, Bhatiyani Chohatta"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Materials Provided
                <input
                  value={wsForm.materialsProvided}
                  onChange={(e) => setWsForm({ ...wsForm, materialsProvided: e.target.value })}
                  placeholder="e.g. Natural stone pigments, brushes, handmade paper"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Publishing…' : 'Publish Workshop to Events &amp; Shop'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Write a Customer Review</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSubmitCustomerReview} className="social-form space-y-3">
              <label className="block text-sm font-medium">
                Visitor Account Username or ID
                <input
                  required
                  value={customerReviewForm.visitorUsernameOrId}
                  onChange={(e) => setCustomerReviewForm({ ...customerReviewForm, visitorUsernameOrId: e.target.value })}
                  placeholder="e.g. radhika_v"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Rating (1–5 Stars)
                <select
                  value={customerReviewForm.rating}
                  onChange={(e) => setCustomerReviewForm({ ...customerReviewForm, rating: Number(e.target.value) })}
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
                  value={customerReviewForm.title}
                  onChange={(e) => setCustomerReviewForm({ ...customerReviewForm, title: e.target.value })}
                  placeholder="e.g. Courteous and thoughtful studio guest"
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Feedback
                <textarea
                  required
                  rows={3}
                  value={customerReviewForm.feedback}
                  onChange={(e) => setCustomerReviewForm({ ...customerReviewForm, feedback: e.target.value })}
                  placeholder="Describe your interaction with this visitor..."
                  className="mt-1 w-full rounded-2xl border border-line p-3"
                />
              </label>

              <button className="feature-primary w-full py-3 mt-3" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
