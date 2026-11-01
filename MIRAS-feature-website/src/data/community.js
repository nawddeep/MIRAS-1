// Events, reviews, local tips, markets, Hidden Udaipur picks and phrases.
// No organiser has confirmed any event here. All reviews are sample text.

const UPDATED = '2026-10-30';

/** @type {import('./types.js').EventItem[]} */
export const events = [
  {
    id: 'e-dharohar', title: 'Evening folk dance in a haveli courtyard', kind: 'Performance', placeId: 'bagore-ki-haveli',
    when: 'Most evenings (times not confirmed)', month: null, availability: 'Not confirmed', language: 'No language needed',
    duration: 'About 1 hour', cost: 'Ticketed; price not confirmed', bookingMethod: 'At the venue', organiserConfirmed: false,
    listingType: 'Public programme, details unconfirmed',
    description: 'A regular evening programme of Rajasthani folk dance and puppetry is publicly advertised at Bagore Ki Haveli. MIRAS has not confirmed its current times or prices.',
    verification: 'Unverified', lastUpdated: UPDATED,
  },
  {
    id: 'e-gangaur', title: 'Gangaur processions to the ghat', kind: 'Festival', placeId: 'gangaur-ghat',
    when: 'Spring; the date follows the Hindu calendar and moves each year', month: 'march', availability: 'Open public festival',
    language: 'Hindi, Mewari', duration: 'Over several days', cost: 'Free', bookingMethod: 'No booking', organiserConfirmed: false,
    listingType: 'Public programme, details unconfirmed',
    description: 'Processions carrying images of Gauri and Isar come down to the lake. Watch from a distance and give way to people taking part.',
    verification: 'Unverified', lastUpdated: UPDATED,
  },
  {
    id: 'e-shilpgram-fair', title: 'Winter crafts fair at Shilpgram', kind: 'Fair', placeId: 'shilpgram',
    when: 'Usually late December (dates not confirmed)', month: 'december', availability: 'Not confirmed',
    language: 'Hindi, English', duration: 'Several days', cost: 'Entry fee; amount not confirmed', bookingMethod: 'At the gate', organiserConfirmed: false,
    listingType: 'Public programme, details unconfirmed',
    description: 'A large annual fair with makers and performers from across western India. Check the organiser\'s announcement for this year\'s dates.',
    verification: 'Unverified', lastUpdated: UPDATED,
  },
  {
    id: 'e-sketch-walk', title: 'Old-city sketch walk', kind: 'Heritage walk', placeId: 'jagdish-temple',
    when: 'Sample: Saturday, 7:00 am', month: 'november', availability: 'Sample listing; no real places',
    language: 'English and Hindi', duration: '2 hours', cost: '₹600 (illustrative)', bookingMethod: 'Enquiry (demonstration)', organiserConfirmed: false,
    listingType: 'Demo listing',
    description: 'Walk the lanes behind the temple with a sketchbook and stop at three doorways to draw. Pencils provided.',
    verification: 'Illustrative', lastUpdated: UPDATED,
  },
  {
    id: 'e-miniature-show', title: 'Small paintings, close up', kind: 'Exhibition', placeId: 'bagore-ki-haveli',
    when: 'Sample: 10 to 20 January', month: 'january', availability: 'Sample listing',
    language: 'English and Hindi labels', duration: 'Drop in', cost: 'Free (illustrative)', bookingMethod: 'No booking', organiserConfirmed: false,
    listingType: 'Demo listing',
    description: 'A sample listing showing how an exhibition of work by local painters would appear, with the organiser\'s confirmation shown once given.',
    verification: 'Illustrative', lastUpdated: UPDATED,
  },
  {
    id: 'e-lakeside-music', title: 'Music on the embankment', kind: 'Performance', placeId: 'fateh-sagar',
    when: 'Sample: Sunday, 6:30 pm', month: 'february', availability: 'Sample listing',
    language: 'No language needed', duration: '90 minutes', cost: 'Free (illustrative)', bookingMethod: 'No booking', organiserConfirmed: false,
    listingType: 'Demo listing',
    description: 'A sample listing for an informal evening of folk songs. Shown to demonstrate the format only.',
    verification: 'Illustrative', lastUpdated: UPDATED,
  },
];

/** Visitor reviews and local tips. Local tips are always labelled apart. No ratings are shown. */
/** @type {import('./types.js').Review[]} */
export const reviews = [
  { id: 'r1', placeId: 'city-palace', kind: 'Visitor review', author: 'Sample visitor', date: '2026-10-12', verification: 'Illustrative', text: 'We went at opening time and had the upper courtyards almost to ourselves for half an hour. By eleven it was full.' },
  { id: 'r2', placeId: 'city-palace', kind: 'Local tip', author: 'Sample local contributor', date: '2026-10-02', verification: 'Illustrative', text: 'Leave time for the lake-facing balconies at the top; most people rush past them.' },
  { id: 'r3', placeId: 'lake-pichola', kind: 'Visitor review', author: 'Sample visitor', date: '2026-09-28', verification: 'Illustrative', text: 'The boat was lovely but the ghats were the part we remember: sitting on the steps and watching the light change.' },
  { id: 'r4', placeId: 'lake-pichola', kind: 'Local tip', author: 'Sample local contributor', date: '2026-10-20', verification: 'Illustrative', text: 'Keep the ghat steps clear in the morning. People come to wash and pray before work.' },
  { id: 'r5', placeId: 'jagdish-temple', kind: 'Local tip', author: 'Sample local contributor', date: '2026-10-15', verification: 'Illustrative', text: 'Leave your shoes with the stall at the bottom of the steps, not on the steps themselves.' },
  { id: 'r6', placeId: 'jagdish-temple', kind: 'Visitor review', author: 'Sample visitor', date: '2026-08-30', verification: 'Illustrative', text: 'Steep climb in the heat, but the carving on the outer wall is worth walking all the way round for.' },
  { id: 'r7', placeId: 'fateh-sagar', kind: 'Local tip', author: 'Sample local contributor', date: '2026-10-25', verification: 'Illustrative', text: 'Try the corn from the carts on the embankment after dark, and bring your own bag for rubbish.' },
  { id: 'r8', placeId: 'bagore-ki-haveli', kind: 'Visitor review', author: 'Sample visitor', date: '2026-09-11', verification: 'Illustrative', text: 'The rooms of everyday things were more interesting than we expected. The puppets were our favourite.' },
  { id: 'r9', placeId: 'bada-bazaar', kind: 'Local tip', author: 'Sample local contributor', date: '2026-10-05', verification: 'Illustrative', text: 'Bargaining is normal for bangles and cloth, but be fair. Prices for food are usually fixed.' },
];

/** @type {import('./types.js').Market[]} */
export const markets = [
  { id: 'm-hathi-pol', name: 'Hathi Pol', placeId: 'hathi-pol', categories: ['Paintings', 'Textiles', 'Silver'], bestFor: 'Miniature paintings and printed textiles', tip: 'Ask whether a painting is hand-painted or printed; both are sold.', verification: 'Unverified', lastUpdated: UPDATED },
  { id: 'm-bada-bazaar', name: 'Bada Bazaar', placeId: 'bada-bazaar', categories: ['Textiles', 'Bangles', 'Brass', 'Spices'], bestFor: 'Lac bangles, cloth and kitchen brass', tip: 'Mostly local shoppers. Go in the late afternoon.', verification: 'Unverified', lastUpdated: UPDATED },
  { id: 'm-jagdish-chowk', name: 'Lanes around Jagdish Chowk', placeId: 'jagdish-temple', categories: ['Paintings', 'Books', 'Leather'], bestFor: 'Painting studios and small bookshops', tip: 'Many studios are upstairs; look for signs at the doorways.', verification: 'Unverified', lastUpdated: UPDATED },
  { id: 'm-shilpgram', name: 'Shilpgram craft stalls', placeId: 'shilpgram', categories: ['Pottery', 'Textiles', 'Toys'], bestFor: 'Crafts from across western India, especially during the winter fair', tip: 'Stalls are fewer outside the fair season.', verification: 'Unverified', lastUpdated: UPDATED },
];

/** Hidden Udaipur: contributed picks. Every entry here is a SAMPLE showing the format. */
/** @type {import('./types.js').HiddenPlace[]} */
export const hiddenPlaces = [
  {
    id: 'h-baori', title: 'A neighbourhood step-well', area: 'Old City, general area only', doodle: 'steps',
    blurb: 'A stone step-well still used by the families around it. Look from the top step; do not go down.',
    contributor: 'Sample local contributor', sourcing: 'Sample entry. A real entry would name the contributor (with consent) and the date a moderator checked it.',
    sensitivity: 'High', sensitivityNote: 'Residential and in daily use. Exact location is not shared. Keep voices low and do not photograph people.',
    moderation: 'Approved (sample)', locationPrecision: 'general-area', verification: 'Illustrative',
  },
  {
    id: 'h-chai', title: 'A tea stall where the boatmen stop', area: 'Near the ghats, general area only', doodle: 'kulhad',
    blurb: 'Clay-cup chai at the start of the day, when the boatmen come off the water.',
    contributor: 'Sample local contributor', sourcing: 'Sample entry. Not a real business.',
    sensitivity: 'Low', sensitivityNote: 'A working stall. Buy something if you sit down.',
    moderation: 'Approved (sample)', locationPrecision: 'general-area', verification: 'Illustrative',
  },
  {
    id: 'h-doorways', title: 'Painted doorways of a wedding lane', area: 'Old City, general area only', doodle: 'arch',
    blurb: 'Houses where wedding paintings are added around the door, layer after layer, over the years.',
    contributor: 'Sample local contributor', sourcing: 'Sample entry. A real entry would be checked with residents before publishing.',
    sensitivity: 'Medium', sensitivityNote: 'Private homes. Photograph the paintings only, from the lane, and never the people inside.',
    moderation: 'Approved (sample)', locationPrecision: 'general-area', verification: 'Illustrative',
  },
  {
    id: 'h-shrine', title: 'A small hilltop shrine', area: 'Aravalli edge, general area only', doodle: 'shrine',
    blurb: 'A short climb to a whitewashed shrine and a wide view at dusk.',
    contributor: 'Sample local contributor', sourcing: 'Sample entry, still in review.',
    sensitivity: 'High', sensitivityNote: 'An active shrine. Held back from the map until a moderator has checked it with the people who look after it.',
    moderation: 'Awaiting review (sample)', locationPrecision: 'general-area', verification: 'Illustrative',
  },
];

/** Phrase help. Hindi, with transliteration. */
/** @type {import('./types.js').Phrase[]} */
export const phrases = [
  { id: 'ph-price', en: 'How much is this?', hi: 'यह कितने का है?', translit: 'Yeh kitne ka hai?', context: 'Shopping' },
  { id: 'ph-less', en: 'Could you make it a little less?', hi: 'थोड़ा कम कीजिए।', translit: 'Thoda kam kijiye.', context: 'Shopping' },
  { id: 'ph-handmade', en: 'Is this made by hand?', hi: 'क्या यह हाथ से बना है?', translit: 'Kya yeh haath se bana hai?', context: 'Shopping' },
  { id: 'ph-photo', en: 'May I take a photo?', hi: 'क्या मैं फ़ोटो ले सकता हूँ?', translit: 'Kya main photo le sakta hoon?', context: 'Respect' },
  { id: 'ph-photo-f', en: 'May I take a photo? (said by a woman)', hi: 'क्या मैं फ़ोटो ले सकती हूँ?', translit: 'Kya main photo le sakti hoon?', context: 'Respect' },
  { id: 'ph-thanks', en: 'Thank you', hi: 'धन्यवाद', translit: 'Dhanyavaad', context: 'Everyday' },
  { id: 'ph-slow', en: 'Please speak slowly', hi: 'कृपया धीरे बोलिए।', translit: 'Kripya dheere boliye.', context: 'Everyday' },
  { id: 'ph-where', en: 'Where is Jagdish Temple?', hi: 'जगदीश मंदिर कहाँ है?', translit: 'Jagdish Mandir kahaan hai?', context: 'Directions' },
  { id: 'ph-water', en: 'Drinking water, please', hi: 'पीने का पानी, कृपया।', translit: 'Peene ka paani, kripya.', context: 'Food' },
  { id: 'ph-spice', en: 'Not too spicy, please', hi: 'कम मिर्च, कृपया।', translit: 'Kam mirch, kripya.', context: 'Food' },
  { id: 'ph-bill', en: 'The bill, please', hi: 'बिल दे दीजिए।', translit: 'Bill de dijiye.', context: 'Food' },
  { id: 'ph-help', en: 'I need help', hi: 'मुझे मदद चाहिए।', translit: 'Mujhe madad chahiye.', context: 'Everyday' },
];
