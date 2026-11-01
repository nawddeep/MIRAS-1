# MIRAS Groups

Travel together in Udaipur: private groups, public groups, solo travel and shared itineraries.
React + Vite prototype. All data is stored in your browser (no login, no server).

## Run it

```
npm install
npm run dev
```

Open http://localhost:5180 (on a phone on the same Wi-Fi, use the "Network" address Vite prints).

## Features

1. **Traveller account** - name + unique MIRAS username (e.g. `@riya_kapoor`), no login.
2. **Start options** - Make a group · Join a group (code) · Travel solo & explore · Browse public groups.
3. **Private groups** - the leader adds/removes people by MIRAS username, shares an invite code;
   people who use the code send a join request the leader accepts or declines.
4. **Public groups** - anyone (incl. solo travellers) joins instantly and can leave any time.
5. **Itinerary** - the leader adds/edits stops by day and time. Members suggest a new stop, a change,
   or a removal (with a reason). The leader accepts (itinerary updates automatically) or rejects,
   always with a comment explaining why - visible to the whole group.
6. **Group chat** - members chat in each group; joins, leaves, decisions and closed polls appear as
   short system notes in the chat.
7. **Polls (inside the chat)** - tap 📊 Poll in the chat to ask the group (single or multiple answers,
   up to 6 options, quick templates). Members vote right in the chat and see live results and who
   voted. The poll creator or the leader can close it - the winner is announced in the chat.

8. **Local Friends** - people from Udaipur sign up as a *Local Friend* (area, languages, what they
   love showing, and their **fee** per day / half-day / trip - Local Friends are **paid only**, min ₹100).
   Every local must **link DigiLocker** (mocked: any Indian mobile, OTP `123456`, consent) before they can
   be listed - only a verified flag, document type, masked ID and date are kept. Travellers browse the
   Local Friends directory (only verified locals, budget filter, topics, search) and send a request - for a solo trip or
   for a group they lead. The local accepts or declines in their **Hosting** dashboard. Once accepted
   the local joins the group chat and suggests itinerary changes, shown as **🤝 Local tips** for the
   leader to accept or reject. For solo travellers a private trip space (chat + itinerary) is created
   for the two of them. Payments are agreed directly with the local (not handled in this prototype).

9. **Privacy policy** - one policy covering tourists and Local Friends (what is collected, DigiLocker
   data handling, what each side sees about the other, no automatic sharing of phone/email, safety,
   rights). Everyone accepts it when creating an account; it is linked from sign-up, profile, local
   requests and the Hosting dashboard. Drafted for the prototype - get it legally reviewed (e.g. DPDP Act 2023).

10. **Two-way reviews** - when a trip with a Local Friend ends, a *Rate your trip* card appears for
    14 days. Travellers rate the local (1-5 stars, optional category stars, tags, text, "didn't show up",
    private safety report) - shown publicly on the local's profile. The local rates each traveller -
    visible to other locals only (shown on incoming requests). Reviews are **blind** until both sides
    have reviewed or the window closes; editable for 48 h; one public reply; reviews can be reported.
    Low ratings, low safety scores and no-shows are auto-flagged for MIRAS.

11. **Verified-tag lifecycle** - DigiLocker verification lasts 12 months (reminder 30 days before,
    *Renew* in Hosting). A name mismatch goes to manual review. Changing your profile name, withdrawing
    consent, expiry, or a MIRAS suspension removes the tag: the local is hidden, pending requests are
    auto-declined and upcoming trips are flagged so the leader can keep or remove them. Suspended locals
    can appeal. Every change is logged with a reason and the local is notified.

12. **Merit tiers** - 🌱 New Friend, ⭐ Trusted Friend (5+ trips, 4.3+), 🏅 Top Local (20+ trips, 4.7+,
    90%+ response, ≤5% cancellations, active in 90 days), 👑 Udaipur Legend (50+ trips, 4.8+, 1+ year).
    Ratings use a Bayesian average so a few reviews can't swing it. Promotions are instant; drops get a
    30-day grace period, except a confirmed safety report (instant). Tiers set the maximum fee and rank
    locals higher in the directory; Hosting shows progress to the next tier. Travellers with 3+ reviews
    averaging 4.5+ get a 🏡 *Good guest* badge.

13. **Notifications & admin console** - 🔔 in the top bar; *Admin console (demo)* in the account menu
    for the verification queue, reports, appeals and suspending / restoring locals.

14. **Events & workshops** - discover what's on in Udaipur (tech, music, comedy, parties, festivals &
    melas, workshops, community, business, wellness): upcoming, past and *My events* (going, reminders,
    attended, "did you go?"). Filter by category, time and free events; featured picks on top. Booking
    redirects to the organiser's page (KonfHub, Third Space tickets, allevents.in, WZCC...). Set
    reminders for when tickets go live / dates are announced and for the day before; add to calendar
    (.ics); share an event into a group chat. Admins publish dates and ticket status from the admin console,
    which notifies everyone with a reminder. Real data collected on 1 Nov 2026 lives in `src/eventsData.js`
    (includes Google Cloud Community Days Udaipur 2026 and Jamming Adda by Third Space) - refresh it
    regularly or connect a live source before launch.

## Demo tips

- Use **Viewing as** (top right) to switch traveller and try both sides: e.g. request to join as
  `@rohan_trails`, then switch back to the leader and accept.
- Invite codes in the mock data: `MIR-LAKE42`, `MIR-FOOD77`, `MIR-FORT11` (public),
  `MIR-SHRM58`, `MIR-ARTS93` (private).
- Local friends in the mock data: `@nandini_udaipur`, `@bhanu_hikes`, `@arjun_mewar`,
  `@zoya_lakeside`, `@ritu_crafts`, `@vikram_rides` (all paid and DigiLocker-verified). Switch to `@arjun_mewar` to see a pending
  request from a solo traveller in **Hosting**. The *Old City Food Trail* group already has a local friend.
- Reviews: as `@meera_solo` open *Meera's Udaipur trip with Zoya* - Zoya has already reviewed her
  (hidden until Meera rates Zoya). Switch to `@zoya_lakeside` → Hosting → *Reviews & tier* to reply.
- Tiers: `@bhanu_hikes` is in the 30-day grace period; `@arjun_mewar`'s verification expires in 20 days;
  `@kiran_kayak` has expired; `@manoj_tours` is suspended and can appeal.
- Profile → **Reset demo data** restores the mock travellers and groups.

## Files

- `src/mockData.js` - mock travellers and groups
- `src/store.jsx` - state, all group actions, saved to localStorage
- `src/components/pages.jsx` - account, start options, explore, join, create, my groups, profile
- `src/components/GroupPage.jsx` - group page: itinerary, suggestions, members, invite code, requests
- `src/components/Chat.jsx` - group chat and polls
- `src/components/Locals.jsx` - Local Friends directory, requests, Hosting dashboard, local profile & pricing
- `src/trust.js` - all trust rules: verification states, review visibility, ratings, tiers
- `src/components/Trust.jsx` - privacy policy, consent checkbox, mock DigiLocker verification
- `src/components/Reviews.jsx` - review form, rate-your-trip card, tier badge & progress, verification panel, notifications
- `src/eventsData.js` - Udaipur events (collected 1 Nov 2026) + categories
- `src/components/Events.jsx` - events page, detail, reminders, calendar, share to chat, admin publishing
- `src/components/Admin.jsx` - trust & safety console (demo)
- `src/styles.css` - styles
