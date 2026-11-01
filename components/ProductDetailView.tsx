'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type { Product, Shop } from '@/lib/marketplace/store';

type Props = {
  shop: Shop;
  product: Product;
  currentUser: Member | null;
};

export function ProductDetailView({ shop, product, currentUser }: Props) {
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [form, setForm] = useState({
    name: currentUser?.name || '',
    contactBack: '',
    message: `Hello ${shop.name}, I am interested in purchasing or learning more about "${product.name}" (₹${product.priceInr.toLocaleString('en-IN')}).`,
  });
  const [busy, setBusy] = useState(false);
  const [sentMsg, setSentMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSendEnquiry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSentMsg('');
    setErrorMsg('');
    try {
      await communityRequest('/api/enquiries/event', {
        eventId: 'product-enquiry',
        name: form.name.trim(),
        contactBack: form.contactBack.trim(),
        tickets: 1,
        message: form.message.trim(),
      }, 'POST');
      setSentMsg('Your enquiry for this piece has been submitted directly to the maker!');
      setShowEnquiry(!showEnquiry);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Breadcrumb back to shop */}
      <nav className="text-xs text-muted-paper">
        <Link href={`/shops/${shop.slug}`} className="hover:text-ink underline">
          ← Back to {shop.name}
        </Link>
      </nav>

      {/* Main Product Card */}
      <div className="bg-white rounded-3xl border border-line overflow-hidden shadow-sm space-y-4">
        <div className="aspect-[4/3] bg-paper relative overflow-hidden">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-[#e6eff1]">
              🎨
            </div>
          )}
          <span
            className={`absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full shadow-sm ${
              product.availability === 'in_stock'
                ? 'bg-white text-ink'
                : product.availability === 'made_to_order'
                ? 'bg-blue-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {product.availability === 'in_stock'
              ? 'In Stock'
              : product.availability === 'made_to_order'
              ? 'Made to Order'
              : 'Out of Stock'}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider text-muted-paper">
              {product.category}
            </span>
            <span className="text-2xl font-bold font-display text-lake-deep">
              ₹{product.priceInr.toLocaleString('en-IN')}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-medium text-ink">{product.name}</h1>

          <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line">{product.description}</p>

          {/* Materials */}
          {product.materials.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-line/60">
              <span className="text-xs font-semibold text-muted-paper uppercase tracking-wider">
                Materials &amp; Composition
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.materials.map((m, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-paper border border-line px-2.5 py-1 rounded-full text-ink font-medium"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Order Indicator */}
          {product.customOrderSupported && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 space-y-0.5">
              <strong className="block">Custom Commissions Welcome</strong>
              <p>The maker can recreate this motif in customized dimensions or color palettes upon request.</p>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowEnquiry(!showEnquiry)}
              className="feature-primary w-full py-3 text-center text-sm font-medium"
            >
              Enquire About This Piece
            </button>
          </div>
        </div>
      </div>

      {sentMsg && <p role="status" className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs">{sentMsg}</p>}
      {errorMsg && <p role="alert" className="social-error">{errorMsg}</p>}

      {/* ENQUIRY MODAL / ACCORDION */}
      {showEnquiry && (
        <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-3">
          <h2 className="text-lg font-medium">Send Inquiry to Maker</h2>
          <p className="text-xs text-muted-paper">
            Ask about purchase details, shipping within India, or customized sizes directly from {shop.name}.
          </p>

          <form onSubmit={handleSendEnquiry} className="social-form space-y-3">
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
              Your Contact Number or Email
              <input
                required
                value={form.contactBack}
                onChange={(e) => setForm({ ...form, contactBack: e.target.value })}
                placeholder="+91 98765 43210 or yourname@example.com"
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
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <button className="feature-primary w-full py-3" disabled={busy}>
              {busy ? 'Sending…' : 'Submit Enquiry'}
            </button>
          </form>
        </div>
      )}

      {/* Maker Shop Card */}
      <div className="bg-white p-5 rounded-3xl border border-line space-y-2">
        <span className="text-xs uppercase font-semibold text-muted-paper tracking-wider">Crafted By</span>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <h3 className="text-lg font-medium text-ink">{shop.name}</h3>
            <p className="text-xs text-muted-paper">{shop.craft} · {shop.locality || 'Udaipur'}</p>
          </div>
          <Link
            href={`/shops/${shop.slug}`}
            className="text-xs font-semibold px-4 py-2 border border-line rounded-full bg-paper hover:bg-white transition"
          >
            Visit Studio Page ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
