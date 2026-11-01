import { MOCK_EVENT_PREFS, MOCK_EVENT_REMINDERS } from './eventsData.js';
// Mock data for the MIRAS Groups prototype. Everything is stored in the browser
// (localStorage); "Reset demo data" in the profile restores this file.

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

export const MOCK_USERS = {
  aarav_explores: { username: 'aarav_explores', name: 'Aarav Mehta', city: 'Mumbai', style: 'Culture & history', bio: 'Forts, stepwells and chai stops.', color: '#c2410c' },
  priya_wanders: { username: 'priya_wanders', name: 'Priya Sharma', city: 'Delhi', style: 'Photography', bio: 'Chasing golden hour across Rajasthan.', color: '#7c3aed' , guest: { rating: 4.9, reviews: 4 } },
  rohan_trails: { username: 'rohan_trails', name: 'Rohan Iyer', city: 'Bengaluru', style: 'Adventure', bio: 'Hikes, cycles, sunrises.', color: '#0f766e' , guest: { rating: 4.2, reviews: 2 } },
  meera_solo: { username: 'meera_solo', name: 'Meera Nair', city: 'Kochi', style: 'Solo & slow travel', bio: 'One backpack, many stories.', color: '#be185d' , guest: { rating: 4.8, reviews: 6 } },
  kabir_foodie: { username: 'kabir_foodie', name: 'Kabir Singh', city: 'Jaipur', style: 'Food trails', bio: 'Will travel 20 km for the right kachori.', color: '#b45309' , guest: { rating: 4.6, reviews: 3 } },
  ananya_art: { username: 'ananya_art', name: 'Ananya Rao', city: 'Hyderabad', style: 'Art & crafts', bio: 'Miniature paintings and block prints.', color: '#2563eb' },
  vikram_rides: { username: 'vikram_rides', name: 'Vikram Chauhan', city: 'Udaipur', style: 'Local guide', bio: 'Born by Lake Pichola. Ask me anything.', color: '#15803d', type: 'local',
    local: { area: 'Gangaur Ghat', languages: ['Hindi', 'English', 'Mewari'], expertise: ['Lakes & ghats', 'History', 'Boat rides'], about: 'Third-generation boatman’s son. I know every ghat and the best sunset spots.', years: 34, pricing: { mode: 'paid', amount: 1200, unit: 'day' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 4821', verifiedAt: ago(24 * 40) }, rating: 4.9, reviews: 38, hosted: 41, responseRate: 0.96, cancelRate: 0.02, lastTripAt: day(-10), since: ago(24 * 1100) } },
  sara_nomad: { username: 'sara_nomad', name: 'Sara Khan', city: 'Pune', style: 'Digital nomad', bio: 'Working from cafés with a view.', color: '#9333ea' },
  dev_heritage: { username: 'dev_heritage', name: 'Dev Patel', city: 'Ahmedabad', style: 'Architecture', bio: 'Jharokhas make me emotional.', color: '#a16207' },
  isha_dance: { username: 'isha_dance', name: 'Isha Gupta', city: 'Lucknow', style: 'Music & dance', bio: 'Here for Dharohar folk evenings.', color: '#db2777' },
  // ---- Udaipur locals (Local Friends)
  nandini_udaipur: { username: 'nandini_udaipur', name: 'Nandini Mehta', city: 'Udaipur', style: 'Local friend', bio: 'Old-city foodie & storyteller.', color: '#e11d48', type: 'local',
    local: { area: 'Jagdish Chowk, Old City', languages: ['Hindi', 'English', 'Gujarati'], expertise: ['Street food', 'Old city walks', 'Hidden cafés'], about: 'I grew up in the lanes behind Jagdish Temple. I’ll take you to the kachori stall my grandfather swore by.', years: 26, pricing: { mode: 'paid', amount: 600, unit: 'half-day' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 7310', verifiedAt: ago(24 * 40) }, rating: 4.9, reviews: 52, hosted: 60, responseRate: 0.98, cancelRate: 0.01, lastTripAt: day(-12), since: ago(24 * 900) } },
  arjun_mewar: { username: 'arjun_mewar', name: 'Arjun Singh Rathore', city: 'Udaipur', style: 'Local friend', bio: 'History nerd from a Mewar family.', color: '#7c2d12', type: 'local',
    local: { area: 'Near City Palace', languages: ['Hindi', 'English', 'French'], expertise: ['History', 'Palaces & forts', 'Royal stories'], about: 'Studied history in Jaipur, came home to Udaipur. I make the stories of Maharana Pratap come alive.', years: 31, pricing: { mode: 'paid', amount: 1500, unit: 'day' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 5562', verifiedAt: ago(24 * 345) }, rating: 4.9, reviews: 27, hosted: 30, responseRate: 0.92, cancelRate: 0.03, lastTripAt: day(-20), since: ago(24 * 700) } },
  zoya_lakeside: { username: 'zoya_lakeside', name: 'Zoya Ali', city: 'Udaipur', style: 'Local friend', bio: 'Photographer. Sunrise chaser.', color: '#0e7490', type: 'local',
    local: { area: 'Ambrai Ghat', languages: ['Hindi', 'English', 'Urdu'], expertise: ['Photography', 'Sunrise & sunsets', 'Lakes & ghats'], about: 'I shoot Udaipur every morning. Come along and I’ll show you the angles nobody else knows.', years: 24, pricing: { mode: 'paid', amount: 800, unit: 'half-day' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 0947', verifiedAt: ago(24 * 40) }, rating: 4.7, reviews: 19, hosted: 22, responseRate: 0.82, cancelRate: 0.04, lastTripAt: day(-25), since: ago(24 * 500) } },
  bhanu_hikes: { username: 'bhanu_hikes', name: 'Bhanu Pratap', city: 'Udaipur', style: 'Local friend', bio: 'Cyclist, trekker, chai addict.', color: '#4d7c0f', type: 'local',
    local: { area: 'Fateh Sagar', languages: ['Hindi', 'English'], expertise: ['Treks & cycling', 'Aravalli hills', 'Sunrise & sunsets'], about: 'Weekend trails around Sajjangarh and Badi lake – just bring water and good shoes!', years: 29, pricing: { mode: 'paid', amount: 700, unit: 'day' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 3318', verifiedAt: ago(24 * 40) }, rating: 4.6, reviews: 15, hosted: 18, responseRate: 0.93, cancelRate: 0.02, lastTripAt: day(-40), since: ago(24 * 600), tierState: { current: 'top', since: ago(24 * 200), warning: { to: 'trusted', at: ago(24 * 5) } } } },
  ritu_crafts: { username: 'ritu_crafts', name: 'Ritu Soni', city: 'Udaipur', style: 'Local friend', bio: 'Miniature painter & craft lover.', color: '#9d174d', type: 'local',
    local: { area: 'Hathi Pol bazaar', languages: ['Hindi', 'English', 'Marwari'], expertise: ['Art & crafts', 'Shopping', 'Workshops'], about: 'Third-generation miniature painter. I take you to artisans who still work the traditional way – fair prices, no commissions.', years: 38, pricing: { mode: 'paid', amount: 2000, unit: 'trip' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 6204', verifiedAt: ago(24 * 40) }, rating: 5.0, reviews: 11, hosted: 12, responseRate: 0.95, cancelRate: 0, lastTripAt: day(-15), since: ago(24 * 400) } },
  kiran_kayak: { username: 'kiran_kayak', name: 'Kiran Dave', city: 'Udaipur', style: 'Local friend', bio: 'Kayaks and lake trivia.', color: '#0369a1', type: 'local',
    local: { area: 'Rang Sagar', languages: ['Hindi', 'English'], expertise: ['Lakes & ghats', 'Boat rides'], about: 'Paddle the quieter lakes with me.', years: 21, pricing: { mode: 'paid', amount: 900, unit: 'half-day' }, verification: { provider: 'DigiLocker', document: 'Aadhaar', masked: 'XXXX XXXX 2290', verifiedAt: ago(24 * 372) }, rating: 4.5, reviews: 6, hosted: 7, responseRate: 0.9, cancelRate: 0, lastTripAt: day(-60), since: ago(24 * 372) } },
  manoj_tours: { username: 'manoj_tours', name: 'Manoj Kumar', city: 'Udaipur', style: 'Local friend', bio: 'Day trips around Udaipur.', color: '#57534e', type: 'local',
    local: { area: 'Surajpole', languages: ['Hindi', 'English'], expertise: ['Day trips', 'Shopping'], about: 'Kumbhalgarh, Ranakpur and more.', years: 30, pricing: { mode: 'paid', amount: 1800, unit: 'day' },
      verification: { provider: 'DigiLocker', document: 'Driving Licence', masked: 'RJ27 XXXXXXX41', verifiedAt: ago(24 * 200), status: 'suspended', reason: 'Two travellers reported pressure to shop at commission stores', history: [{ status: 'verified', reason: 'Verified with DigiLocker', at: ago(24 * 200), by: 'DigiLocker' }, { status: 'suspended', reason: 'Two travellers reported pressure to shop at commission stores', at: ago(24 * 3), by: 'MIRAS admin' }] },
      rating: 3.9, reviews: 14, hosted: 16, responseRate: 0.8, cancelRate: 0.1, lastTripAt: day(-8), since: ago(24 * 200), listed: false } },
};

export const MOCK_GROUPS = [
  {
    id: 'g-lake-sunsets',
    name: 'Lake Pichola Sunset Crew',
    type: 'public',
    destination: 'Udaipur',
    startDate: day(6),
    endDate: day(9),
    description: 'Easy-going group for first-timers: palaces in the morning, boat rides at sunset, rooftop dinners at night.',
    vibe: ['Sunsets', 'Heritage', 'Easy pace'],
    maxMembers: 12,
    leader: 'vikram_rides',
    members: ['vikram_rides', 'priya_wanders', 'meera_solo', 'sara_nomad'],
    requests: [],
    code: 'MIR-LAKE42',
    createdAt: ago(120),
    itinerary: [
      { id: 'i1', day: 1, time: '09:00', title: 'City Palace guided walk', place: 'City Palace, Udaipur', note: 'Meet at Tripolia Gate. Tickets on arrival.' },
      { id: 'i2', day: 1, time: '17:30', title: 'Sunset boat ride', place: 'Lake Pichola – Rameshwar Ghat', note: 'Shared boat, ~1 hr.' },
      { id: 'i3', day: 2, time: '07:00', title: 'Sunrise at Karni Mata', place: 'Karni Mata Ropeway', note: 'Ropeway opens at 7.' },
      { id: 'i4', day: 2, time: '19:00', title: 'Dharohar folk dance show', place: 'Bagore Ki Haveli', note: 'Gangaur Ghat. Arrive 30 min early.' },
      { id: 'i5', day: 3, time: '10:00', title: 'Saheliyon ki Bari & lunch', place: 'Saheliyon ki Bari', note: '' },
    ],
    suggestions: [
      { id: 's1', by: 'priya_wanders', kind: 'edit', targetId: 'i2', proposed: { time: '17:00' }, reason: 'Sun sets around 17:50 this season – leaving at 17:00 gets us the golden light on the palace.', status: 'pending', createdAt: ago(5) },
      { id: 's2', by: 'meera_solo', kind: 'add', proposed: { day: 3, time: '16:00', title: 'Ambrai Ghat photo walk', place: 'Ambrai Ghat', note: 'Best view of City Palace across the lake.' }, reason: 'Quiet spot most groups miss.', status: 'accepted', decisionComment: 'Love it – added before dinner.', decidedAt: ago(20), createdAt: ago(30) },
      { id: 's3', by: 'sara_nomad', kind: 'remove', targetId: 'i5', reason: 'Could use the morning to rest instead.', status: 'rejected', decisionComment: 'Keeping it – it is only 2 hrs and very close to the hotel. Skip it if you need rest!', decidedAt: ago(18), createdAt: ago(26) },
    ],
  },
  {
    id: 'g-food-trail',
    name: 'Old City Food Trail',
    type: 'public',
    destination: 'Udaipur',
    startDate: day(3),
    endDate: day(4),
    description: 'Two days of street food: kachoris, dal baati churma, rabri and lake-view chai. Solo travellers very welcome.',
    vibe: ['Food', 'Walking', 'Solo-friendly'],
    maxMembers: 10,
    leader: 'kabir_foodie',
    members: ['kabir_foodie', 'rohan_trails', 'isha_dance'],
    localFriend: 'nandini_udaipur',
    requests: [],
    code: 'MIR-FOOD77',
    createdAt: ago(80),
    itinerary: [
      { id: 'i1', day: 1, time: '08:30', title: 'Kachori breakfast', place: 'Jagdish Chowk', note: '' },
      { id: 'i2', day: 1, time: '13:00', title: 'Dal baati churma thali', place: 'Old City', note: 'Book table for group.' },
      { id: 'i3', day: 2, time: '18:00', title: 'Rabri & lake-view chai', place: 'Gangaur Ghat', note: '' },
    ],
    suggestions: [
      { id: 's1', by: 'rohan_trails', kind: 'add', proposed: { day: 2, time: '07:00', title: 'Cycle ride to Fateh Sagar', place: 'Fateh Sagar Lake', note: 'Work up an appetite!' }, reason: 'A morning ride before eating all day.', status: 'pending', createdAt: ago(2) },
      { id: 's2', by: 'nandini_udaipur', kind: 'edit', targetId: 'i1', proposed: { time: '07:45', place: 'Jagdish Chowk – Jodhpur Mishthan Bhandar' }, reason: 'The famous kachoris sell out by 9! Let’s go a bit earlier – I know the owner.', status: 'pending', createdAt: ago(1) },
    ],
  },
  {
    id: 'g-forts-trek',
    name: 'Kumbhalgarh Fort Trek',
    type: 'public',
    destination: 'Kumbhalgarh',
    startDate: day(14),
    endDate: day(15),
    description: 'Walk the great wall of Kumbhalgarh, overnight in the Aravallis, back via Ranakpur temples.',
    vibe: ['Trek', 'Forts', 'Nature'],
    maxMembers: 8,
    leader: 'rohan_trails',
    members: ['rohan_trails', 'dev_heritage'],
    requests: [],
    code: 'MIR-FORT11',
    createdAt: ago(50),
    itinerary: [
      { id: 'i1', day: 1, time: '06:00', title: 'Drive from Udaipur', place: 'Udaipur → Kumbhalgarh', note: '~2.5 hrs' },
      { id: 'i2', day: 1, time: '09:30', title: 'Fort wall walk', place: 'Kumbhalgarh Fort', note: 'Carry water.' },
      { id: 'i3', day: 2, time: '10:00', title: 'Ranakpur Jain Temple', place: 'Ranakpur', note: 'Dress code applies.' },
    ],
    suggestions: [],
  },
  {
    id: 'g-sharma-family',
    name: 'Sharma Family Getaway',
    type: 'private',
    destination: 'Udaipur',
    startDate: day(20),
    endDate: day(23),
    description: 'Family trip – grandparents friendly pace, lots of rest stops.',
    vibe: ['Family', 'Relaxed'],
    maxMembers: 8,
    leader: 'priya_wanders',
    members: ['priya_wanders', 'ananya_art'],
    requests: [
      { username: 'dev_heritage', message: 'Hi Priya, Ananya said you have one more seat in the car!', at: ago(3) },
    ],
    code: 'MIR-SHRM58',
    createdAt: ago(200),
    itinerary: [
      { id: 'i1', day: 1, time: '11:00', title: 'Check-in & lake-view lunch', place: 'Lake Pichola Hotel', note: '' },
      { id: 'i2', day: 2, time: '10:00', title: 'Vintage Car Museum', place: 'Garden Hotel', note: 'Grandpa’s request!' },
    ],
    suggestions: [],
  },
  {
    id: 'g-art-retreat',
    name: 'Miniature Painting Retreat',
    type: 'private',
    destination: 'Udaipur',
    startDate: day(30),
    endDate: day(33),
    description: 'Small workshop group with master painters in the old city. Invite-only.',
    vibe: ['Art', 'Workshop'],
    maxMembers: 6,
    leader: 'ananya_art',
    members: ['ananya_art', 'isha_dance', 'meera_solo'],
    requests: [],
    code: 'MIR-ARTS93',
    createdAt: ago(300),
    itinerary: [
      { id: 'i1', day: 1, time: '10:00', title: 'Studio visit & materials', place: 'Old City studio', note: '' },
      { id: 'i2', day: 2, time: '10:00', title: 'Painting session I', place: 'Studio', note: 'Natural pigments.' },
    ],
    suggestions: [],
  },
];

// Group chat & polls (keyed by group id)
const CHAT = {
  'g-lake-sunsets': {
    messages: [
      { id: 'm1', kind: 'system', text: 'Vikram created the group', at: ago(120) },
      { id: 'm2', by: 'vikram_rides', text: 'Welcome everyone! I grew up near Gangaur Ghat – ask me anything about Udaipur 🙏', at: ago(48) },
      { id: 'm3', by: 'priya_wanders', text: 'So excited! Is the boat ride shared or private?', at: ago(30) },
      { id: 'm4', by: 'vikram_rides', text: 'Shared boat, about an hour. I’ll book tickets once we finalise the time.', at: ago(29) },
      { id: 'm5', by: 'meera_solo', text: 'First solo trip in Rajasthan – glad to have company for the evenings!', at: ago(22) },
      { id: 'm6', kind: 'poll', by: 'vikram_rides', pollId: 'p1', at: ago(10) },
      { id: 'm7', by: 'sara_nomad', text: 'Voted! Also – any café with good Wi-Fi near the ghats?', at: ago(6) },
      { id: 'm8', by: 'vikram_rides', text: 'Jheel’s Ginger Coffee Bar – great view, decent Wi-Fi ☕', at: ago(5) },
    ],
    polls: [
      { id: 'p1', by: 'vikram_rides', question: 'Dinner on Day 1 – where should we go?', multi: false, closed: false, createdAt: ago(10),
        options: [
          { id: 'o1', text: 'Rooftop by Lake Pichola', votes: ['priya_wanders', 'sara_nomad'] },
          { id: 'o2', text: 'Traditional Rajasthani thali', votes: ['meera_solo'] },
          { id: 'o3', text: 'Street food at Jagdish Chowk', votes: [] },
        ] },
    ],
  },
  'g-food-trail': {
    messages: [
      { id: 'm1', kind: 'system', text: 'Kabir created the group', at: ago(80) },
      { id: 'm2', by: 'kabir_foodie', text: 'Rule #1 of the food trail: come hungry 😄', at: ago(40) },
      { id: 'm3', by: 'isha_dance', text: 'Is there anything vegan-friendly on the list?', at: ago(20) },
      { id: 'm4', by: 'kabir_foodie', text: 'Yes – I’ll mark vegan options. Vote on the sweets below!', at: ago(19) },
      { id: 'm5', kind: 'poll', by: 'kabir_foodie', pollId: 'p1', at: ago(19) },
      { id: 'm6', kind: 'system', text: 'Nandini joined as your local friend 🤝', at: ago(4) },
      { id: 'm7', by: 'nandini_udaipur', text: 'Namaste everyone! I’m your local friend for the trail 😊 Tip: carry cash – most stalls in the old city don’t take cards.', at: ago(3) },
      { id: 'm8', by: 'kabir_foodie', text: 'Welcome Nandini! So glad to have a local with us.', at: ago(3) },
    ],
    polls: [
      { id: 'p1', by: 'kabir_foodie', question: 'Which sweets should we hunt for? (pick any)', multi: true, closed: false, createdAt: ago(19),
        options: [
          { id: 'o1', text: 'Rabri', votes: ['kabir_foodie', 'rohan_trails'] },
          { id: 'o2', text: 'Mawa kachori', votes: ['rohan_trails', 'isha_dance'] },
          { id: 'o3', text: 'Ghevar', votes: ['isha_dance'] },
          { id: 'o4', text: 'Malpua', votes: [] },
        ] },
    ],
  },
  'g-sharma-family': {
    messages: [
      { id: 'm1', kind: 'system', text: 'Priya created the group', at: ago(200) },
      { id: 'm2', by: 'ananya_art', text: 'Booked the lake-view rooms for Mummy & Papa ✅', at: ago(60) },
      { id: 'm3', kind: 'poll', by: 'priya_wanders', pollId: 'p1', at: ago(50) },
    ],
    polls: [
      { id: 'p1', by: 'priya_wanders', question: 'Train or flight to Udaipur?', multi: false, closed: true, createdAt: ago(50),
        options: [
          { id: 'o1', text: 'Train (Chetak Express)', votes: ['priya_wanders', 'ananya_art'] },
          { id: 'o2', text: 'Flight', votes: [] },
        ] },
    ],
  },
};
for (const g of MOCK_GROUPS) {
  g.messages = CHAT[g.id]?.messages || g.messages || [{ id: 'm1', kind: 'system', text: 'Group created', at: g.createdAt }];
  g.polls = CHAT[g.id]?.polls || [];
}

// ---- finished trips (for two-way reviews)
MOCK_GROUPS.push(
  {
    id: 'g-past-ghats', name: 'Meera’s Udaipur trip with Zoya', type: 'private', destination: 'Udaipur', startDate: day(-4), endDate: day(-2), solo: true,
    description: 'Sunrise photo walks around the ghats.', vibe: ['Solo', 'Local friend'], maxMembers: 4, leader: 'meera_solo', members: ['meera_solo'], localFriend: 'zoya_lakeside',
    requests: [], code: 'MIR-GHAT21', createdAt: ago(24 * 9), suggestions: [], polls: [],
    itinerary: [
      { id: 'i1', day: 1, time: '06:15', title: 'Sunrise at Ambrai Ghat', place: 'Ambrai Ghat', note: 'Bring a tripod.' },
      { id: 'i2', day: 2, time: '06:30', title: 'Gangaur Ghat & Bagore ki Haveli', place: 'Gangaur Ghat', note: '' },
    ],
    messages: [
      { id: 'm1', kind: 'system', text: 'Zoya accepted Meera’s request – say hello! 👋', at: ago(24 * 9) },
      { id: 'm2', by: 'zoya_lakeside', text: 'Meet me at Ambrai Ghat at 6:15 – the light is magic then ✨', at: ago(24 * 5) },
      { id: 'm3', by: 'meera_solo', text: 'Thank you so much, the photos came out beautifully!', at: ago(24 * 2) },
    ],
  },
  {
    id: 'g-past-food', name: 'Monsoon Food Walk', type: 'private', destination: 'Udaipur', startDate: day(-31), endDate: day(-30),
    description: 'Monsoon special: pakoras, chai and lake views.', vibe: ['Food'], maxMembers: 6, leader: 'kabir_foodie', members: ['kabir_foodie', 'priya_wanders'], localFriend: 'nandini_udaipur',
    requests: [], code: 'MIR-RAIN08', createdAt: ago(24 * 40), suggestions: [], polls: [], itinerary: [],
    messages: [{ id: 'm1', kind: 'system', text: 'Nandini joined as your local friend 🤝', at: ago(24 * 38) }],
  },
);

// Reviews: dir 't2l' = traveller → local (public on the local's profile), 'l2t' = local → traveller (visible to locals only).
// historic: older reviews already counted in the profile totals, shown as text only.
export const MOCK_REVIEWS = [
  { id: 'rv1', tripId: 'g-past-food', from: 'kabir_foodie', to: 'nandini_udaipur', dir: 't2l', stars: 5, cats: { Knowledge: 5, Friendliness: 5, Punctuality: 5, 'Value for money': 5, Safety: 5 }, tags: ['Knowledgeable', 'Great stories', 'Good value'], text: 'Nandini knows every stall owner by name. Best food walk of my life.', at: ago(24 * 29), reply: { text: 'Come back for winter – the gajak season is even better!', at: ago(24 * 28) } },
  { id: 'rv2', tripId: 'g-past-food', from: 'priya_wanders', to: 'nandini_udaipur', dir: 't2l', stars: 5, cats: { Friendliness: 5, Safety: 5 }, tags: ['Friendly', 'Felt safe'], text: 'Felt completely at ease – and the rabri was unreal.', at: ago(24 * 28) },
  { id: 'rv3', tripId: 'g-past-food', from: 'nandini_udaipur', to: 'kabir_foodie', dir: 'l2t', stars: 5, cats: { Respectful: 5, Punctual: 4, Communication: 5 }, tags: ['Great guest', 'Fun to host'], text: 'Kabir’s enthusiasm is contagious!', at: ago(24 * 29) },
  { id: 'rv4', tripId: 'g-past-food', from: 'nandini_udaipur', to: 'priya_wanders', dir: 'l2t', stars: 5, cats: { Respectful: 5, Punctual: 5 }, tags: ['Great guest', 'On time'], text: 'Lovely, respectful guest.', at: ago(24 * 29) },
  // blind review: Zoya has reviewed Meera; Meera sees it only after she reviews Zoya (or the window closes)
  { id: 'rv5', tripId: 'g-past-ghats', from: 'zoya_lakeside', to: 'meera_solo', dir: 'l2t', stars: 5, cats: { Respectful: 5, Punctual: 5, Communication: 5 }, tags: ['Great guest', 'On time'], text: 'Up at 5:45 both days without complaint – a dream guest for a photographer!', at: ago(24 * 1) },
  // historic text reviews (already included in the profile totals)
  { id: 'h1', historic: true, tripId: 'hist', tripEnd: day(-45), from: 'aarav_explores', to: 'vikram_rides', dir: 't2l', stars: 5, tags: ['Knowledgeable', 'Great stories'], text: 'Vikram’s stories about the ghats made the boat ride.', at: ago(24 * 45) },
  { id: 'h2', historic: true, tripId: 'hist', tripEnd: day(-60), from: 'dev_heritage', to: 'arjun_mewar', dir: 't2l', stars: 5, tags: ['Knowledgeable', 'Great stories'], text: 'Like walking through history with a friend.', at: ago(24 * 60) },
  { id: 'h3', historic: true, tripId: 'hist', tripEnd: day(-50), from: 'sara_nomad', to: 'zoya_lakeside', dir: 't2l', stars: 4, tags: ['Friendly', 'Punctual'], text: 'Great spots; replied a bit slowly before the trip.', at: ago(24 * 50) },
  { id: 'h4', historic: true, tripId: 'hist', tripEnd: day(-70), from: 'rohan_trails', to: 'bhanu_hikes', dir: 't2l', stars: 5, tags: ['Felt safe', 'Flexible'], text: 'Safe, well planned trails and endless chai.', at: ago(24 * 70) },
  { id: 'h5', historic: true, tripId: 'hist', tripEnd: day(-40), from: 'ananya_art', to: 'ritu_crafts', dir: 't2l', stars: 5, tags: ['Good value', 'Knowledgeable'], text: 'Fair prices and real artisans – no commissions.', at: ago(24 * 40) },
];

export const MOCK_REPORTS = [
  { id: 'rp1', kind: 'safety', about: 'manoj_tours', by: 'dev_heritage', text: 'Kept insisting we buy from one shop and got angry when we refused.', at: ago(24 * 5), status: 'confirmed' },
  { id: 'rp2', kind: 'flag', about: 'manoj_tours', by: 'sara_nomad', text: 'Low rating (2★): pushy about shopping.', at: ago(24 * 4), status: 'open' },
];
export const MOCK_APPEALS = [];

// Requests from travellers / groups to a Local Friend
export const MOCK_LOCAL_REQUESTS = [
  { id: 'lr1', local: 'arjun_mewar', by: 'meera_solo', groupId: null, startDate: day(6), endDate: day(7), message: 'First time in Udaipur, travelling solo. Would love the palace stories!', status: 'pending', createdAt: ago(6) },
  { id: 'lr2', local: 'zoya_lakeside', by: 'priya_wanders', groupId: 'g-sharma-family', startDate: day(21), endDate: day(21), message: 'Family trip – could you do a gentle sunrise photo walk? My parents will join.', status: 'pending', createdAt: ago(9) },
  { id: 'lr3', local: 'nandini_udaipur', by: 'kabir_foodie', groupId: 'g-food-trail', startDate: day(3), endDate: day(4), message: 'Food trail group – we’d love a local who knows the old city!', status: 'accepted', reply: 'Yes! I’ll bring my list of stalls 🙌', createdAt: ago(30), decidedAt: ago(4) },
];

export function freshState() {
  return {
    me: null, // username of the traveller using the app
    soloMode: false,
    localRequests: JSON.parse(JSON.stringify(MOCK_LOCAL_REQUESTS)),
    reviews: JSON.parse(JSON.stringify(MOCK_REVIEWS)),
    reports: JSON.parse(JSON.stringify(MOCK_REPORTS)),
    appeals: [],
    notices: [],
    eventPrefs: JSON.parse(JSON.stringify(MOCK_EVENT_PREFS)),
    eventReminders: JSON.parse(JSON.stringify(MOCK_EVENT_REMINDERS)),
    eventOverrides: {},
    users: JSON.parse(JSON.stringify(MOCK_USERS)),
    groups: JSON.parse(JSON.stringify(MOCK_GROUPS)),
  };
}
