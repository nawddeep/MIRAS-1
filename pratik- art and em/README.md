# MIRAS — Artisan Marketplace & Event Management Platform

A modern, mobile-first Web Application for **Udaipur Heritage, Master Artisans, and Cultural Event Management**, built with **Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, and SQLite**.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Pre-Seeded Demo Credentials

The included SQLite database (`data/miras.db`) is already pre-configured with a universal demo account ready for immediate testing:

- **Username:** `123`
- **Password:** `123`

This single account is pre-linked to:
1. **Artisan Shop:** *Mohan Miniature & Heritage Arts (123)* with 3 published craft products and workshop hosting.
2. **Event Manager Profile:** *Udaipur Heritage Experiences Collective (123)* with heritage walks and attendee inquiries.
3. **Local Friend Profile:** Verified Mewari art guide.

---

## 📱 Page & Route Map

### 1. Artisan Portal
- `/artisans` — Public directory of master artisans and craft shops
- `/artisans/login` — Dedicated artisan sign-in portal
- `/artisans/register` — 4-step artisan onboarding flow (Account, Shop Details, Rights, Verification)
- `/artisan/dashboard` — Complete 8-tab artisan workspace:
  1. *Overview* (Metrics, quick shortcuts)
  2. *My Shop* (Profile, craft category, story, photos)
  3. *My Products* (Catalog, price, materials, inventory availability)
  4. *Enquiries* (Direct customer inquiries with WhatsApp / reply actions)
  5. *Craft Workshops* (Host hands-on craft sessions)
  6. *Local Friend* (Opt-in traveler connection)
  7. *Reviews* (Customer testimonials and feedback)
  8. *Settings* (Shop visibility & account settings)
- `/shops/[slug]` — Public storefront for verified artisan listings
- `/shops/[slug]/products/[productId]` — Detailed product page with custom order inquiry

### 2. Event Manager Portal
- `/events` — Public calendar with category filtering (Workshops, Walks, Cultural, Festivals)
- `/events/login` — Dedicated event manager sign-in portal
- `/events/register` — 4-step organizer onboarding flow
- `/event-manager/dashboard` — Complete 7-tab event management workspace:
  1. *Overview* (Event counts, capacity metrics)
  2. *Profile* (Organization details, contact info, logo)
  3. *My Events* (Create, publish, edit walks & cultural events)
  4. *Attendee Inquiries* (Direct booking requests & communications)
  5. *Local Friend* (Opt-in local host availability)
  6. *Reviews* (Attendee ratings and reviews)
  7. *Settings* (Organization settings)
- `/events/[id]` — Detailed public event page with booking inquiry modal

### 3. Shared Discovery & Account Hub
- `/local-friends` — Shared network of verified artisan makers and local experience hosts
- `/account` — Universal account management, role selector, password recovery, and quick workspace switcher
- `/` — Dedicated landing portal highlighting Artisans & Events with one-click navigation

---

## 🛠️ Tech Stack & Architecture

- **Framework:** Next.js 16 (App Router + Turbopack)
- **UI & Styling:** Tailwind CSS 4, Hind & Tiro Devanagari typography, mobile-first cards and bottom navigation
- **Database:** SQLite (`data/miras.db`) via `better-sqlite3` with foreign key enforcement and WAL mode
- **Authentication:** Scrypt-hashed passwords, HTTP-only secure session cookies, role-based server guards (`requireRole`, `requireArtisan`, `requireEventManager`), CSRF origin protection with proxy/tunnel awareness
- **Validation:** Zod schemas for all form and API inputs
