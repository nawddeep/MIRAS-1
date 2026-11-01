'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member } from '@/lib/community/store';
import type { OrganizerProfile } from '@/lib/marketplace/store';

export default function EventManagerRegisterPage() {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [createdProfile, setCreatedProfile] = useState<OrganizerProfile | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    organizationName: '',
    description: '',
    contactInfo: '',
    locality: '',
    languages: ['Hindi', 'English'],
    logoImage: '',
    accuracyConfirmed: false,
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
        setError('Please enter your full name or organizer lead name.');
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
      if (!formData.organizationName.trim() || formData.organizationName.trim().length < 2) {
        setError('Please enter your organization or host collective name.');
        return false;
      }
      if (!formData.contactInfo.trim() || formData.contactInfo.trim().length < 3) {
        setError('Please provide public contact info (phone, email, or WhatsApp) for attendee enquiries.');
        return false;
      }
      return true;
    }
    if (current === 3) {
      if (!formData.accuracyConfirmed) {
        setError('Please confirm that event details published are accurate and hosted responsibly.');
        return false;
      }
      if (!formData.guidelinesAccepted) {
        setError('Please accept the MIRAS event organizer marketplace guidelines.');
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
        profile: OrganizerProfile;
        recoveryCode?: string;
      }>('/api/event-manager/register', {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        organizationName: formData.organizationName.trim(),
        description: formData.description.trim(),
        contactInfo: formData.contactInfo.trim(),
        locality: formData.locality.trim(),
        languages: formData.languages,
        logoImage: formData.logoImage.trim(),
        guidelinesAccepted: formData.guidelinesAccepted,
      });

      if (res.recoveryCode) setRecoveryCode(res.recoveryCode);
      setCreatedProfile(res.profile);
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
        <p className="discovery-eyebrow">EVENT MANAGER ENROLMENT</p>
        <h1 className="text-3xl font-display">Register as Event Manager</h1>
        <p className="text-sm text-muted-paper">
          Step {step} of 4: {step === 1 ? 'Manager Account' : step === 2 ? 'Organization Profile' : step === 3 ? 'Confirmations' : 'Profile Ready'}
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
            Create your event manager credentials to organize heritage walks, workshops, and gatherings in Udaipur.
          </p>

          <label className="block text-sm font-medium">
            Manager / Host Name
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Sunil Mehta"
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
              placeholder="e.g. udaipur_walks"
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

          <button
            type="button"
            onClick={() => {
              if (validateStep(1)) setStep(2);
            }}
            className="feature-primary w-full py-3 mt-4"
          >
            Continue to Organization Profile →
          </button>
        </section>
      )}

      {/* STEP 2: Organization Profile */}
      {step === 2 && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
          <h2 className="text-xl font-medium">2. Organization / Host Profile</h2>
          <p className="text-xs text-muted-paper">
            Information about your organization, collective, or heritage guides group.
          </p>

          <label className="block text-sm font-medium">
            Organization or Initiative Name
            <input
              type="text"
              required
              value={formData.organizationName}
              onChange={(e) => updateField('organizationName', e.target.value)}
              placeholder="e.g. Udaipur Heritage Walks Collective"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            About the Organization / Mission
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="e.g. Community-led heritage walks, architectural walks, stepwell preservation tours and cultural evenings in Udaipur."
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Public Contact Info for Inquiries
            <input
              type="text"
              required
              value={formData.contactInfo}
              onChange={(e) => updateField('contactInfo', e.target.value)}
              placeholder="e.g. walks@udaipurheritage.org or +91 94140 12345"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Locality / Operating Base
            <input
              type="text"
              value={formData.locality}
              onChange={(e) => updateField('locality', e.target.value)}
              placeholder="e.g. Old City &amp; Fatehsagar Lake"
              className="mt-1 w-full rounded-2xl border border-line p-3"
            />
          </label>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Event Languages Conducted</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {['Hindi', 'English', 'Mewari', 'Gujarati', 'French', 'Spanish'].map((lang) => (
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
              Continue to Confirmations →
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Confirmations & Guidelines */}
      {step === 3 && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
          <h2 className="text-xl font-medium">3. Hosting Declarations</h2>
          <p className="text-xs text-muted-paper">
            MIRAS events must be authentic, culturally respectful, and safely organized.
          </p>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.accuracyConfirmed}
                onChange={(e) => updateField('accuracyConfirmed', e.target.checked)}
                className="mt-1"
              />
              <span className="text-xs text-ink leading-relaxed">
                <strong>Event Accuracy &amp; Responsibility:</strong> I confirm that events listed under this account will be accurately described, properly scheduled, and conducted with respect for local communities and heritage monuments.
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
                <strong>Event Guidelines &amp; Role Isolation:</strong> I understand that an Event Manager role is dedicated to hosting events, walks, and workshops. It does not provide access to artisan craft shops or commercial product listings.
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
              {busy ? 'Registering…' : 'Complete Event Manager Registration'}
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: Success & Dashboard Launch */}
      {step === 4 && createdProfile && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-5 text-center">
          <div className="w-16 h-16 bg-[#eaf1f2] text-ink rounded-full flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-medium">Registration Complete!</h2>
            <p className="text-sm text-muted-paper">
              <strong>{createdProfile.organizationName}</strong> is registered on MIRAS.
            </p>
          </div>

          {recoveryCode && (
            <div className="bg-[#f5f8f9] p-4 rounded-2xl border border-line text-left space-y-2">
              <p className="text-xs font-semibold text-ink uppercase tracking-wider">Save Your Recovery Code</p>
              <p className="text-xs text-muted-paper">
                Store this code safely. You will need it to recover access if you lose your password.
              </p>
              <code className="block bg-white p-2.5 rounded-xl border border-line text-xs break-all font-mono">
                {recoveryCode}
              </code>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/event-manager/dashboard"
              className="feature-primary w-full py-3 text-center block text-sm font-medium"
            >
              Go to Event Manager Dashboard ↗
            </Link>
            <Link
              href="/events"
              className="feature-secondary w-full py-2.5 text-center block text-sm"
            >
              Explore Public Events ↗
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
