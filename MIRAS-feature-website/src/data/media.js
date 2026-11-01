// Media and rights register. Every image the site shows is listed here with
// who made it and what it may be used for. "Public" does not mean "reusable".

const PROJECT = 'MIRAS project artwork (creator to be confirmed by the MIRAS team)';
const PROJECT_LICENCE = 'Not recorded in the repository';
const GENERATED_NOTE =
  'Found in public/img/places with no creator, source or licence on record. It looks computer-generated, so it is shown only as a labelled illustration in the VR gallery, never as a photograph, and never as the image of a specific place (at least one file name does not match what it shows).';

/** @type {Record<string, import('./types.js').MediaItem>} */
export const media = {
  'hero-street': {
    id: 'hero-street', src: '/hero/original@2k.webp', width: 1920, height: 1080,
    alt: 'Ink drawing of a busy old-city street in Udaipur, with the City Palace on the hill behind',
    kind: 'ink-illustration', label: 'Illustration', creator: PROJECT, licence: PROJECT_LICENCE,
    permittedUse: 'MIRAS website only', notes: 'The homepage hero artwork.',
  },
  'ink-palace': {
    id: 'ink-palace', src: '/img/palace.webp', width: 1200, height: 740,
    alt: 'Ink drawing of the City Palace rising above old-city rooftops and street signs',
    kind: 'ink-illustration', label: 'Illustration', creator: PROJECT, licence: PROJECT_LICENCE,
    permittedUse: 'MIRAS website only', notes: 'Crop of the hero artwork.',
  },
  'ink-street': {
    id: 'ink-street', src: '/img/street.webp', width: 1520, height: 580,
    alt: 'Ink drawing of people crossing a street: two women walking, a woman in a sari, a man with a backpack and a cyclist',
    kind: 'ink-illustration', label: 'Illustration', creator: PROJECT, licence: PROJECT_LICENCE,
    permittedUse: 'MIRAS website only', notes: 'Crop of the hero artwork. Figures are drawn, not real people.',
  },
  'ink-lake': {
    id: 'ink-lake', src: '/img/lake-band.webp', width: 2400, height: 94,
    alt: 'Ink drawing of small covered boats on a lake',
    kind: 'ink-illustration', label: 'Illustration', creator: PROJECT, licence: PROJECT_LICENCE,
    permittedUse: 'MIRAS website only', notes: 'Strip from the bottom of the hero artwork.',
  },
  'ink-wide': {
    id: 'ink-wide', src: '/img/og.webp', width: 1200, height: 675,
    alt: 'Ink drawing of the full old-city street scene with boats on the lake below',
    kind: 'ink-illustration', label: 'Illustration', creator: PROJECT, licence: PROJECT_LICENCE,
    permittedUse: 'MIRAS website and link previews', notes: 'Social preview image.',
  },
  'gen-city-palace': {
    id: 'gen-city-palace', src: '/img/places/city-palace.png', width: 1586, height: 992,
    alt: 'Illustrative image: a long white palace along a lake at golden hour, with a small boat',
    kind: 'generated-illustration', label: 'Illustrative image, not a photograph', creator: 'Unknown',
    licence: 'Unknown', permittedUse: 'Internal demonstration only until rights are confirmed', notes: GENERATED_NOTE,
  },
  'gen-lake-pichola': {
    id: 'gen-lake-pichola', src: '/img/places/lake-pichola.webp', width: 1600, height: 1001,
    alt: 'Illustrative image: a lake at sunset with a white island palace and a covered boat',
    kind: 'generated-illustration', label: 'Illustrative image, not a photograph', creator: 'Unknown',
    licence: 'Unknown', permittedUse: 'Internal demonstration only until rights are confirmed', notes: GENERATED_NOTE,
  },
  'gen-jagdish-temple': {
    id: 'gen-jagdish-temple', src: '/img/places/jagdish-temple.png', width: 1586, height: 992,
    alt: 'Illustrative image: a lake at sunset with an island palace and a covered boat (the file is named after Jagdish Temple but does not show it)',
    kind: 'generated-illustration', label: 'Illustrative image, not a photograph', creator: 'Unknown',
    licence: 'Unknown', permittedUse: 'Internal demonstration only until rights are confirmed', notes: GENERATED_NOTE,
  },
  'gen-bagore-ki-haveli': {
    id: 'gen-bagore-ki-haveli', src: '/img/places/bagore-ki-haveli.png', width: 1586, height: 992,
    alt: 'Illustrative image: a lamp-lit palace courtyard at dusk',
    kind: 'generated-illustration', label: 'Illustrative image, not a photograph', creator: 'Unknown',
    licence: 'Unknown', permittedUse: 'Internal demonstration only until rights are confirmed', notes: GENERATED_NOTE,
  },
  'gen-fateh-sagar': {
    id: 'gen-fateh-sagar', src: '/img/places/fateh-sagar.webp', width: 1600, height: 1001,
    alt: 'Illustrative image: a lake with a palm-covered island and hills behind',
    kind: 'generated-illustration', label: 'Illustrative image, not a photograph', creator: 'Unknown',
    licence: 'Unknown', permittedUse: 'Internal demonstration only until rights are confirmed', notes: GENERATED_NOTE,
  },
  'gen-sajjangarh': {
    id: 'gen-sajjangarh', src: '/img/places/sajjangarh.png', width: 1586, height: 992,
    alt: 'Illustrative image: a palace on a forested hilltop above lakes at sunset',
    kind: 'generated-illustration', label: 'Illustrative image, not a photograph', creator: 'Unknown',
    licence: 'Unknown', permittedUse: 'Internal demonstration only until rights are confirmed', notes: GENERATED_NOTE,
  },
};

/** 360 / VR scenes. None of these is a real 360 capture. */
/** @type {import('./types.js').Scene[]} */
export const scenes = [
  { id: 'scene-old-city', title: 'Old-city street, drawn', placeId: 'jagdish-temple', mediaId: 'hero-street', kind: 'Illustrative', note: 'A pannable ink drawing standing in for a 360 capture. No real capture exists yet.' },
  { id: 'scene-palace-hill', title: 'Palace above the rooftops', placeId: 'city-palace', mediaId: 'ink-palace', kind: 'Illustrative', note: 'Drawn view; proportions are artistic, not surveyed.' },
  { id: 'scene-pichola', title: 'Lake Pichola at dusk', placeId: 'lake-pichola', mediaId: 'gen-lake-pichola', kind: 'Illustrative', note: 'Illustrative image with unknown rights. Not a photograph.' },
  { id: 'scene-fateh', title: 'Fateh Sagar embankment', placeId: 'fateh-sagar', mediaId: 'gen-fateh-sagar', kind: 'Illustrative', note: 'Illustrative image with unknown rights. Not a photograph.' },
  { id: 'scene-courtyard', title: 'Haveli courtyard, as it may have looked', placeId: 'bagore-ki-haveli', mediaId: 'ink-wide', kind: 'Reconstructed', note: 'Placeholder for a future reconstruction. A reconstruction would be an interpretation, not a record, and would be reviewed by a historian before use.' },
];
