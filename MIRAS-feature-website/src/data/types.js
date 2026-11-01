// Shared JSDoc types for the MIRAS mock-data layer.
// The project is plain JavaScript; these typedefs are checked by `npm run typecheck`.

/** @typedef {'Verified' | 'Unverified' | 'Illustrative' | 'Concept' | 'Reconstructed'} Verification */
/** @typedef {'History' | 'Oral tradition' | 'Legend'} SourceType */
/** @typedef {'architecture' | 'lakes' | 'art' | 'food' | 'photography' | 'family' | 'crafts' | 'markets' | 'spiritual'} Interest */

/**
 * @typedef {object} MediaItem
 * @property {string} id
 * @property {string} src            Path under /public, or '' when the item is drawn in code
 * @property {string} alt
 * @property {number} [width]
 * @property {number} [height]
 * @property {'ink-illustration' | 'generated-illustration' | 'code-drawing' | 'placeholder'} kind
 * @property {string} label          Short label shown next to the image
 * @property {string} creator
 * @property {string} licence
 * @property {string} permittedUse
 * @property {string} notes
 */

/**
 * @typedef {object} Coordinates
 * @property {number} lat
 * @property {number} lng
 * @property {'approximate' | 'general-area'} precision
 */

/**
 * Opening hours. `null` on a place means no hours are on file.
 * `days` is keyed by weekday (0 = Sunday). An empty array means closed that day.
 * @typedef {object} Hours
 * @property {Verification} status
 * @property {string} note
 * @property {Record<number, Array<[string, string]>>} days
 */

/**
 * @typedef {object} Place
 * @property {string} id
 * @property {string} name
 * @property {string} nameHi
 * @property {string} category
 * @property {Interest[]} interests
 * @property {string} area
 * @property {Coordinates} coords
 * @property {number} visitMinutes
 * @property {Hours | null} hours
 * @property {string} summary
 * @property {Array<{label: string, value: string}>} facts
 * @property {string} factsSource
 * @property {string[]} visitTips
 * @property {{status: Verification, items: string[]} | null} etiquette
 * @property {{status: Verification, items: string[]} | null} accessibility
 * @property {string[]} storyIds
 * @property {boolean} popular
 * @property {{placeId?: string, time?: string, basis: string} | null} quieter
 * @property {string} artKey          Key into the line drawings in src/art.js
 * @property {string | null} imageId  Key into media
 * @property {string | null} sceneId  Key into scenes (360 preview)
 * @property {Verification} verification
 * @property {string} lastUpdated
 * @property {string[]} collections
 */

/**
 * @typedef {object} Story
 * @property {string} id
 * @property {string} title
 * @property {string} placeId
 * @property {SourceType} sourceType
 * @property {string} sourceReference
 * @property {Verification} verification
 * @property {string} language
 * @property {string} dek
 * @property {string[]} body
 * @property {string} simple
 * @property {{available: boolean, synthetic: boolean, note: string}} audio
 * @property {string} lastUpdated
 */

/**
 * @typedef {object} Artisan
 * @property {string} id
 * @property {string} studio
 * @property {string} craft
 * @property {string} craftHi
 * @property {string} area
 * @property {string} nearPlaceId
 * @property {Coordinates} coords
 * @property {string[]} languages
 * @property {string} intro
 * @property {string} process
 * @property {string} doodle
 * @property {Verification} verification
 * @property {{status: string, note: string}} consent
 * @property {string} lastUpdated
 */

/**
 * @typedef {object} Price
 * @property {number} amount
 * @property {'INR'} currency
 * @property {string} note
 */

/**
 * @typedef {object} Product
 * @property {string} id
 * @property {string} artisanId
 * @property {string} title
 * @property {string} material
 * @property {Price} price
 * @property {Verification} verification
 * @property {string} rights
 */

/**
 * @typedef {object} Service
 * @property {string} id
 * @property {string} artisanId
 * @property {string} title
 * @property {string} detail
 * @property {string} howToRequest
 * @property {Verification} verification
 */

/**
 * @typedef {object} Workshop
 * @property {string} id
 * @property {string} artisanId
 * @property {string} placeId
 * @property {string} title
 * @property {string} craft
 * @property {string} description
 * @property {string[]} languages
 * @property {number} durationMin
 * @property {Price} cost
 * @property {number} groupSize
 * @property {string[]} sampleDays
 * @property {string} howToBook
 * @property {boolean} ownerConfirmed
 * @property {Verification} verification
 * @property {string} lastUpdated
 */

/**
 * @typedef {object} EventItem
 * @property {string} id
 * @property {string} title
 * @property {'Performance' | 'Festival' | 'Exhibition' | 'Heritage walk' | 'Fair'} kind
 * @property {string} placeId
 * @property {string} when
 * @property {string | null} month       Lower-case month name for filtering, or null when it moves
 * @property {string} availability
 * @property {string} language
 * @property {string} duration
 * @property {string} cost
 * @property {string} bookingMethod
 * @property {boolean} organiserConfirmed
 * @property {'Demo listing' | 'Public programme, details unconfirmed'} listingType
 * @property {string} description
 * @property {Verification} verification
 * @property {string} lastUpdated
 */

/**
 * @typedef {object} Review
 * @property {string} id
 * @property {string} placeId
 * @property {'Visitor review' | 'Local tip'} kind
 * @property {string} author
 * @property {string} text
 * @property {string} date
 * @property {Verification} verification
 */

/**
 * @typedef {object} Trail
 * @property {string} id
 * @property {string} title
 * @property {string} theme
 * @property {'themed' | 'timed'} kind
 * @property {string} blurb
 * @property {string[]} placeIds
 * @property {number} durationMin
 * @property {Verification} verification
 */

/**
 * @typedef {object} Itinerary
 * @property {string} id
 * @property {string} title
 * @property {number} days
 * @property {string} intro
 * @property {Array<{title: string, placeIds: string[], note: string}>} plan
 * @property {Verification} verification
 */

/**
 * @typedef {object} AudioChapter
 * @property {string} id
 * @property {string} title
 * @property {string} placeId
 * @property {string | null} storyId
 * @property {string} text
 * @property {number} estSeconds
 */

/**
 * @typedef {object} AudioWalk
 * @property {string} id
 * @property {string} title
 * @property {string} blurb
 * @property {number} durationMin
 * @property {string} language
 * @property {AudioChapter[]} chapters
 * @property {Verification} verification
 */

/**
 * @typedef {object} Memory
 * @property {string} id
 * @property {string} placeId
 * @property {string | null} storyId
 * @property {string} caption
 * @property {string} date
 * @property {'photo' | 'clip'} kind
 * @property {boolean} faceFlag
 * @property {string} artKey
 * @property {Verification} verification
 */

/**
 * @typedef {object} Badge
 * @property {string} id
 * @property {string} title
 * @property {string} titleHi
 * @property {string} how
 * @property {string} doodle
 */

/**
 * @typedef {object} Market
 * @property {string} id
 * @property {string} name
 * @property {string} placeId
 * @property {string[]} categories
 * @property {string} bestFor
 * @property {string} tip
 * @property {Verification} verification
 * @property {string} lastUpdated
 */

/**
 * @typedef {object} HiddenPlace
 * @property {string} id
 * @property {string} title
 * @property {string} area
 * @property {string} blurb
 * @property {string} contributor
 * @property {string} sourcing
 * @property {'Low' | 'Medium' | 'High'} sensitivity
 * @property {string} sensitivityNote
 * @property {'Approved (sample)' | 'Awaiting review (sample)'} moderation
 * @property {'general-area'} locationPrecision
 * @property {string} doodle
 * @property {Verification} verification
 */

/**
 * @typedef {object} Phrase
 * @property {string} id
 * @property {string} en
 * @property {string} hi
 * @property {string} translit
 * @property {string} context
 */

/**
 * @typedef {object} Scene
 * @property {string} id
 * @property {string} title
 * @property {string} placeId
 * @property {string} mediaId
 * @property {'Existing capture' | 'Reconstructed' | 'Illustrative'} kind
 * @property {string} note
 */

export {};
