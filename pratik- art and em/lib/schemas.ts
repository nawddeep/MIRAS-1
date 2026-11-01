import { z } from "zod";

const isoDate = z.iso.datetime({ offset: true });
const nonEmpty = z.string().trim().min(1);

export const SOURCE_TYPES = ["history", "oral_tradition", "legend"] as const;
export const SourceType = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceType>;

export const Rights = z.object({
  owner: nonEmpty,
  permittedUse: nonEmpty,
});

/** Who checked a claim and when. A claim without verifiedBy is never shown as fact. */
const Checked = { verifiedBy: z.string().optional(), verifiedAt: isoDate.optional() };
export const CheckedNote = z.object({ text: nonEmpty, ...Checked });
export type CheckedNote = z.infer<typeof CheckedNote>;
export const Accessibility = z.object({ stepFree: z.enum(["yes", "no", "unknown"]), notes: z.string().optional(), ...Checked });
export type Accessibility = z.infer<typeof Accessibility>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use 24-hour HH:MM");
export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
/** Machine-readable hours for the trip planner. openingHours stays as the human-readable text. */
export const OpeningTimes = z.object({ open: hhmm, close: hhmm, closedDays: z.array(z.enum(WEEKDAYS)).default([]) });
export type OpeningTimes = z.infer<typeof OpeningTimes>;

export const Place = z.object({
  id: nonEmpty,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: nonEmpty,
  name_hi: z.string().optional(),
  category: nonEmpty,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  summary: nonEmpty,
  summary_hi: z.string().optional(),
  visitTips: z.array(nonEmpty),
  openingHours: nonEmpty,
  openingTimes: OpeningTimes.optional(),
  typicalVisitMinutes: z.number().int().positive(),
  photos: z.array(nonEmpty),
  preview360: z
    .object({ path: nonEmpty, illustrative: z.boolean() })
    .optional(),
  accessibility: Accessibility.optional(),
  etiquette: z.array(CheckedNote).optional(),
  conservation: z.array(CheckedNote).optional(),
  photographyRules: CheckedNote.optional(),
  status: z.enum(["draft", "published"]),
  isSample: z.boolean(),
  sourceRefs: z.array(z.url()).optional(),
  coordinateNote: z.string().optional(),
  coordinateSource: z.url().optional(),
});
export type Place = z.infer<typeof Place>;

export const HiddenLocation = z.object({ id: nonEmpty, placeId: nonEmpty, note: nonEmpty, sensitive: z.boolean() });
export const BadgeDefinition = z.object({
  id: nonEmpty, title: nonEmpty, description: nonEmpty,
  metric: z.enum(["completedTrips", "completedTrails", "artisanVisits", "publishedMemories"]),
  threshold: z.number().int().positive(), status: z.literal("definition-only"),
});

export const StoryEntry = z
  .object({
    id: nonEmpty,
    placeId: nonEmpty,
    title: nonEmpty,
    title_hi: z.string().optional(),
    text: nonEmpty,
    text_hi: z.string().optional(),
    simpleText: z.string().optional(),
    simpleTextChecked: z.boolean().default(false),
    language: z.enum(["en", "hi"]),
    sourceType: SourceType,
    sourceRef: z.string().optional(),
    verifiedBy: z.string().optional(),
    verifiedAt: isoDate.optional(),
    rights: Rights,
    updatedAt: isoDate,
    isSample: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (s.sourceType === "history" && !s.sourceRef?.trim()) {
      ctx.addIssue({ code: "custom", path: ["sourceRef"], message: "sourceRef is required when sourceType is history" });
    }
    if (s.verifiedBy?.trim() && !s.verifiedAt) {
      ctx.addIssue({ code: "custom", path: ["verifiedAt"], message: "verifiedAt is required when verifiedBy is set" });
    }
    if (s.simpleTextChecked && !s.simpleText?.trim()) {
      ctx.addIssue({ code: "custom", path: ["simpleText"], message: "simpleTextChecked is true but simpleText is empty" });
    }
  });
export type StoryEntry = z.infer<typeof StoryEntry>;

export const Consent = z.object({
  given: z.boolean(),
  date: isoDate.optional(),
  docRef: z.string().optional(),
});

export const Artisan = z.object({
  id: nonEmpty,
  name: nonEmpty,
  craft: nonEmpty,
  headline: z.string().optional(),
  description: nonEmpty,
  description_hi: z.string().optional(),
  materials: z.array(z.string()).default([]),
  languages: z.array(nonEmpty),
  photos: z.array(nonEmpty),
  contact: nonEmpty,
  locationText: nonEmpty,
  status: z.enum(["draft", "published"]),
  consent: Consent,
  photoRights: nonEmpty,
  ownerConfirmedAt: isoDate.optional(),
  editToken: z.string().min(16),
  isSample: z.boolean(),
});
export type Artisan = z.infer<typeof Artisan>;

export const Workshop = z.object({
  id: nonEmpty,
  artisanId: nonEmpty,
  title: nonEmpty,
  description: nonEmpty,
  language: nonEmpty,
  durationMinutes: z.number().int().positive(),
  cost: nonEmpty,
  howToBook: nonEmpty,
  status: z.enum(["draft", "published"]),
  confirmedByOwnerAt: isoDate.optional(),
  updatedAt: isoDate,
  isSample: z.boolean(),
});
export type Workshop = z.infer<typeof Workshop>;

export const ENQUIRY_MAX = 1000;
export const EnquiryInput = z.object({
  artisanId: nonEmpty,
  message: z.string().trim().min(1, "Please write a message.").max(ENQUIRY_MAX, `Please keep it under ${ENQUIRY_MAX} characters.`),
  contactBack: z.string().trim().min(3, "Please add a phone number or email.").max(200),
  kind: z.enum(["question", "appointment"]),
});
export type EnquiryInput = z.infer<typeof EnquiryInput>;
export type Enquiry = EnquiryInput & { id: string; createdAt: string };

export const MediaAsset = z.object({
  id: nonEmpty,
  path: nonEmpty,
  owner: nonEmpty,
  permittedUse: nonEmpty,
  licenceNote: z.string(),
  containsPeople: z.boolean(),
  title: z.string().optional(),
  sourceUrl: z.url().optional(),
  license: z.string().optional(),
  licenseUrl: z.url().optional(),
});
export type MediaAsset = z.infer<typeof MediaAsset>;

/** What the AI must return for voice onboarding. Validated before anything is shown. */
export const ListingDraft = z.object({
  title: z.string(),
  description_hi: z.string(),
  description_en: z.string(),
  category: z.string(),
  materials: z.array(z.string()),
  uncertain_fields: z.array(z.string()),
  /** Safety flag, not listing content: true means the photo shows a person's face and must not be stored. */
  photo_shows_face: z.boolean().optional(),
});
export type ListingDraft = z.infer<typeof ListingDraft>;

/** What the AI returns for Memories. Captions describe only what is visible in the frame. */
export const MomentPicks = z.object({
  moments: z
    .array(
      z.object({
        frameIndex: z.number().int().min(0),
        caption: z.string().max(200),
        placeId: z.string().nullable(),
        faceVisible: z.boolean(),
        uncertain: z.boolean(),
      }),
    )
    .max(5),
});
export type MomentPicks = z.infer<typeof MomentPicks>;

/** A content-defined trail. Never generated by AI. */
export const Trail = z.object({
  id: nonEmpty,
  title: nonEmpty,
  theme: nonEmpty,
  placeIds: z.array(nonEmpty).min(1),
  approxMinutes: z.number().int().positive(),
  isSample: z.boolean(),
});
export type Trail = z.infer<typeof Trail>;

/** Phrase help, used by "Save for offline". Translations come from the team, never generated. */
export const Phrase = z.object({ id: nonEmpty, en: nonEmpty, hi: nonEmpty, transliteration: z.string().optional(), isSample: z.boolean() });
export type Phrase = z.infer<typeof Phrase>;

/** Events follow the workshop pattern: shown only once the organiser has confirmed the details. */
export const EventItem = z.object({
  id: nonEmpty,
  title: nonEmpty,
  organiser: nonEmpty,
  startsAt: isoDate,
  language: nonEmpty,
  durationMinutes: z.number().int().positive(),
  cost: nonEmpty,
  howToBook: nonEmpty,
  confirmedByOrganiserAt: isoDate.optional(),
  updatedAt: isoDate,
  isSample: z.boolean(),
});
export type EventItem = z.infer<typeof EventItem>;

/** A visitor's "Hidden Udaipur" suggestion. Always pending until a named moderator approves it. */
export const PickInput = z.object({
  name: z.string().trim().min(1, "Please add a name.").max(80),
  description: z.string().trim().min(1, "Please describe it.").max(600),
  whyItMatters: z.string().trim().min(1, "Please say why it matters.").max(400),
  sensitive: z.boolean(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export const Pick = PickInput.extend({
  id: nonEmpty,
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: isoDate,
  moderatedBy: z.string().optional(),
  moderatedAt: isoDate.optional(),
  sourcedBy: z.string().optional(),
});
export type Pick = z.infer<typeof Pick>;

/** Slot for licensed music in Memories. Empty until the team has a track with a rights entry. */
export const MusicTrack = z.object({ id: nonEmpty, title: nonEmpty, path: nonEmpty, owner: nonEmpty, permittedUse: nonEmpty, licenceNote: nonEmpty });

export const PlaceMatch = z.object({
  placeId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  personIsMainSubject: z.boolean().default(false),
});
export type PlaceMatch = z.infer<typeof PlaceMatch>;
