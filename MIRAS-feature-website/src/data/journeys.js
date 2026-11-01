// Trails, itineraries, audio walks, sample memories and passport badges.

/** @type {import('./types.js').Trail[]} */
export const trails = [
  { id: 't-architecture', title: 'Stone and stucco', theme: 'Architecture', kind: 'themed', blurb: 'Palace, temple and haveli in one walkable loop of the old city.', placeIds: ['city-palace', 'jagdish-temple', 'bagore-ki-haveli'], durationMin: 330, verification: 'Illustrative' },
  { id: 't-lakes', title: 'Lake to lake', theme: 'Lakes', kind: 'themed', blurb: 'From the ghats of Pichola to the embankment of Fateh Sagar.', placeIds: ['ambrai-ghat', 'gangaur-ghat', 'lake-pichola', 'fateh-sagar'], durationMin: 260, verification: 'Illustrative' },
  { id: 't-art', title: 'Paint, puppets and clay', theme: 'Art', kind: 'themed', blurb: 'Studios, a museum of everyday life and a crafts village.', placeIds: ['jagdish-temple', 'bagore-ki-haveli', 'shilpgram'], durationMin: 300, verification: 'Illustrative' },
  { id: 't-food', title: 'Carts and kulhads', theme: 'Food', kind: 'themed', blurb: 'Bazaar snacks, then corn and tea on the Fateh Sagar embankment.', placeIds: ['bada-bazaar', 'hathi-pol', 'fateh-sagar'], durationMin: 210, verification: 'Illustrative' },
  { id: 't-photo', title: 'Light on water', theme: 'Photography', kind: 'themed', blurb: 'Morning on the ghats, sunset from the hill. Ask before photographing people.', placeIds: ['ambrai-ghat', 'gangaur-ghat', 'sajjangarh'], durationMin: 240, verification: 'Illustrative' },
  { id: 't-family', title: 'With children', theme: 'Family-friendly', kind: 'themed', blurb: 'Fountains, puppets and open space, with short distances between stops.', placeIds: ['saheliyon-ki-bari', 'fateh-sagar', 'bagore-ki-haveli'], durationMin: 240, verification: 'Illustrative' },
  { id: 't-two-hours', title: 'The two-hour old city', theme: 'Two-hour walk', kind: 'timed', blurb: 'Temple, ghat and haveli: three stops, all within a short walk.', placeIds: ['jagdish-temple', 'gangaur-ghat', 'bagore-ki-haveli'], durationMin: 120, verification: 'Illustrative' },
  { id: 't-half-day', title: 'A slow half day by the water', theme: 'Half-day walk', kind: 'timed', blurb: 'Across the water and back, with time to sit.', placeIds: ['lake-pichola', 'ambrai-ghat', 'gangaur-ghat'], durationMin: 210, verification: 'Illustrative' },
];

/** @type {import('./types.js').Itinerary[]} */
export const itineraries = [
  {
    id: 'i-two-days', title: 'Two days', days: 2, intro: 'The essentials: palace, temple, lake and one evening of music.', verification: 'Illustrative',
    plan: [
      { title: 'Old city', placeIds: ['city-palace', 'jagdish-temple', 'lake-pichola'], note: 'Palace in the morning, temple after lunch, the lake at sunset.' },
      { title: 'Lakes and hills', placeIds: ['saheliyon-ki-bari', 'fateh-sagar', 'sajjangarh'], note: 'Gardens, the embankment, then the hill.' },
    ],
  },
  {
    id: 'i-three-days', title: 'Three days', days: 3, intro: 'The essentials, plus a morning on foot and an afternoon with a maker.', verification: 'Illustrative',
    plan: [
      { title: 'Old city', placeIds: ['city-palace', 'jagdish-temple', 'lake-pichola'], note: 'Palace, temple, lake.' },
      { title: 'On foot', placeIds: ['gangaur-ghat', 'bagore-ki-haveli', 'bada-bazaar'], note: 'Ghats in the morning, a workshop in the afternoon.' },
      { title: 'Lakes and hills', placeIds: ['fateh-sagar', 'shilpgram', 'sajjangarh'], note: 'The crafts village and the view from the top.' },
    ],
  },
];

/** @type {import('./types.js').AudioWalk[]} */
export const audioWalks = [
  {
    id: 'aw-old-city', title: 'Bells, steps and water', blurb: 'A short listening walk from the temple chowk down to the ghat.', durationMin: 75, language: 'English', verification: 'Illustrative',
    chapters: [
      { id: 'c1', title: 'The chowk', placeId: 'jagdish-temple', storyId: 's-jagdish-steps', estSeconds: 90, text: 'Stand at the foot of the temple steps. Look up at the carved bands on the outer walls before you climb.' },
      { id: 'c2', title: 'Down the lane', placeId: 'gangaur-ghat', storyId: 's-gangaur', estSeconds: 80, text: 'Walk down towards the water. The triple-arched gate frames the ghat ahead of you.' },
      { id: 'c3', title: 'The minister\'s house', placeId: 'bagore-ki-haveli', storyId: 's-bagore-minister', estSeconds: 70, text: 'The tall building beside the ghat is Bagore Ki Haveli. Its windows look straight over the lake.' },
      { id: 'c4', title: 'Sit by the water', placeId: 'lake-pichola', storyId: 's-ghat-morning', estSeconds: 60, text: 'Find a quiet step, away from anyone bathing, and take a few minutes to watch the lake.' },
    ],
  },
  {
    id: 'aw-lakes', title: 'An evening between two lakes', blurb: 'Ghats of Pichola, then the breeze of Fateh Sagar.', durationMin: 120, language: 'English', verification: 'Illustrative',
    chapters: [
      { id: 'c1', title: 'Across the water', placeId: 'ambrai-ghat', storyId: null, estSeconds: 60, text: 'From Ambrai Ghat, look back across the lake at the long white front of the palace.' },
      { id: 'c2', title: 'A name from a village', placeId: 'lake-pichola', storyId: 's-pichola-name', estSeconds: 80, text: 'The lake\'s name is said to come from a village. Listen to the legend, and remember it is a legend.' },
      { id: 'c3', title: 'The embankment', placeId: 'fateh-sagar', storyId: 's-fateh', estSeconds: 70, text: 'At Fateh Sagar the evening is louder: carts, families, and the wind off the water.' },
    ],
  },
];

/** Sample saved moments for the Memories demo. Drawings, not photos. */
/** @type {import('./types.js').Memory[]} */
export const memories = [
  { id: 'mem-1', placeId: 'lake-pichola', storyId: 's-ghat-morning', caption: 'First light on the ghat steps', date: '2026-11-02', kind: 'clip', faceFlag: true, artKey: 'pichola', verification: 'Illustrative' },
  { id: 'mem-2', placeId: 'jagdish-temple', storyId: 's-jagdish-steps', caption: 'The climb to the temple', date: '2026-11-02', kind: 'photo', faceFlag: false, artKey: 'jagdish', verification: 'Illustrative' },
  { id: 'mem-3', placeId: 'bagore-ki-haveli', storyId: 's-bagore-minister', caption: 'Courtyard before the show', date: '2026-11-02', kind: 'clip', faceFlag: true, artKey: 'bagore', verification: 'Illustrative' },
  { id: 'mem-4', placeId: 'fateh-sagar', storyId: 's-fateh', caption: 'Corn on the embankment', date: '2026-11-03', kind: 'photo', faceFlag: false, artKey: 'fateh', verification: 'Illustrative' },
  { id: 'mem-5', placeId: 'sajjangarh', storyId: 's-sajjangarh', caption: 'Wind at the top of the hill', date: '2026-11-03', kind: 'clip', faceFlag: false, artKey: 'sajjangarh', verification: 'Illustrative' },
  { id: 'mem-6', placeId: 'ambrai-ghat', storyId: null, caption: 'Looking back at the palace', date: '2026-11-04', kind: 'photo', faceFlag: false, artKey: 'pichola', verification: 'Illustrative' },
  { id: 'mem-7', placeId: 'city-palace', storyId: 's-palace-founding', caption: 'Blue windows, upper courtyard', date: '2026-11-04', kind: 'photo', faceFlag: true, artKey: 'palace', verification: 'Illustrative' },
];

/** Passport badges reward learning, never speed, crowds or risky access. */
/** @type {import('./types.js').Badge[]} */
export const badges = [
  { id: 'b-first-story', title: 'First story', titleHi: 'पहली कहानी', how: 'Read any story to the end.', doodle: 'book' },
  { id: 'b-source-reader', title: 'Source reader', titleHi: 'स्रोत पढ़ने वाले', how: 'Read one History, one Oral tradition and one Legend entry.', doodle: 'quill' },
  { id: 'b-phrase', title: 'Few good words', titleHi: 'कुछ अच्छे शब्द', how: 'Open phrase help and show a phrase.', doodle: 'speech' },
  { id: 'b-maker', title: 'Met a maker', titleHi: 'कारीगर से मुलाक़ात', how: 'Open a maker\'s profile and read how they work.', doodle: 'brush' },
  { id: 'b-slow', title: 'Slow traveller', titleHi: 'धीमे यात्री', how: 'Save three places and plan no more than three stops in a day.', doodle: 'kulhad' },
  { id: 'b-respect', title: 'Respectful visitor', titleHi: 'सम्मानजनक यात्री', how: 'Read the responsible travel notes.', doodle: 'hands' },
  { id: 'b-listener', title: 'Listener', titleHi: 'श्रोता', how: 'Listen to a chapter of an audio walk.', doodle: 'ear' },
  { id: 'b-craft', title: 'Craft curious', titleHi: 'हुनर की पहचान', how: 'Open a workshop and read how to join it.', doodle: 'pot' },
  { id: 'b-quiet', title: 'Quiet corners', titleHi: 'शांत कोने', how: 'Read how Hidden Udaipur shares places with care.', doodle: 'arch' },
];
