// Udaipur events & workshops – collected on 1 Nov 2026 from the organisers' / listing pages linked in
// `source`. Dates are real; ticket status is as of that day, so always confirm on the booking page.
// status: on-sale | few-left | sold-out | free | at-venue | tba (dates/tickets not announced yet)
// ticketsLiveAt: when tickets open – travellers can set a "tell me when tickets go live" reminder.

export const EVENTS_CHECKED = '2026-11-01';

export const CATEGORIES = {
  tech: { label: 'Tech', emoji: '💻', color: '#2563eb' },
  music: { label: 'Music', emoji: '🎵', color: '#7c3aed' },
  comedy: { label: 'Comedy', emoji: '😂', color: '#d97706' },
  party: { label: 'Party', emoji: '🎉', color: '#db2777' },
  mela: { label: 'Festival & mela', emoji: '🪔', color: '#b4532a' },
  workshop: { label: 'Workshop', emoji: '🛠️', color: '#0f766e' },
  community: { label: 'Community', emoji: '🤝', color: '#15803d' },
  business: { label: 'Business', emoji: '💼', color: '#475569' },
  wellness: { label: 'Wellness', emoji: '🧘', color: '#0891b2' },
};

const TS = 'Third Space, Pulla Bhuwana';
const TS_INSTA = 'https://www.instagram.com/thirdspace_udr/';
const TS_TICKETS = 'https://tickets.third-space.in/DTSCustomerWeb/home';
const AE = 'allevents.in';

export const EVENTS = [
  // ------------------------------------------------------------------ featured / requested
  {
    id: 'ccd-udaipur-2026', featured: true, category: 'tech', title: 'Google Cloud Community Days Udaipur 2026',
    organiser: 'GDG Cloud Udaipur', start: '2026-12-20T09:00', end: '2026-12-20T18:00', venue: TS,
    price: 'From ₹800', status: 'few-left',
    about: 'The flagship annual event of GDG Cloud Udaipur – a day of talks, hands-on sessions and networking for developers, cloud enthusiasts, founders and tech leaders. Deep dives into Google Cloud, Generative AI and agentic workflows, with live demos and a distinct Udaipur flavour.',
    tiers: [
      { name: 'Early bird', price: '₹400', status: 'sold-out' },
      { name: 'Regular', price: '₹500', status: 'sold-out' },
      { name: 'Late bird', price: '₹800', status: 'few-left', note: 'Only a few left' },
      { name: 'Super late bird', price: '₹1,200', status: 'on-sale', note: 'Final pass for this year' },
    ],
    includes: ['All-day entry & main-stage keynote', 'Hands-on sessions & masterclasses', 'CCD Udaipur ’26 merch pack', 'Breakfast, buffet lunch & high tea'],
    bookingUrl: 'https://konfhub.com/google-cloud-community-days-udaipur-2026', bookingSite: 'KonfHub',
    source: 'https://konfhub.com/google-cloud-community-days-udaipur-2026',
  },
  {
    id: 'masst-26', featured: true, category: 'mela', title: 'MASST ’26 – art, workshops, music, masti & dosti',
    organiser: 'Third Space', start: '2026-11-14T10:00', end: '2026-11-15T22:00', venue: TS,
    price: 'From ₹360', status: 'on-sale',
    about: 'A two-day festival at Third Space: spend the days making, learning, exploring and meeting new people, then stay for the Sundowner shows. Workshop seats are limited and first-come, first-served.',
    tiers: [
      { name: 'One-day power pass', price: '₹360', status: 'on-sale', note: '2 workshop tokens + 1 Sundowner show' },
      { name: 'Two-day journey pass', price: 'See site', status: 'on-sale', note: '4 workshop tokens + both Sundowner shows' },
      { name: 'Sunset pass', price: 'See site', status: 'on-sale', note: 'Sundowner show only – on sale from 1 Nov' },
    ],
    includes: ['Group, member & student discounts at the Third Space info point'],
    bookingUrl: TS_TICKETS, bookingSite: 'Third Space tickets', source: TS_TICKETS,
  },
  {
    id: 'jamming-adda', featured: true, category: 'music', title: 'Jamming Adda by Third Space',
    organiser: 'Third Space', start: null, end: null, venue: TS, recurring: 'Twice a month · 5–8 PM',
    price: 'Entry details on Instagram', status: 'tba',
    about: 'An open community jam: bring your instrument, your favourite songs, poetry or stories – or just come to listen to live acoustic music and meet people. The next dates are announced on Third Space’s Instagram – set a reminder and we’ll tell you.',
    bookingUrl: TS_INSTA, bookingSite: 'Instagram @thirdspace_udr', source: TS_INSTA,
  },
  // ------------------------------------------------------------------ upcoming (allevents.in & organisers)
  { id: 'baithak-diwali', category: 'music', title: 'The Baithak Returns this Diwali', organiser: 'Jaman', start: '2026-11-01T19:30', venue: 'Jaman, Udaipur', price: '₹1,500', status: 'on-sale', about: 'An intimate Diwali-evening baithak of live music.', bookingUrl: 'https://allevents.in/udaipur/the-baithak-returns-this-diwali/4100030902276907', bookingSite: AE },
  { id: 'creative-reset-diwali', category: 'workshop', title: 'Creative Reset x Diwali', organiser: 'Founder’s Caffe', start: '2026-11-01T16:30', venue: 'Founder’s Caffe, Udaipur', price: '₹549', status: 'on-sale', about: 'A Diwali-themed creative workshop to slow down and make something with your hands.', bookingUrl: 'https://allevents.in/udaipur/creative-reset-x-diwali-tickets/80001382787800', bookingSite: AE },
  { id: 'diwali-kyra', category: 'party', title: 'Diwali at Kyra', organiser: 'Kyra Bistro Lounge', start: '2026-11-07T19:00', venue: 'Kyra Bistro Lounge, City Centre', price: '₹1,500', status: 'on-sale', about: 'Diwali night party at Kyra.', bookingUrl: 'https://allevents.in/udaipur/diwali-at-kyra/4100030877975237', bookingSite: AE },
  { id: 'blabla-12nov', category: 'community', title: 'Udaipur BlaBla Language Exchange', organiser: 'BlaBla Language Exchange', start: '2026-11-12T20:00', venue: 'Udaipur', recurring: 'Every other Thursday', price: 'See listing', status: 'on-sale', about: 'Meet locals and travellers to practise languages over a drink – a great way for tourists to meet Udaipurites.', bookingUrl: 'https://allevents.in/udaipur/udaipur-blabla-language-exchange-every-other-thursday-recurrent-event/200030515184848', bookingSite: AE },
  { id: 'straight-up', category: 'comedy', title: 'STRAIGHT UP – stand-up solo by Jaspreet Singh', organiser: 'Jaspreet Singh', start: '2026-11-15T19:00', venue: 'Atal Bihari Vajpayee Sabhagar', price: 'See listing', status: 'on-sale', about: 'Stand-up comedy solo show.', bookingUrl: 'https://allevents.in/udaipur/straight-up-a-stand-up-solo-by-jaspreet-singh/3900030688151401', bookingSite: AE },
  { id: 'korero', category: 'business', title: 'Korero Founders Forum', organiser: 'Korero', start: '2026-11-18T10:00', venue: 'Taj Aravali Resort & Spa', price: 'Free', status: 'free', about: 'A forum for founders and business leaders.', bookingUrl: 'https://allevents.in/udaipur/korero-founders-forum-tickets/80001948244816', bookingSite: AE },
  { id: 'kullu', category: 'comedy', title: 'Kullu Being Kullu – Aaditya Kulshreshth', organiser: 'Aaditya Kulshreshth', start: '2026-11-20T20:00', venue: 'Atal Bihari Vajpayee Sabhagar', price: 'See listing', status: 'on-sale', about: 'Stand-up comedy by Aaditya Kulshreshth (Kullu).', bookingUrl: 'https://allevents.in/udaipur/kullu-being-kullu-by-aaditya-kulshreshth/3900030817195335', bookingSite: AE },
  { id: 'baap-baap', category: 'comedy', title: 'Baap Baap Hota Hai ft. Mayank Wadhwani', organiser: 'Mayank Wadhwani', start: '2026-11-27T19:30', venue: 'The Oven Project Cafe', price: 'See listing', status: 'on-sale', about: 'Stand-up comedy.', bookingUrl: 'https://allevents.in/udaipur/baap-baap-hota-hai-ft-mayank-wadhwani/3900030860833609', bookingSite: AE },
  { id: 'soulful-retreat', category: 'wellness', title: 'Soulful Business Leaders Retreat', organiser: 'Soulful', start: '2026-11-27T12:00', venue: 'Udaipur', price: '₹25,000', status: 'on-sale', about: 'A retreat for business leaders combining reflection and networking.', bookingUrl: 'https://allevents.in/udaipur/soulful-business-leaders-retreat-tickets/80002062760606', bookingSite: AE },
  { id: 'kal-ki-chinta', category: 'comedy', title: 'Kal Ki Chinta Nahi Karta ft. Ravi Gupta', organiser: 'Ravi Gupta', start: '2026-11-28T19:00', venue: 'Sukhadia Rangmanch', price: 'See listing', status: 'on-sale', about: 'Stand-up comedy by Ravi Gupta.', bookingUrl: 'https://allevents.in/udaipur/kal-ki-chinta-nahi-karta-ft-ravi-gupta/3900030764278742', bookingSite: AE },
  { id: 'blunt-onkar', category: 'comedy', title: 'BLUNT ft. Onkar', organiser: 'Onkar', start: '2026-12-13T19:00', venue: 'Venue to be announced', price: 'See listing', status: 'on-sale', about: 'Stand-up comedy. Venue to be announced.', bookingUrl: 'https://allevents.in/udaipur/blunt-ft-onkar/3900030398271828', bookingSite: AE },
  { id: 'rajat-sood', category: 'comedy', title: 'I Am Worth It ft. Rajat Sood', organiser: 'Rajat Sood', start: '2026-12-18T21:00', venue: 'Bhartiya Lok Kala Mandal', price: 'See listing', status: 'on-sale', about: 'Stand-up comedy by Rajat Sood.', bookingUrl: 'https://allevents.in/udaipur/i-am-worth-it-ft-rajat-sood/3900030917370904', bookingSite: AE },
  {
    id: 'shilpgram-2026', featured: true, category: 'mela', title: 'Shilpgram Utsav 2026', organiser: 'West Zone Cultural Centre (WZCC)',
    start: '2026-12-21T12:00', end: '2026-12-30T22:00', venue: 'Shilpgram, Hawala', price: 'Entry ticket at the gate', status: 'at-venue',
    about: 'Udaipur’s ten-day crafts and folk mela: artisans from across India, folk dance and music performances, food stalls and craft workshops in the Aravalli hills.',
    bookingUrl: 'https://wzccindia.com', bookingSite: 'WZCC', source: 'https://wzccindia.com',
  },
  { id: 'photowalk-dec', category: 'community', title: 'Make Friends & Photowalk Meetup', organiser: 'Photowalk community', start: '2026-12-26T10:00', venue: 'Udaipur', price: 'See listing', status: 'on-sale', about: 'Meet new people on a photo walk around Udaipur.', bookingUrl: 'https://allevents.in/udaipur/make-friends-and-photowalk-meetup/200030052277624', bookingSite: AE },
  {
    id: 'uwmf-2027', category: 'music', title: 'Udaipur World Music Festival 2027', organiser: 'Seher', start: null, expected: 'Usually early February', venue: 'Udaipur',
    price: 'Tickets not out yet', status: 'tba',
    about: 'India’s festival of world music – artists from 15+ countries across Udaipur’s venues. The 2027 dates and passes haven’t been announced yet; set a reminder to hear when tickets go live.',
    bookingUrl: 'https://www.udaipurworldmusicfestival.com', bookingSite: 'udaipurworldmusicfestival.com', source: 'https://www.udaipurworldmusicfestival.com',
  },
  { id: 'holi-devra', category: 'party', title: 'Holi Festival at Devra Udaipur', organiser: 'Devra', start: '2027-03-22T10:00', venue: 'Devra, Pratap Nagar', price: 'See listing', status: 'on-sale', about: 'Celebrate Holi with colours, music and food.', bookingUrl: 'https://allevents.in/udaipur/holi-festival-at-devra-udaipur/200030805192038', bookingSite: AE },
  { id: 'anmute', category: 'wellness', title: 'ANMUTE – Udaipur: Lakes & Stillness', organiser: 'ANMUTE', start: '2027-03-20T12:00', venue: 'Udaipur', price: '₹999', status: 'on-sale', about: 'A slow, mindful experience around Udaipur’s lakes.', bookingUrl: 'https://allevents.in/udaipur/anmute-udaipur-lakes-and-stillness-tickets/80001412077149', bookingSite: AE },
  {
    id: 'mewar-2027', category: 'mela', title: 'Mewar Festival & Gangaur 2027', organiser: 'Rajasthan Tourism', start: null, expected: 'Around Gangaur, March/April', venue: 'Gangaur Ghat',
    price: 'Free', status: 'tba',
    about: 'Udaipur welcomes spring with Gangaur processions to Gangaur Ghat, boat processions on Lake Pichola, folk performances and fireworks. Official 2027 dates are not out yet.',
    bookingUrl: 'https://utsav.gov.in', bookingSite: 'utsav.gov.in',
  },

  // ------------------------------------------------------------------ past
  { id: 'jamming-adda-24oct', category: 'music', title: 'Jamming Adda by Third Space', organiser: 'Third Space', start: '2026-10-24T17:00', end: '2026-10-24T20:00', venue: TS, price: 'Entry details on Instagram', status: 'past', about: 'Open community jam session.', bookingUrl: TS_INSTA, bookingSite: 'Instagram' },
  { id: 'jamming-adda-10oct', category: 'music', title: 'Jamming Adda by Third Space', organiser: 'Third Space', start: '2026-10-10T17:00', end: '2026-10-10T20:00', venue: TS, price: 'Entry details on Instagram', status: 'past', about: 'Open community jam session.', bookingUrl: TS_INSTA, bookingSite: 'Instagram' },
  { id: 'creative-adda-jul', category: 'workshop', title: 'Creative Adda at Third Space', organiser: 'Third Space', start: '2026-07-19T16:00', venue: TS, price: 'See Instagram', status: 'past', about: 'Come paint, sketch, make stuff, meet people and hang around a little.', bookingUrl: TS_INSTA, bookingSite: 'Instagram' },
  { id: 'creative-adda-may', category: 'workshop', title: 'Creative Adda begins at Third Space', organiser: 'Third Space', start: '2026-05-17T16:00', venue: TS, price: 'See Instagram', status: 'past', about: 'The first Sunday Creative Adda – painting, sketching and making.', bookingUrl: TS_INSTA, bookingSite: 'Instagram' },
  { id: 'mewar-2026', category: 'mela', title: 'Mewar Festival & Gangaur 2026', organiser: 'Rajasthan Tourism', start: '2026-03-21T16:00', end: '2026-03-23T22:00', venue: 'Gangaur Ghat', price: 'Free', status: 'past', about: 'Gangaur processions, folk performances and boat processions on Lake Pichola.', bookingUrl: 'https://utsav.gov.in', bookingSite: 'utsav.gov.in' },
  { id: 'uwmf-2026', category: 'music', title: 'Vedanta Udaipur World Music Festival 2026 (10th edition)', organiser: 'Seher', start: '2026-02-06T18:00', end: '2026-02-08T22:00', venue: 'Gandhi Ground & more', price: 'Free & paid passes', status: 'past', about: 'The 10th edition – global artists and Rajasthani folk orchestras across Udaipur.', bookingUrl: 'https://www.udaipurworldmusicfestival.com', bookingSite: 'udaipurworldmusicfestival.com' },
  { id: 'shilpgram-2025', category: 'mela', title: 'Shilpgram Utsav 2025', organiser: 'WZCC', start: '2025-12-21T12:00', end: '2025-12-30T22:00', venue: 'Shilpgram, Hawala', price: 'Entry ticket at the gate', status: 'past', about: 'Ten-day crafts and folk festival.', bookingUrl: 'https://wzccindia.com', bookingSite: 'WZCC' },
  { id: 'masst-25', category: 'mela', title: 'MASST ’25', organiser: 'Third Space', start: '2025-11-14T10:00', end: '2025-11-16T22:00', venue: TS, price: 'Passes', status: 'past', about: 'Three days of workshops, art and Sundowner shows.', bookingUrl: TS_INSTA, bookingSite: 'Instagram' },
  { id: 'ccd-2025', category: 'tech', title: 'Google Cloud Community Days 2025', organiser: 'GDG Cloud Udaipur', start: '2025-06-29T09:00', end: '2025-06-29T17:00', venue: TS, price: '₹200–₹450', status: 'past', about: 'Talks on GCP, AI/ML and DevOps, certification prep, career and startup panels.', bookingUrl: 'https://konfhub.com/google-cloud-community-days-2025', bookingSite: 'KonfHub' },
];

// Demo: what some mock travellers / locals have done with events
export const MOCK_EVENT_PREFS = {
  meera_solo: { 'masst-26': { going: true }, 'uwmf-2026': { going: true, attended: true }, 'jamming-adda-24oct': { going: true, attended: true } },
  priya_wanders: { 'shilpgram-2026': { going: true }, 'uwmf-2026': { attended: true } },
  nandini_udaipur: { 'mewar-2026': { attended: true }, 'shilpgram-2026': { going: true } },
  zoya_lakeside: { 'jamming-adda-10oct': { attended: true } },
};
export const MOCK_EVENT_REMINDERS = [
  { id: 'er1', user: 'meera_solo', eventId: 'uwmf-2027', kind: 'tickets', createdAt: '2026-10-20T10:00:00.000Z' },
];
