'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type { Shop } from '@/lib/marketplace/store';

const CRAFT_CATEGORIES = [
  'Miniature painting',
  'Pottery & ceramics',
  'Traditional textiles & Bandhani',
  'Silver & Kundan jewellery',
  'Wooden handicrafts & carving',
  'Leather crafts & Mojaris',
  'Traditional Pichwai & Mewar art',
  'Marble carving & stone work',
  'Puppet making',
  'Other local crafts',
];

export default function ArtisanRegisterPage() {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [createdShop, setCreatedShop] = useState<Shop | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    languages: ['Hindi', 'English'],
    contactInfo: '',
    shopName: '',
    craft: CRAFT_CATEGORIES[0],
    description: '',
    story: '',
    locality: '',
    openingHours: '10:00 AM – 7:30 PM',
    contactMethod: '',
    coverImage: '/media/placeholders/artisan-1.svg',
    profileImage: '',
    ownershipConfirmed: false,
    consentGiven: false,
    photoRightsConfirmed: false,
    guidelinesAccepted: false,
  });

  function updateField<K extends keyof typeof formData>(field: K, value: typeof formData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleLanguageToggle(lang: string) {
    setFormData((prev) => {
      const exists = prev.languages.includes(lang);
      const languages = exists ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang];
      return { ...prev, languages: languages.length ? languages : ['Hindi'] };
    });
  }

  function validateStep(current: number): boolean {
    setError('');
    if (current === 1) {
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        setError('Please enter your full name or maker name (at least 2 letters).');
        return false;
      }
      if (!/^[a-z0-9_]{3,24}$/i.test(formData.username.trim())) {
        setError('Username must be 3–24 characters (letters, numbers, underscore only).');
        return false;
      }
      if (formData.password.length < 12) {
        setError('Password must be at least 12 characters.');
        return false;
      }
      return true;
    }
    if (current === 2) {
      if (!formData.shopName.trim() || formData.shopName.trim().length < 2) {
        setError('Please enter your shop or workshop name.');
        return false;
      }
      if (!formData.description.trim() || formData.description.trim().length < 10) {
        setError('Please provide a short description of your craft (at least 10 characters).');
        return false;
      }
      if (!formData.locality.trim()) {
        setError('Please specify your locality in Udaipur (e.g., Near Jagdish Temple, Bhatiyani Chohatta).');
        return false;
      }
      return true;
    }
    if (current === 3) {
      if (!formData.ownershipConfirmed) {
        setError('Please confirm your authority to operate this shop listing.');
        return false;
      }
      if (!formData.consentGiven) {
        setError('Please give consent for publishing your business details on MIRAS.');
        return false;
      }
      if (!formData.photoRightsConfirmed) {
        setError('Please confirm that photos depict only craftwork and you hold publication rights.');
        return false;
      }
      if (!formData.guidelinesAccepted) {
        setError('Please accept the MIRAS artisan marketplace guidelines.');
        return false;
      }
      return true;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validateStep(3)) return;
    setBusy(true);
    setError('');

    try {
      const res = await communityRequest<{
        ok: true;
        user: Member;
        shop: Shop;
        recoveryCode?: string;
      }>('/api/artisan/register', {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        shopName: formData.shopName.trim(),
        craft: formData.craft,
        description: formData.description.trim(),
        story: formData.story.trim(),
        locality: formData.locality.trim(),
        openingHours: formData.openingHours.trim(),
        languages: formData.languages,
        contactMethod: formData.contactMethod.trim() || formData.contactInfo.trim(),
        coverImage: formData.coverImage.trim(),
        profileImage: formData.profileImage.trim(),
        ownershipConfirmed: formData.ownershipConfirmed,
        guidelinesAccepted: formData.guidelinesAccepted,
      });

      if (res.recoveryCode) setRecoveryCode(res.recoveryCode);
      setCreatedShop(res.shop);
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <header className="space-y-1">
        <p className="discovery-eyebrow">ARTISAN ENROLMENT</p>
        <h1 className="text-3xl font-display">Register Your Artisan Shop</h1>
        <p className="text-sm text-muted-paper">
          Step {step} of 4: {step === 1 ? 'Maker Account' : step === 2 ? 'Shop & Craft' : step === 3 ? 'Confirmations' : 'Listing Ready'}
        </p>
      </header>

      {/* Progress Pills */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-[#101718]' : 'bg-line'
            }`}
          />
        ))}
      </div>

      {error && <p role="alert" className="social-error">{error}</p>}

      {/* STEP 1: Account Details */}
      {step === 1 && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
          <h2 className="text-xl font-medium">1. Account Details</h2>
          <p className="text-xs text-muted-paper">
            Create your artisan login. You will use this username and password to access your dashboard.
          </p>

          <label className="block text-sm font-medium">
            Artisan / Maker Name
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Master Mohan Lal"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Username
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => updateField('username', e.target.value)}
              placeholder="e.g. mohan_crafts"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
            <small className="text-xs text-muted-paper block mt-1">3–24 letters, numbers, or underscores.</small>
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="At least 12 characters"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
            <small className="text-xs text-muted-paper block mt-1">At least 12 characters.</small>
          </label>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Languages You Speak With Visitors</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {['Hindi', 'English', 'Mewari', 'Gujarati', 'French', 'German'].map((lang) => (
                <button
                  type="button"
                  key={lang}
                  onClick={() => handleLanguageToggle(lang)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    formData.languages.includes(lang)
                      ? 'bg-[#101718] text-white border-[#101718]'
                      : 'bg-paper/50 text-ink border-line'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-medium">
            Contact Number or WhatsApp
            <input
              type="text"
              value={formData.contactInfo}
              onChange={(e) => updateField('contactInfo', e.target.value)}
              placeholder="e.g. +91 98290 12345"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (validateStep(1)) setStep(2);
            }}
            className="feature-primary w-full py-3 mt-4"
          >
            Continue to Shop Information →
          </button>
        </section>
      )}

      {/* STEP 2: Shop Details */}
      {step === 2 && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
          <h2 className="text-xl font-medium">2. Shop &amp; Craft Profile</h2>
          <p className="text-xs text-muted-paper">
            Information about your Udaipur workshop, heritage background, and how travellers can find you.
          </p>

          <label className="block text-sm font-medium">
            Shop or Studio Name
            <input
              type="text"
              required
              value={formData.shopName}
              onChange={(e) => updateField('shopName', e.target.value)}
              placeholder="e.g. Mohan Miniature Art Gallery"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Primary Craft Category
            <select
              value={formData.craft}
              onChange={(e) => updateField('craft', e.target.value)}
              className="mt-1 w-full rounded-2xl border border-line p-3 bg-white"
            >
              {CRAFT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Short Description (Summary)
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="e.g. Authentic hand-painted miniature artworks using natural gemstone and mineral pigments on silk and old court paper."
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Artisan Story &amp; Heritage (Optional)
            <textarea
              rows={4}
              value={formData.story}
              onChange={(e) => updateField('story', e.target.value)}
              placeholder="Tell visitors about your lineage, training, and artistic journey in Mewar..."
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Locality in Udaipur
              <input
                type="text"
                required
                value={formData.locality}
                onChange={(e) => updateField('locality', e.target.value)}
                placeholder="e.g. Near Jagdish Temple"
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>

            <label className="block text-sm font-medium">
              Opening Hours
              <input
                type="text"
                value={formData.openingHours}
                onChange={(e) => updateField('openingHours', e.target.value)}
                placeholder="10:00 AM – 7:30 PM"
                className="mt-1 w-full rounded-2xl border border-line p-3"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Preferred Contact Method for Inquiries
            <input
              type="text"
              value={formData.contactMethod}
              onChange={(e) => updateField('contactMethod', e.target.value)}
              placeholder="WhatsApp: +91 98290 12345 or visit in person"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="feature-secondary flex-1 py-3"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (validateStep(2)) setStep(3);
              }}
              className="feature-primary flex-1 py-3"
            >
              Continue to Declarations →
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Confirmations & Terms */}
      {step === 3 && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
          <h2 className="text-xl font-medium">3. Business Confirmations</h2>
          <p className="text-xs text-muted-paper">
            MIRAS upholds the dignity, cultural integrity, and authentic representation of Udaipur artisans.
          </p>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ownershipConfirmed}
                onChange={(e) => updateField('ownershipConfirmed', e.target.checked)}
                className="mt-1"
              />
              <span className="text-xs text-ink leading-relaxed">
                <strong>Authority Confirmation:</strong> I confirm that I am the maker or an authorized representative
                entitled to publish this craft workshop and listings.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consentGiven}
                onChange={(e) => updateField('consentGiven', e.target.checked)}
                className="mt-1"
              />
              <span className="text-xs text-ink leading-relaxed">
                <strong>Publication Consent:</strong> I give consent for my business name, locality, craft descriptions,
                and contact methods to be publicly listed on MIRAS.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.photoRightsConfirmed}
                onChange={(e) => updateField('photoRightsConfirmed', e.target.checked)}
                className="mt-1"
              />
              <span className="text-xs text-ink leading-relaxed">
                <strong>Craft Photo Rights:</strong> I confirm that photos uploaded show hands and craftwork and do not
                infringe third-party intellectual property.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.guidelinesAccepted}
                onChange={(e) => updateField('guidelinesAccepted', e.target.checked)}
                className="mt-1"
              />
              <span className="text-xs text-ink leading-relaxed">
                <strong>Marketplace Guidelines:</strong> I accept the MIRAS quality and fair interaction guidelines.
                (New listings start in unverified status until verified by the MIRAS team).
              </span>
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="feature-secondary flex-1 py-3"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmit}
              className="feature-primary flex-1 py-3"
            >
              {busy ? 'Creating Shop…' : 'Create Artisan Shop'}
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: Success & Recovery Code */}
      {step === 4 && createdShop && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-5 text-center">
          <div className="w-16 h-16 bg-[#eaf1f2] text-ink rounded-full flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-medium">Artisan Shop Created!</h2>
            <p className="text-sm text-muted-paper">
              <strong>{createdShop.name}</strong> is now live on MIRAS.
            </p>
          </div>

          {recoveryCode && (
            <div className="bg-[#f5f8f9] p-4 rounded-2xl border border-line text-left space-y-2">
              <p className="text-xs font-semibold text-ink uppercase tracking-wider">Save Your Recovery Code</p>
              <p className="text-xs text-muted-paper">
                Store this safe code in a private note. You will need it if you ever forget your password.
              </p>
              <code className="block bg-white p-2.5 rounded-xl border border-line text-xs break-all font-mono">
                {recoveryCode}
              </code>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/artisan/dashboard"
              className="feature-primary w-full py-3 text-center block text-sm font-medium"
            >
              Go to Artisan Dashboard ↗
            </Link>
            <Link
              href={`/shops/${createdShop.slug}`}
              className="feature-secondary w-full py-2.5 text-center block text-sm"
            >
              View Public Shop Page ↗
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
