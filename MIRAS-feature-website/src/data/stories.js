// Stories. Every entry carries a source type and a source reference.
// No entry here has been checked by a second person, so none is marked Verified.
// Entries written purely to demonstrate a format are marked Illustrative.

const UPDATED = '2026-10-30';
const NO_AUDIO = { available: false, synthetic: true, note: 'No recorded narration. You can listen with your browser\'s synthetic voice.' };
const UNCHECKED = 'No published source has been checked for this entry yet.';

/** @type {import('./types.js').Story[]} */
export const stories = [
  {
    id: 's-palace-founding', title: 'A capital moved to the water', placeId: 'city-palace',
    sourceType: 'History', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The founding date is widely cited. Suggested for checking: James Tod, "Annals and Antiquities of Rajast'han" (1829–32).`,
    dek: 'Why the rulers of Mewar built a new city beside a lake.',
    body: [
      'Udaipur is usually said to have been founded in the mid-16th century by Maharana Udai Singh II, as the rulers of Mewar looked for a capital that was easier to defend than Chittorgarh.',
      'The site had hills on several sides and water in front. The palace grew along the ridge above the lake, and the town grew down the slope behind it.',
      'Later rulers kept adding to the palace for centuries, which is why its courtyards and wings do not follow a single plan.',
    ],
    simple: 'A ruler of Mewar started this city in the 1500s. He chose a place with hills and a lake because it was safer. The palace was built bit by bit over many years.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-pichola-name', title: 'The lake and the village of Picholi', placeId: 'lake-pichola',
    sourceType: 'Legend', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} This is a commonly repeated local account, not a documented history.`,
    dek: 'Where the lake\'s name is said to come from.',
    body: [
      'A story often told about Lake Pichola is that it takes its name from the nearby village of Picholi, and that a dam was first built here by a travelling grain trader long before the city existed.',
      'The story is told as a legend. Dates and names vary between tellers, and MIRAS has not matched them to a written record.',
    ],
    simple: 'People say the lake is named after a village called Picholi. They also say a trader built the first dam. This is a legend; it may not be exact history.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-ghat-morning', title: 'Morning at the ghat', placeId: 'lake-pichola',
    sourceType: 'Oral tradition', verification: 'Illustrative', language: 'English',
    sourceReference: 'Written for this demonstration to show how an oral-tradition entry would look. It was not collected from a real person.',
    dek: 'A sample of the kind of everyday account MIRAS wants to record, with permission, from people who live here.',
    body: [
      'Before the boats start, the ghats belong to the people who live above them: washing laid out on the steps, someone filling brass pots, a man feeding pigeons from a paper bag.',
      'In a real entry, this section would be in the teller\'s own words, with their name only if they agreed to it.',
    ],
    simple: 'Early in the morning, local people use the steps by the lake to wash, pray and talk. This is a sample entry, not a real interview.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-jagdish-steps', title: 'Up the steps to Jagannath', placeId: 'jagdish-temple',
    sourceType: 'History', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The 17th-century date and patron are widely cited.`,
    dek: 'A temple raised high above the busiest crossing in the old city.',
    body: [
      'The Jagdish Temple is generally dated to the mid-17th century and attributed to Maharana Jagat Singh I. It is dedicated to Vishnu as Jagannath, lord of the universe.',
      'It stands on a high plinth, so the climb up from the chowk is the first thing you notice. The outer walls are carved in bands of dancers, musicians, elephants and riders.',
    ],
    simple: 'This temple for the god Vishnu was built in the 1600s. It stands high above the street, so you climb many steps. Its walls are covered in carvings.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-jagdish-bell', title: 'What the bell tells the chowk', placeId: 'jagdish-temple',
    sourceType: 'Oral tradition', verification: 'Illustrative', language: 'English',
    sourceReference: 'Written for this demonstration. Not collected from a real person and not a record of real practice.',
    dek: 'A sample oral-tradition entry about how a neighbourhood keeps time.',
    body: [
      'Shopkeepers around a temple chowk often say they can tell the hour by the bells and the crowd: when the first aarti finishes, shutters start to go up.',
      'A real entry would name who told it, when, and in which language, with their consent.',
    ],
    simple: 'People who work near the temple say the bells tell them the time of day. This is a sample entry.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-bagore-minister', title: 'A minister\'s house on the ghat', placeId: 'bagore-ki-haveli',
    sourceType: 'History', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The 18th-century origin is widely cited by the museum and travel guides.`,
    dek: 'How a private mansion became a museum of everyday life.',
    body: [
      'Bagore Ki Haveli is generally said to have been built in the 18th century for a minister of the Mewar court, and later passed through the royal family.',
      'After years of neglect it was restored and opened as a museum. Its rooms now show how a large household lived: kitchens, bathing rooms, games, clothes and puppets.',
    ],
    simple: 'This big house by the lake was built in the 1700s for an important official. Today it is a museum that shows how people lived inside it.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-gangaur', title: 'Gauri comes down to the water', placeId: 'gangaur-ghat',
    sourceType: 'Oral tradition', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} General description of a widely observed festival. Local details should come from people who take part.`,
    dek: 'The spring festival the ghat is named after.',
    body: [
      'Gangaur is a spring festival across Rajasthan, centred on the goddess Gauri. Women carry images of Gauri and Isar in procession, and in Udaipur the processions come down to the lake.',
      'The date follows the Hindu calendar, so it moves each year. Check locally before planning around it.',
    ],
    simple: 'Gangaur is a spring festival. Women carry statues of the goddess Gauri to the lake. The date changes every year.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-sajjangarh', title: 'A palace built to watch the clouds', placeId: 'sajjangarh',
    sourceType: 'Oral tradition', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The 1884 date is widely cited. The idea that it was built to watch monsoon clouds is a popular explanation, not a documented one.`,
    dek: 'Why it is called the Monsoon Palace.',
    body: [
      'Sajjangarh is usually dated to the 1880s and named after Maharana Sajjan Singh. Guides often say it was placed on the hilltop so the court could watch the monsoon clouds come in.',
      'Whether or not that was the reason, the view explains the nickname: from the top you can see the weather move across the lakes.',
    ],
    simple: 'This palace on a hill was built in the 1880s. People say it was built to watch rain clouds. That part is a popular story.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-saheliyon', title: 'A garden for the companions', placeId: 'saheliyon-ki-bari',
    sourceType: 'Legend', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The name and the story of the queen's companions are commonly told; details vary.`,
    dek: 'The story behind the name.',
    body: [
      'Saheliyon Ki Bari means "garden of the companions". It is commonly said to have been laid out for a queen and the women who came with her at her marriage.',
      'The details change from teller to teller, so MIRAS keeps it labelled as a legend.',
    ],
    simple: 'The name means "garden of the friends". People say it was made for a queen and her friends. This is a legend.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-fateh', title: 'A lake rebuilt', placeId: 'fateh-sagar',
    sourceType: 'History', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The connection to Maharana Fateh Singh is widely cited.`,
    dek: 'Why the lake carries a ruler\'s name.',
    body: [
      'Fateh Sagar is named after Maharana Fateh Singh, who is generally said to have had an earlier lake and its dam rebuilt in the late 19th century.',
      'Today the embankment is less about history and more about evenings: families, carts and the breeze off the water.',
    ],
    simple: 'This lake is named after a ruler called Fateh Singh. He had it rebuilt in the late 1800s.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-hathi-pol', title: 'The elephant gate', placeId: 'hathi-pol',
    sourceType: 'Legend', verification: 'Unverified', language: 'English',
    sourceReference: `${UNCHECKED} The meaning of the name is plain Hindi; explanations of why it was given vary.`,
    dek: 'A gate named for elephants, now a shopping street.',
    body: [
      'Hathi Pol means "elephant gate". Several explanations for the name are told locally, and MIRAS has not been able to confirm any of them.',
      'Today the gate gives its name to the shopping streets around it.',
    ],
    simple: '"Hathi Pol" means "elephant gate". Nobody is sure why it got this name.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
  {
    id: 's-lac', title: 'Bangles from heat and lac', placeId: 'bada-bazaar',
    sourceType: 'Oral tradition', verification: 'Illustrative', language: 'English',
    sourceReference: 'Written for this demonstration from general knowledge of the craft. Not collected from a real maker.',
    dek: 'A sample of how a maker\'s account would sit next to a place.',
    body: [
      'Lac is a resin. Makers warm it over a small charcoal stove, colour it, roll it into a rod and shape it round a wooden form, pressing in glass or beads while it is still soft.',
      'In a real entry, a named maker would describe their own way of working, with their consent.',
    ],
    simple: 'Lac bangles are made from a soft resin. Makers heat it, colour it and shape it by hand. This is a sample entry.',
    audio: NO_AUDIO, lastUpdated: UPDATED,
  },
];
