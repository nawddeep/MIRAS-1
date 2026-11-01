// Makers. Every artisan here is a DEMONSTRATION PROFILE: not a real person or
// business. No consent was collected because no real person is shown.
// Prices are illustrative and nothing can actually be bought or booked.

const UPDATED = '2026-10-30';
const DEMO_CONSENT = { status: 'Not applicable', note: 'Demonstration profile. Not a real person or business, so no consent was collected. A real listing would show the date written consent was given.' };
/** @param {number} amount @returns {import('./types.js').Price} */
const inr = (amount) => ({ amount, currency: 'INR', note: 'Illustrative price' });

/** @type {import('./types.js').Artisan[]} */
export const artisans = [
  {
    id: 'a-chitrashala', studio: 'Chitrashala Studio', craft: 'Miniature painting', craftHi: 'लघु चित्रकला',
    area: 'Lanes behind Jagdish Chowk', nearPlaceId: 'jagdish-temple',
    coords: { lat: 24.5803, lng: 73.6845, precision: 'general-area' }, languages: ['Hindi', 'English'],
    intro: 'A small upstairs studio where paintings are made with squirrel-hair brushes and mineral colours on handmade paper.',
    process: 'Outline in a single hair brush, layer colour in thin washes, burnish with a smooth stone, then add the finest detail last.',
    doodle: 'brush', verification: 'Illustrative', consent: DEMO_CONSENT, lastUpdated: UPDATED,
  },
  {
    id: 'a-rangrez', studio: 'Rangrez Dye House', craft: 'Leheriya and bandhej dyeing', craftHi: 'लहरिया और बंधेज',
    area: 'Off Bada Bazaar', nearPlaceId: 'bada-bazaar',
    coords: { lat: 24.5828, lng: 73.6872, precision: 'general-area' }, languages: ['Hindi', 'Mewari'],
    intro: 'Cloth rolled, tied and dyed in diagonal waves (leheriya) or tiny resist dots (bandhej), dried on the roof.',
    process: 'Roll or pinch the cloth, bind it tight with thread, dye from lightest to darkest, and untie only when fully dry.',
    doodle: 'cloth', verification: 'Illustrative', consent: DEMO_CONSENT, lastUpdated: UPDATED,
  },
  {
    id: 'a-lakh', studio: 'Lakh Bangle Workshop', craft: 'Lac bangles', craftHi: 'लाख की चूड़ियाँ',
    area: 'Bangle lane, Bada Bazaar', nearPlaceId: 'bada-bazaar',
    coords: { lat: 24.5818, lng: 73.6860, precision: 'general-area' }, languages: ['Hindi'],
    intro: 'Bangles shaped by hand over a small charcoal stove, pressed with glass and beads while the lac is still warm.',
    process: 'Warm the lac, colour it, roll it into a rod, wrap it round a wooden form and set the stones before it cools.',
    doodle: 'bangles', verification: 'Illustrative', consent: DEMO_CONSENT, lastUpdated: UPDATED,
  },
  {
    id: 'a-mitti', studio: 'Mitti Terracotta', craft: 'Terracotta plaques', craftHi: 'टेराकोटा',
    area: 'Near Shilpgram', nearPlaceId: 'shilpgram',
    coords: { lat: 24.6020, lng: 73.6450, precision: 'general-area' }, languages: ['Hindi', 'Mewari'],
    intro: 'Votive plaques of riders and deities in the Molela style, modelled by hand in local clay and fired in an open kiln.',
    process: 'Mix river clay with dung and sand, model the figure on a flat slab, dry it in shade, and fire it overnight.',
    doodle: 'pot', verification: 'Illustrative', consent: DEMO_CONSENT, lastUpdated: UPDATED,
  },
  {
    id: 'a-kathputli', studio: 'Kathputli Ghar', craft: 'String puppets', craftHi: 'कठपुतली',
    area: 'Near Gangaur Ghat', nearPlaceId: 'gangaur-ghat',
    coords: { lat: 24.5793, lng: 73.6818, precision: 'general-area' }, languages: ['Hindi', 'English'],
    intro: 'Carved wooden heads, bright cloth and strings: puppets made for shows and for taking home.',
    process: 'Carve and paint the head, stitch the costume, then string the puppet so one hand can make it dance.',
    doodle: 'puppet', verification: 'Illustrative', consent: DEMO_CONSENT, lastUpdated: UPDATED,
  },
  {
    id: 'a-chandi', studio: 'Chandi Gali Silver', craft: 'Silver jewellery', craftHi: 'चाँदी के गहने',
    area: 'Near Hathi Pol', nearPlaceId: 'hathi-pol',
    coords: { lat: 24.5869, lng: 73.6873, precision: 'general-area' }, languages: ['Hindi', 'English'],
    intro: 'Anklets, toe rings and pendants made at a bench by the shop door, mostly for local weddings.',
    process: 'Melt, draw into wire or beat into sheet, shape and solder, then polish on a hand wheel.',
    doodle: 'ring', verification: 'Illustrative', consent: DEMO_CONSENT, lastUpdated: UPDATED,
  },
];

/** Things a maker sells. Kept separate from services. */
/** @type {import('./types.js').Product[]} */
export const products = [
  { id: 'p-mini-elephant', artisanId: 'a-chitrashala', title: 'Small painting on handmade paper', material: 'Mineral colour on paper', price: inr(2400), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-mini-bookmark', artisanId: 'a-chitrashala', title: 'Painted bookmark', material: 'Watercolour on card', price: inr(300), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-leheriya-dupatta', artisanId: 'a-rangrez', title: 'Leheriya dupatta', material: 'Cotton, hand-dyed', price: inr(1200), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-bandhej-scarf', artisanId: 'a-rangrez', title: 'Bandhej scarf', material: 'Cotton, tie-dyed', price: inr(850), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-lac-set', artisanId: 'a-lakh', title: 'Set of four lac bangles', material: 'Lac, glass', price: inr(600), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-plaque-rider', artisanId: 'a-mitti', title: 'Rider plaque', material: 'Fired terracotta', price: inr(1500), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-puppet-pair', artisanId: 'a-kathputli', title: 'Pair of string puppets', material: 'Wood, cloth', price: inr(1800), verification: 'Illustrative', rights: 'No image yet' },
  { id: 'p-silver-anklet', artisanId: 'a-chandi', title: 'Plain silver anklet', material: 'Silver', price: inr(3200), verification: 'Illustrative', rights: 'No image yet' },
];

/** Things a maker does for you. Kept separate from products. */
/** @type {import('./types.js').Service[]} */
export const services = [
  { id: 'sv-portrait', artisanId: 'a-chitrashala', title: 'Commissioned small painting', detail: 'A subject of your choice in miniature style. Takes several days.', howToRequest: 'Send an enquiry', verification: 'Illustrative' },
  { id: 'sv-custom-dye', artisanId: 'a-rangrez', title: 'Dye your own colour', detail: 'Choose colours for a length of cloth and collect it once dry.', howToRequest: 'Send an enquiry', verification: 'Illustrative' },
  { id: 'sv-resize', artisanId: 'a-lakh', title: 'Bangles made to size', detail: 'Bangles shaped to your wrist while you wait.', howToRequest: 'Ask in person or send an enquiry', verification: 'Illustrative' },
  { id: 'sv-repair', artisanId: 'a-chandi', title: 'Jewellery repair', detail: 'Clasp, link and solder repairs.', howToRequest: 'Ask in person', verification: 'Illustrative' },
  { id: 'sv-show', artisanId: 'a-kathputli', title: 'Short puppet demonstration', detail: 'A few minutes of a puppet show, for families or schools.', howToRequest: 'Send an enquiry', verification: 'Illustrative' },
];

/** @type {import('./types.js').Workshop[]} */
export const workshops = [
  {
    id: 'w-miniature-intro', artisanId: 'a-chitrashala', placeId: 'jagdish-temple', title: 'Paint a small elephant', craft: 'Miniature painting',
    description: 'Learn how a single-hair brush is held and loaded, then paint and burnish a small motif to take home.',
    languages: ['Hindi', 'English'], durationMin: 120, cost: inr(1500), groupSize: 4, sampleDays: ['Tue', 'Thu', 'Sat'],
    howToBook: 'Enquiry, or the booking demonstration', ownerConfirmed: false, verification: 'Illustrative', lastUpdated: UPDATED,
  },
  {
    id: 'w-leheriya', artisanId: 'a-rangrez', placeId: 'bada-bazaar', title: 'Roll, tie and dye a leheriya scarf', craft: 'Textile dyeing',
    description: 'Roll and bind a cotton scarf, dye it in two colours and see the waves appear when it is untied.',
    languages: ['Hindi'], durationMin: 180, cost: inr(2200), groupSize: 6, sampleDays: ['Mon', 'Wed', 'Fri'],
    howToBook: 'Enquiry, or the booking demonstration', ownerConfirmed: false, verification: 'Illustrative', lastUpdated: UPDATED,
  },
  {
    id: 'w-lac', artisanId: 'a-lakh', placeId: 'bada-bazaar', title: 'Make one lac bangle', craft: 'Lac bangles',
    description: 'Sit at the stove, warm and roll the lac, and set your own glass pieces into a single bangle.',
    languages: ['Hindi'], durationMin: 60, cost: inr(700), groupSize: 3, sampleDays: ['Daily'],
    howToBook: 'Enquiry, or the booking demonstration', ownerConfirmed: false, verification: 'Illustrative', lastUpdated: UPDATED,
  },
  {
    id: 'w-terracotta', artisanId: 'a-mitti', placeId: 'shilpgram', title: 'Model a terracotta rider', craft: 'Terracotta',
    description: 'Shape a small rider plaque in clay. It is fired later and can be collected or posted.',
    languages: ['Hindi', 'Mewari'], durationMin: 150, cost: inr(1800), groupSize: 8, sampleDays: ['Sat', 'Sun'],
    howToBook: 'Enquiry only', ownerConfirmed: false, verification: 'Illustrative', lastUpdated: UPDATED,
  },
  {
    id: 'w-puppet', artisanId: 'a-kathputli', placeId: 'gangaur-ghat', title: 'String your own puppet', craft: 'Puppetry',
    description: 'Dress and string a small puppet, then learn the three basic moves. Good with children.',
    languages: ['Hindi', 'English'], durationMin: 90, cost: inr(1200), groupSize: 6, sampleDays: ['Wed', 'Sat'],
    howToBook: 'Enquiry, or the booking demonstration', ownerConfirmed: false, verification: 'Illustrative', lastUpdated: UPDATED,
  },
];
