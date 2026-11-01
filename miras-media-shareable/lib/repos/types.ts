import type { Artisan, Enquiry, EventItem, MediaAsset, Phrase, Pick, Place, StoryEntry, Trail, Workshop } from "@/lib/schemas";

// Repository interfaces. The JSON + SQLite implementations can be swapped for a hosted DB later.

export interface PlaceRepo {
  list(): Place[];
  getById(id: string): Place | undefined;
  getBySlug(slug: string): Place | undefined;
}

/** Raw story access. Screens and AI features must go through getVisibleStories, never this directly. */
export interface StoryRepo {
  listAll(): StoryEntry[];
}

export interface ArtisanRepo {
  list(): Artisan[];
  get(id: string): Artisan | undefined;
  getByEditToken(token: string): Artisan | undefined;
  save(artisan: Artisan): void;
}

export interface WorkshopRepo {
  list(): Workshop[];
  get(id: string): Workshop | undefined;
  save(workshop: Workshop): void;
}

export interface EnquiryRepo {
  create(enquiry: Enquiry): void;
  listByArtisan(artisanId: string): Enquiry[];
  countByArtisan(): Record<string, number>;
}

export interface MediaRepo {
  list(): MediaAsset[];
  save(asset: MediaAsset): void;
}

export interface TrailRepo {
  list(): Trail[];
  get(id: string): Trail | undefined;
}

export interface PickRepo {
  list(): Pick[];
  get(id: string): Pick | undefined;
  save(pick: Pick): void;
}

export interface Repos {
  places: PlaceRepo;
  trails: TrailRepo;
  phrases: { list(): Phrase[] };
  events: { list(): EventItem[] };
  stories: StoryRepo;
  artisans: ArtisanRepo;
  workshops: WorkshopRepo;
  enquiries: EnquiryRepo;
  media: MediaRepo;
  picks: PickRepo;
}
