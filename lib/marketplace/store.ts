import { randomUUID } from 'node:crypto';
import { openDb, type Db } from '@/lib/repos/sqlite';
import { getConfig } from '@/lib/config';
import { CommunityError, type Member } from '@/lib/community/store';

export type Shop = {
  id: string;
  ownerAccountId: string;
  name: string;
  slug: string;
  craft: string;
  description: string;
  story: string;
  locality: string;
  openingHours: string;
  languages: string[];
  contactMethod: string;
  coverImage: string;
  profileImage: string;
  status: 'draft' | 'published';
  verificationStatus: 'unverified' | 'verified';
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  shopId: string;
  name: string;
  description: string;
  category: string;
  priceInr: number;
  images: string[];
  materials: string[];
  availability: 'in_stock' | 'out_of_stock' | 'made_to_order';
  customOrderSupported: boolean;
  status: 'draft' | 'published' | 'out_of_stock' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type OrganizerProfile = {
  id: string;
  accountId: string;
  organizationName: string;
  description: string;
  contactInfo: string;
  locality: string;
  languages: string[];
  logoImage: string;
  verificationStatus: 'unverified' | 'verified';
  createdAt: string;
  updatedAt: string;
};

export type EventType =
  | 'workshop'
  | 'heritage_walk'
  | 'cultural_performance'
  | 'exhibition'
  | 'festival'
  | 'guided_experience'
  | 'community_event'
  | 'other';

export type CommunityEvent = {
  id: string;
  organizerId: string;
  organizerRole: 'artisan' | 'event_manager';
  organizerName: string;
  eventType: EventType;
  title: string;
  description: string;
  coverImage: string;
  location: string;
  startsAt: string;
  durationMinutes: number;
  language: string;
  capacity: number;
  cost: string;
  howToBook: string;
  status: 'draft' | 'published' | 'cancelled';
  confirmedByOrganiserAt?: string | null;
  craftSkill: string;
  materialsProvided: string;
  skillLevel: string;
  instructorInfo: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalFriendProfile = {
  id: string;
  accountId: string;
  role: 'artisan' | 'event_manager';
  isEnabled: boolean;
  displayName: string;
  introduction: string;
  languages: string[];
  expertise: string[];
  availabilityNote: string;
  contactPreference: string;
  verificationStatus: 'unverified' | 'verified';
  updatedAt: string;
};

export type LocalFriendRequest = {
  id: string;
  friendAccountId: string;
  senderAccountId?: string | null;
  senderName: string;
  senderContact: string;
  dates: string;
  topics: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  responseNote: string;
  createdAt: string;
  updatedAt: string;
};

export type TwoWayReview = {
  id: string;
  targetType: 'shop' | 'event' | 'visitor';
  targetId: string;
  authorId: string;
  authorName: string;
  authorRole: 'visitor' | 'artisan' | 'event_manager';
  rating: number;
  title: string;
  feedback: string;
  interactionRef: string;
  status: 'published' | 'reported' | 'hidden';
  createdAt: string;
};

export type EventEnquiry = {
  id: string;
  eventId: string;
  organizerId: string;
  name: string;
  contactBack: string;
  tickets: number;
  message: string;
  status: 'new' | 'replied' | 'archived';
  createdAt: string;
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type ShopRow = {
  id: string;
  owner_account_id: string;
  name: string;
  slug: string;
  craft: string;
  description: string;
  story: string;
  locality: string;
  opening_hours: string;
  languages: string;
  contact_method: string;
  cover_image: string;
  profile_image: string;
  status: 'draft' | 'published';
  verification_status: 'unverified' | 'verified';
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  category: string;
  price_inr: number;
  images: string;
  materials: string;
  availability: 'in_stock' | 'out_of_stock' | 'made_to_order';
  custom_order_supported: number;
  status: 'draft' | 'published' | 'out_of_stock' | 'archived';
  created_at: string;
  updated_at: string;
};

type OrganizerRow = {
  id: string;
  account_id: string;
  organization_name: string;
  description: string;
  contact_info: string;
  locality: string;
  languages: string;
  logo_image: string;
  verification_status: 'unverified' | 'verified';
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  organizer_id: string;
  organizer_role: 'artisan' | 'event_manager';
  organizer_name: string;
  event_type: EventType;
  title: string;
  description: string;
  cover_image: string;
  location: string;
  starts_at: string;
  duration_minutes: number;
  language: string;
  capacity: number;
  cost: string;
  how_to_book: string;
  status: 'draft' | 'published' | 'cancelled';
  confirmed_by_organiser_at?: string | null;
  craft_skill: string;
  materials_provided: string;
  skill_level: string;
  instructor_info: string;
  created_at: string;
  updated_at: string;
};

type FriendRow = {
  id: string;
  account_id: string;
  role: 'artisan' | 'event_manager';
  is_enabled: number;
  display_name: string;
  introduction: string;
  languages: string;
  expertise: string;
  availability_note: string;
  contact_preference: string;
  verification_status: 'unverified' | 'verified';
  updated_at: string;
};

type ReviewRow = {
  id: string;
  target_type: 'shop' | 'event' | 'visitor';
  target_id: string;
  author_id: string;
  author_name: string;
  author_role: 'visitor' | 'artisan' | 'event_manager';
  rating: number;
  title: string;
  feedback: string;
  interaction_ref: string;
  status: 'published' | 'reported' | 'hidden';
  created_at: string;
};

type RequestRow = {
  id: string;
  friend_account_id: string;
  sender_account_id?: string | null;
  sender_name: string;
  sender_contact: string;
  dates: string;
  topics: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  response_note: string;
  created_at: string;
  updated_at: string;
};

type EnquiryRow = {
  id: string;
  event_id: string;
  organizer_id: string;
  name: string;
  contact_back: string;
  tickets: number;
  message: string;
  status: 'new' | 'replied' | 'archived';
  created_at: string;
};

export function createMarketplace(db: Db) {
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS artisan_shops (
      id TEXT PRIMARY KEY,
      owner_account_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      craft TEXT NOT NULL,
      description TEXT NOT NULL,
      story TEXT NOT NULL DEFAULT '',
      locality TEXT NOT NULL DEFAULT '',
      opening_hours TEXT NOT NULL DEFAULT '',
      languages TEXT NOT NULL DEFAULT '[]',
      contact_method TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      profile_image TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_artisan_shops_owner ON artisan_shops(owner_account_id);
    CREATE INDEX IF NOT EXISTS idx_artisan_shops_slug ON artisan_shops(slug);

    CREATE TABLE IF NOT EXISTS artisan_products (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES artisan_shops(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price_inr INTEGER NOT NULL DEFAULT 0,
      images TEXT NOT NULL DEFAULT '[]',
      materials TEXT NOT NULL DEFAULT '[]',
      availability TEXT NOT NULL DEFAULT 'in_stock',
      custom_order_supported INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_artisan_products_shop ON artisan_products(shop_id);

    CREATE TABLE IF NOT EXISTS organizer_profiles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL UNIQUE REFERENCES community_accounts(id) ON DELETE CASCADE,
      organization_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      contact_info TEXT NOT NULL DEFAULT '',
      locality TEXT NOT NULL DEFAULT '',
      languages TEXT NOT NULL DEFAULT '[]',
      logo_image TEXT NOT NULL DEFAULT '',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_events (
      id TEXT PRIMARY KEY,
      organizer_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      organizer_role TEXT NOT NULL,
      organizer_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_image TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      language TEXT NOT NULL DEFAULT 'Hindi & English',
      capacity INTEGER NOT NULL DEFAULT 20,
      cost TEXT NOT NULL DEFAULT 'Free',
      how_to_book TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      confirmed_by_organiser_at TEXT,
      craft_skill TEXT NOT NULL DEFAULT '',
      materials_provided TEXT NOT NULL DEFAULT '',
      skill_level TEXT NOT NULL DEFAULT 'All levels',
      instructor_info TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_community_events_starts ON community_events(starts_at);
    CREATE INDEX IF NOT EXISTS idx_community_events_org ON community_events(organizer_id);

    CREATE TABLE IF NOT EXISTS local_friend_profiles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL UNIQUE REFERENCES community_accounts(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 0,
      display_name TEXT NOT NULL,
      introduction TEXT NOT NULL DEFAULT '',
      languages TEXT NOT NULL DEFAULT '[]',
      expertise TEXT NOT NULL DEFAULT '[]',
      availability_note TEXT NOT NULL DEFAULT '',
      contact_preference TEXT NOT NULL DEFAULT '',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_friend_requests (
      id TEXT PRIMARY KEY,
      friend_account_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      sender_account_id TEXT REFERENCES community_accounts(id) ON DELETE SET NULL,
      sender_name TEXT NOT NULL,
      sender_contact TEXT NOT NULL,
      dates TEXT NOT NULL DEFAULT '',
      topics TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      response_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_friend_requests ON local_friend_requests(friend_account_id);

    CREATE TABLE IF NOT EXISTS two_way_reviews (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title TEXT NOT NULL,
      feedback TEXT NOT NULL,
      interaction_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON two_way_reviews(target_type, target_id);

    CREATE TABLE IF NOT EXISTS event_enquiries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
      organizer_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      contact_back TEXT NOT NULL,
      tickets INTEGER NOT NULL DEFAULT 1,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_event_enquiries ON event_enquiries(organizer_id);
  `);

  function mapShop(row: ShopRow): Shop {
    return {
      id: row.id,
      ownerAccountId: row.owner_account_id,
      name: row.name,
      slug: row.slug,
      craft: row.craft,
      description: row.description,
      story: row.story,
      locality: row.locality,
      openingHours: row.opening_hours,
      languages: JSON.parse(row.languages || '[]'),
      contactMethod: row.contact_method,
      coverImage: row.cover_image,
      profileImage: row.profile_image,
      status: row.status,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapProduct(row: ProductRow): Product {
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      description: row.description,
      category: row.category,
      priceInr: Number(row.price_inr),
      images: JSON.parse(row.images || '[]'),
      materials: JSON.parse(row.materials || '[]'),
      availability: row.availability,
      customOrderSupported: Boolean(row.custom_order_supported),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapOrganizer(row: OrganizerRow): OrganizerProfile {
    return {
      id: row.id,
      accountId: row.account_id,
      organizationName: row.organization_name,
      description: row.description,
      contactInfo: row.contact_info,
      locality: row.locality,
      languages: JSON.parse(row.languages || '[]'),
      logoImage: row.logo_image,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapEvent(row: EventRow): CommunityEvent {
    return {
      id: row.id,
      organizerId: row.organizer_id,
      organizerRole: row.organizer_role,
      organizerName: row.organizer_name,
      eventType: row.event_type,
      title: row.title,
      description: row.description,
      coverImage: row.cover_image,
      location: row.location,
      startsAt: row.starts_at,
      durationMinutes: Number(row.duration_minutes),
      language: row.language,
      capacity: Number(row.capacity),
      cost: row.cost,
      howToBook: row.how_to_book,
      status: row.status,
      confirmedByOrganiserAt: row.confirmed_by_organiser_at,
      craftSkill: row.craft_skill,
      materialsProvided: row.materials_provided,
      skillLevel: row.skill_level,
      instructorInfo: row.instructor_info,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapFriend(row: FriendRow): LocalFriendProfile {
    return {
      id: row.id,
      accountId: row.account_id,
      role: row.role,
      isEnabled: Boolean(row.is_enabled),
      displayName: row.display_name,
      introduction: row.introduction,
      languages: JSON.parse(row.languages || '[]'),
      expertise: JSON.parse(row.expertise || '[]'),
      availabilityNote: row.availability_note,
      contactPreference: row.contact_preference,
      verificationStatus: row.verification_status,
      updatedAt: row.updated_at,
    };
  }

  function mapReview(row: ReviewRow): TwoWayReview {
    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorRole: row.author_role,
      rating: Number(row.rating),
      title: row.title,
      feedback: row.feedback,
      interactionRef: row.interaction_ref,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  function mapRequest(row: RequestRow): LocalFriendRequest {
    return {
      id: row.id,
      friendAccountId: row.friend_account_id,
      senderAccountId: row.sender_account_id,
      senderName: row.sender_name,
      senderContact: row.sender_contact,
      dates: row.dates,
      topics: row.topics,
      message: row.message,
      status: row.status,
      responseNote: row.response_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapEnquiry(row: EnquiryRow): EventEnquiry {
    return {
      id: row.id,
      eventId: row.event_id,
      organizerId: row.organizer_id,
      name: row.name,
      contactBack: row.contact_back,
      tickets: Number(row.tickets),
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  return {
    // --- SHOPS ---
    getShopByOwner(ownerAccountId: string): Shop | undefined {
      const row = db.prepare('SELECT * FROM artisan_shops WHERE owner_account_id = ?').get(ownerAccountId) as ShopRow | undefined;
      return row ? mapShop(row) : undefined;
    },

    getShopBySlug(slug: string): Shop | undefined {
      const row = db.prepare('SELECT * FROM artisan_shops WHERE slug = ? COLLATE NOCASE').get(slug) as ShopRow | undefined;
      return row ? mapShop(row) : undefined;
    },

    getShopById(id: string): Shop | undefined {
      const row = db.prepare('SELECT * FROM artisan_shops WHERE id = ?').get(id) as ShopRow | undefined;
      return row ? mapShop(row) : undefined;
    },

    createShop(
      ownerAccountId: string,
      input: {
        name: string;
        craft: string;
        description: string;
        story?: string;
        locality?: string;
        openingHours?: string;
        languages?: string[];
        contactMethod?: string;
        coverImage?: string;
        profileImage?: string;
        status?: 'draft' | 'published';
      }
    ): Shop {
      const existing = this.getShopByOwner(ownerAccountId);
      if (existing) throw new CommunityError('An artisan shop already exists for this account.', 409);

      const baseSlug = slugify(input.name) || 'artisan-shop';
      let slug = baseSlug;
      let counter = 1;
      while (this.getShopBySlug(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO artisan_shops (
          id, owner_account_id, name, slug, craft, description, story, locality,
          opening_hours, languages, contact_method, cover_image, profile_image,
          status, verification_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        ownerAccountId,
        input.name.trim(),
        slug,
        input.craft.trim(),
        input.description.trim(),
        input.story?.trim() || '',
        input.locality?.trim() || '',
        input.openingHours?.trim() || '',
        JSON.stringify(input.languages || ['Hindi', 'English']),
        input.contactMethod?.trim() || '',
        input.coverImage?.trim() || '',
        input.profileImage?.trim() || '',
        input.status || 'published',
        'unverified',
        now,
        now
      );
      return this.getShopById(id)!;
    },

    updateShop(
      ownerAccountId: string,
      input: Partial<{
        name: string;
        craft: string;
        description: string;
        story: string;
        locality: string;
        openingHours: string;
        languages: string[];
        contactMethod: string;
        coverImage: string;
        profileImage: string;
        status: 'draft' | 'published';
      }>
    ): Shop {
      const shop = this.getShopByOwner(ownerAccountId);
      if (!shop) throw new CommunityError('Shop not found.', 404);

      const now = new Date().toISOString();
      const name = input.name !== undefined ? input.name.trim() : shop.name;
      const craft = input.craft !== undefined ? input.craft.trim() : shop.craft;
      const description = input.description !== undefined ? input.description.trim() : shop.description;
      const story = input.story !== undefined ? input.story.trim() : shop.story;
      const locality = input.locality !== undefined ? input.locality.trim() : shop.locality;
      const openingHours = input.openingHours !== undefined ? input.openingHours.trim() : shop.openingHours;
      const languages = input.languages !== undefined ? JSON.stringify(input.languages) : JSON.stringify(shop.languages);
      const contactMethod = input.contactMethod !== undefined ? input.contactMethod.trim() : shop.contactMethod;
      const coverImage = input.coverImage !== undefined ? input.coverImage.trim() : shop.coverImage;
      const profileImage = input.profileImage !== undefined ? input.profileImage.trim() : shop.profileImage;
      const status = input.status !== undefined ? input.status : shop.status;

      db.prepare(`
        UPDATE artisan_shops SET
          name = ?, craft = ?, description = ?, story = ?, locality = ?,
          opening_hours = ?, languages = ?, contact_method = ?, cover_image = ?,
          profile_image = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        name,
        craft,
        description,
        story,
        locality,
        openingHours,
        languages,
        contactMethod,
        coverImage,
        profileImage,
        status,
        now,
        shop.id
      );

      return this.getShopById(shop.id)!;
    },

    listPublishedShops(craftCategory?: string): Shop[] {
      let query = "SELECT * FROM artisan_shops WHERE status = 'published'";
      const params: (string | number)[] = [];
      if (craftCategory && craftCategory.trim()) {
        query += " AND craft LIKE ? COLLATE NOCASE";
        params.push(`%${craftCategory.trim()}%`);
      }
      query += " ORDER BY created_at DESC";
      const rows = db.prepare(query).all(...params) as ShopRow[];
      return rows.map(mapShop);
    },

    // --- PRODUCTS ---
    getProduct(id: string): Product | undefined {
      const row = db.prepare('SELECT * FROM artisan_products WHERE id = ?').get(id) as ProductRow | undefined;
      return row ? mapProduct(row) : undefined;
    },

    listProductsByShop(shopId: string, includeDrafts = false): Product[] {
      let query = 'SELECT * FROM artisan_products WHERE shop_id = ?';
      if (!includeDrafts) {
        query += " AND status = 'published'";
      }
      query += ' ORDER BY created_at DESC';
      const rows = db.prepare(query).all(shopId) as ProductRow[];
      return rows.map(mapProduct);
    },

    createProduct(
      ownerAccountId: string,
      input: {
        name: string;
        description: string;
        category: string;
        priceInr: number;
        images?: string[];
        materials?: string[];
        availability?: 'in_stock' | 'out_of_stock' | 'made_to_order';
        customOrderSupported?: boolean;
        status?: 'draft' | 'published' | 'out_of_stock' | 'archived';
      }
    ): Product {
      const shop = this.getShopByOwner(ownerAccountId);
      if (!shop) throw new CommunityError('You must register an artisan shop before adding products.', 403);

      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO artisan_products (
          id, shop_id, name, description, category, price_inr, images, materials,
          availability, custom_order_supported, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        shop.id,
        input.name.trim(),
        input.description.trim(),
        input.category.trim(),
        Math.max(0, Math.round(input.priceInr || 0)),
        JSON.stringify(input.images || []),
        JSON.stringify(input.materials || []),
        input.availability || 'in_stock',
        input.customOrderSupported ? 1 : 0,
        input.status || 'published',
        now,
        now
      );
      return this.getProduct(id)!;
    },

    updateProduct(
      ownerAccountId: string,
      productId: string,
      input: Partial<{
        name: string;
        description: string;
        category: string;
        priceInr: number;
        images: string[];
        materials: string[];
        availability: 'in_stock' | 'out_of_stock' | 'made_to_order';
        customOrderSupported: boolean;
        status: 'draft' | 'published' | 'out_of_stock' | 'archived';
      }>
    ): Product {
      const shop = this.getShopByOwner(ownerAccountId);
      if (!shop) throw new CommunityError('Shop not found.', 403);
      const product = this.getProduct(productId);
      if (!product || product.shopId !== shop.id) {
        throw new CommunityError('Product not found or not owned by your shop.', 404);
      }

      const now = new Date().toISOString();
      const name = input.name !== undefined ? input.name.trim() : product.name;
      const description = input.description !== undefined ? input.description.trim() : product.description;
      const category = input.category !== undefined ? input.category.trim() : product.category;
      const priceInr = input.priceInr !== undefined ? Math.max(0, Math.round(input.priceInr)) : product.priceInr;
      const images = input.images !== undefined ? JSON.stringify(input.images) : JSON.stringify(product.images);
      const materials = input.materials !== undefined ? JSON.stringify(input.materials) : JSON.stringify(product.materials);
      const availability = input.availability !== undefined ? input.availability : product.availability;
      const customOrder = input.customOrderSupported !== undefined ? (input.customOrderSupported ? 1 : 0) : (product.customOrderSupported ? 1 : 0);
      const status = input.status !== undefined ? input.status : product.status;

      db.prepare(`
        UPDATE artisan_products SET
          name = ?, description = ?, category = ?, price_inr = ?, images = ?,
          materials = ?, availability = ?, custom_order_supported = ?, status = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        name,
        description,
        category,
        priceInr,
        images,
        materials,
        availability,
        customOrder,
        status,
        now,
        product.id
      );

      return this.getProduct(product.id)!;
    },

    deleteProduct(ownerAccountId: string, productId: string): void {
      const shop = this.getShopByOwner(ownerAccountId);
      if (!shop) throw new CommunityError('Shop not found.', 403);
      const product = this.getProduct(productId);
      if (!product || product.shopId !== shop.id) {
        throw new CommunityError('Product not found or not owned by your shop.', 404);
      }
      db.prepare('DELETE FROM artisan_products WHERE id = ?').run(productId);
    },

    // --- ORGANIZER PROFILES ---
    getOrganizerProfile(accountId: string): OrganizerProfile | undefined {
      const row = db.prepare('SELECT * FROM organizer_profiles WHERE account_id = ?').get(accountId) as OrganizerRow | undefined;
      return row ? mapOrganizer(row) : undefined;
    },

    upsertOrganizerProfile(
      accountId: string,
      input: {
        organizationName: string;
        description?: string;
        contactInfo?: string;
        locality?: string;
        languages?: string[];
        logoImage?: string;
      }
    ): OrganizerProfile {
      const existing = this.getOrganizerProfile(accountId);
      const now = new Date().toISOString();
      if (existing) {
        db.prepare(`
          UPDATE organizer_profiles SET
            organization_name = ?, description = ?, contact_info = ?, locality = ?,
            languages = ?, logo_image = ?, updated_at = ?
          WHERE account_id = ?
        `).run(
          input.organizationName.trim(),
          input.description?.trim() || existing.description,
          input.contactInfo?.trim() || existing.contactInfo,
          input.locality?.trim() || existing.locality,
          JSON.stringify(input.languages || existing.languages),
          input.logoImage?.trim() || existing.logoImage,
          now,
          accountId
        );
      } else {
        const id = randomUUID();
        db.prepare(`
          INSERT INTO organizer_profiles (
            id, account_id, organization_name, description, contact_info, locality,
            languages, logo_image, verification_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          accountId,
          input.organizationName.trim(),
          input.description?.trim() || '',
          input.contactInfo?.trim() || '',
          input.locality?.trim() || '',
          JSON.stringify(input.languages || ['Hindi', 'English']),
          input.logoImage?.trim() || '',
          'unverified',
          now,
          now
        );
      }
      return this.getOrganizerProfile(accountId)!;
    },

    // --- COMMUNITY EVENTS & WORKSHOPS ---
    getEvent(id: string): CommunityEvent | undefined {
      const row = db.prepare('SELECT * FROM community_events WHERE id = ?').get(id) as EventRow | undefined;
      return row ? mapEvent(row) : undefined;
    },

    createEvent(
      author: Member,
      input: {
        eventType: EventType;
        title: string;
        description: string;
        coverImage?: string;
        location: string;
        startsAt: string;
        durationMinutes?: number;
        language?: string;
        capacity?: number;
        cost?: string;
        howToBook?: string;
        status?: 'draft' | 'published';
        // Workshop specifics:
        craftSkill?: string;
        materialsProvided?: string;
        skillLevel?: string;
        instructorInfo?: string;
      }
    ): CommunityEvent {
      if (author.role === 'visitor') {
        throw new CommunityError('Visitors cannot create events or workshops.', 403);
      }
      if (author.role === 'artisan' && input.eventType !== 'workshop') {
        throw new CommunityError('Artisans can only host craft workshops.', 403);
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      const confirmedAt = now; // Auto-confirm organizer events created in platform

      db.prepare(`
        INSERT INTO community_events (
          id, organizer_id, organizer_role, organizer_name, event_type, title,
          description, cover_image, location, starts_at, duration_minutes, language,
          capacity, cost, how_to_book, status, confirmed_by_organiser_at,
          craft_skill, materials_provided, skill_level, instructor_info,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        author.id,
        author.role,
        author.name,
        input.eventType,
        input.title.trim(),
        input.description.trim(),
        input.coverImage?.trim() || '',
        input.location.trim(),
        input.startsAt,
        Math.max(15, input.durationMinutes || 60),
        input.language?.trim() || 'Hindi & English',
        Math.max(1, input.capacity || 20),
        input.cost?.trim() || 'Free',
        input.howToBook?.trim() || 'Register through MIRAS',
        input.status || 'published',
        confirmedAt,
        input.craftSkill?.trim() || '',
        input.materialsProvided?.trim() || '',
        input.skillLevel?.trim() || 'All levels',
        input.instructorInfo?.trim() || author.name,
        now,
        now
      );

      return this.getEvent(id)!;
    },

    updateEvent(
      authorId: string,
      eventId: string,
      input: Partial<{
        title: string;
        description: string;
        coverImage: string;
        location: string;
        startsAt: string;
        durationMinutes: number;
        language: string;
        capacity: number;
        cost: string;
        howToBook: string;
        status: 'draft' | 'published' | 'cancelled';
        craftSkill: string;
        materialsProvided: string;
        skillLevel: string;
        instructorInfo: string;
      }>
    ): CommunityEvent {
      const event = this.getEvent(eventId);
      if (!event || event.organizerId !== authorId) {
        throw new CommunityError('Event not found or not owned by you.', 404);
      }

      const now = new Date().toISOString();
      const title = input.title !== undefined ? input.title.trim() : event.title;
      const description = input.description !== undefined ? input.description.trim() : event.description;
      const coverImage = input.coverImage !== undefined ? input.coverImage.trim() : event.coverImage;
      const location = input.location !== undefined ? input.location.trim() : event.location;
      const startsAt = input.startsAt !== undefined ? input.startsAt : event.startsAt;
      const durationMinutes = input.durationMinutes !== undefined ? Math.max(15, input.durationMinutes) : event.durationMinutes;
      const language = input.language !== undefined ? input.language.trim() : event.language;
      const capacity = input.capacity !== undefined ? Math.max(1, input.capacity) : event.capacity;
      const cost = input.cost !== undefined ? input.cost.trim() : event.cost;
      const howToBook = input.howToBook !== undefined ? input.howToBook.trim() : event.howToBook;
      const status = input.status !== undefined ? input.status : event.status;
      const craftSkill = input.craftSkill !== undefined ? input.craftSkill.trim() : event.craftSkill;
      const materialsProvided = input.materialsProvided !== undefined ? input.materialsProvided.trim() : event.materialsProvided;
      const skillLevel = input.skillLevel !== undefined ? input.skillLevel.trim() : event.skillLevel;
      const instructorInfo = input.instructorInfo !== undefined ? input.instructorInfo.trim() : event.instructorInfo;

      db.prepare(`
        UPDATE community_events SET
          title = ?, description = ?, cover_image = ?, location = ?, starts_at = ?,
          duration_minutes = ?, language = ?, capacity = ?, cost = ?, how_to_book = ?,
          status = ?, craft_skill = ?, materials_provided = ?, skill_level = ?,
          instructor_info = ?, updated_at = ?
        WHERE id = ?
      `).run(
        title,
        description,
        coverImage,
        location,
        startsAt,
        durationMinutes,
        language,
        capacity,
        cost,
        howToBook,
        status,
        craftSkill,
        materialsProvided,
        skillLevel,
        instructorInfo,
        now,
        event.id
      );

      return this.getEvent(event.id)!;
    },

    deleteEvent(authorId: string, eventId: string): void {
      const event = this.getEvent(eventId);
      if (!event || event.organizerId !== authorId) {
        throw new CommunityError('Event not found or not owned by you.', 404);
      }
      db.prepare('DELETE FROM community_events WHERE id = ?').run(eventId);
    },

    listEvents(filter?: {
      eventType?: string;
      organizerId?: string;
      includeDrafts?: boolean;
      onlyUpcoming?: boolean;
    }): CommunityEvent[] {
      let query = 'SELECT * FROM community_events WHERE 1=1';
      const params: (string | number)[] = [];

      if (!filter?.includeDrafts) {
        query += " AND status = 'published'";
      }
      if (filter?.eventType && filter.eventType !== 'all') {
        query += ' AND event_type = ?';
        params.push(filter.eventType);
      }
      if (filter?.organizerId) {
        query += ' AND organizer_id = ?';
        params.push(filter.organizerId);
      }
      if (filter?.onlyUpcoming) {
        query += " AND starts_at >= datetime('now')";
      }
      query += ' ORDER BY starts_at ASC';
      const rows = db.prepare(query).all(...params) as EventRow[];
      return rows.map(mapEvent);
    },

    // --- LOCAL FRIENDS ---
    getLocalFriendProfile(accountId: string): LocalFriendProfile | undefined {
      const row = db.prepare('SELECT * FROM local_friend_profiles WHERE account_id = ?').get(accountId) as FriendRow | undefined;
      return row ? mapFriend(row) : undefined;
    },

    upsertLocalFriendProfile(
      author: Member,
      input: {
        isEnabled: boolean;
        displayName?: string;
        introduction?: string;
        languages?: string[];
        expertise?: string[];
        availabilityNote?: string;
        contactPreference?: string;
      }
    ): LocalFriendProfile {
      if (author.role === 'visitor') {
        throw new CommunityError('Visitors cannot act as Local Friends. This feature is for Artisans and Event Managers.', 403);
      }

      const existing = this.getLocalFriendProfile(author.id);
      const now = new Date().toISOString();

      if (existing) {
        db.prepare(`
          UPDATE local_friend_profiles SET
            is_enabled = ?, display_name = ?, introduction = ?, languages = ?,
            expertise = ?, availability_note = ?, contact_preference = ?, updated_at = ?
          WHERE account_id = ?
        `).run(
          input.isEnabled ? 1 : 0,
          input.displayName?.trim() || existing.displayName,
          input.introduction?.trim() || existing.introduction,
          JSON.stringify(input.languages || existing.languages),
          JSON.stringify(input.expertise || existing.expertise),
          input.availabilityNote?.trim() || existing.availabilityNote,
          input.contactPreference?.trim() || existing.contactPreference,
          now,
          author.id
        );
      } else {
        const id = randomUUID();
        db.prepare(`
          INSERT INTO local_friend_profiles (
            id, account_id, role, is_enabled, display_name, introduction,
            languages, expertise, availability_note, contact_preference,
            verification_status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          author.id,
          author.role,
          input.isEnabled ? 1 : 0,
          input.displayName?.trim() || author.name,
          input.introduction?.trim() || '',
          JSON.stringify(input.languages || ['Hindi', 'English']),
          JSON.stringify(input.expertise || []),
          input.availabilityNote?.trim() || '',
          input.contactPreference?.trim() || '',
          'unverified',
          now
        );
      }

      return this.getLocalFriendProfile(author.id)!;
    },

    listPublicLocalFriends(roleFilter?: 'artisan' | 'event_manager'): LocalFriendProfile[] {
      let query = 'SELECT * FROM local_friend_profiles WHERE is_enabled = 1';
      const params: string[] = [];
      if (roleFilter) {
        query += ' AND role = ?';
        params.push(roleFilter);
      }
      query += ' ORDER BY updated_at DESC';
      const rows = db.prepare(query).all(...params) as FriendRow[];
      return rows.map(mapFriend);
    },

    createFriendRequest(
      friendAccountId: string,
      input: {
        senderAccountId?: string | null;
        senderName: string;
        senderContact: string;
        dates?: string;
        topics?: string;
        message: string;
      }
    ): LocalFriendRequest {
      const friend = this.getLocalFriendProfile(friendAccountId);
      if (!friend || !friend.isEnabled) {
        throw new CommunityError('This Local Friend is not currently available for requests.', 404);
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO local_friend_requests (
          id, friend_account_id, sender_account_id, sender_name, sender_contact,
          dates, topics, message, status, response_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        friendAccountId,
        input.senderAccountId || null,
        input.senderName.trim(),
        input.senderContact.trim(),
        input.dates?.trim() || '',
        input.topics?.trim() || '',
        input.message.trim(),
        'pending',
        '',
        now,
        now
      );

      const row = db.prepare('SELECT * FROM local_friend_requests WHERE id = ?').get(id) as RequestRow;
      return mapRequest(row);
    },

    listFriendRequests(friendAccountId: string): LocalFriendRequest[] {
      const rows = db
        .prepare('SELECT * FROM local_friend_requests WHERE friend_account_id = ? ORDER BY created_at DESC')
        .all(friendAccountId) as RequestRow[];
      return rows.map(mapRequest);
    },

    updateFriendRequestStatus(
      friendAccountId: string,
      requestId: string,
      status: 'accepted' | 'declined',
      responseNote?: string
    ): LocalFriendRequest {
      const row = db.prepare('SELECT * FROM local_friend_requests WHERE id = ? AND friend_account_id = ?').get(requestId, friendAccountId) as RequestRow | undefined;
      if (!row) throw new CommunityError('Request not found or not owned by you.', 404);

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE local_friend_requests SET
          status = ?, response_note = ?, updated_at = ?
        WHERE id = ?
      `).run(status, responseNote?.trim() || '', now, requestId);

      const updated = db.prepare('SELECT * FROM local_friend_requests WHERE id = ?').get(requestId) as RequestRow;
      return mapRequest(updated);
    },

    // --- TWO-WAY REVIEWS ---
    createReview(
      author: Member,
      input: {
        targetType: 'shop' | 'event' | 'visitor';
        targetId: string;
        rating: number;
        title: string;
        feedback: string;
        interactionRef?: string;
      }
    ): TwoWayReview {
      const rating = Math.min(5, Math.max(1, Math.round(input.rating)));

      // Self-review checks
      if (input.targetType === 'shop') {
        const shop = this.getShopById(input.targetId) || this.getShopBySlug(input.targetId);
        if (!shop) throw new CommunityError('Shop not found.', 404);
        if (shop.ownerAccountId === author.id) {
          throw new CommunityError('Artisans cannot review their own shop.', 400);
        }
      } else if (input.targetType === 'event') {
        const event = this.getEvent(input.targetId);
        if (!event) throw new CommunityError('Event not found.', 404);
        if (event.organizerId === author.id) {
          throw new CommunityError('Organizers cannot review their own events.', 400);
        }
      } else if (input.targetType === 'visitor') {
        if (author.role === 'visitor') {
          throw new CommunityError('Visitors cannot write customer reviews.', 403);
        }
        if (input.targetId === author.id) {
          throw new CommunityError('You cannot review yourself.', 400);
        }
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO two_way_reviews (
          id, target_type, target_id, author_id, author_name, author_role,
          rating, title, feedback, interaction_ref, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.targetType,
        input.targetId,
        author.id,
        author.name,
        author.role,
        rating,
        input.title.trim(),
        input.feedback.trim(),
        input.interactionRef?.trim() || '',
        'published',
        now
      );

      const row = db.prepare('SELECT * FROM two_way_reviews WHERE id = ?').get(id) as ReviewRow;
      return mapReview(row);
    },

    listReviewsForTarget(targetType: 'shop' | 'event' | 'visitor', targetId: string): TwoWayReview[] {
      const rows = db
        .prepare("SELECT * FROM two_way_reviews WHERE target_type = ? AND target_id = ? AND status = 'published' ORDER BY created_at DESC")
        .all(targetType, targetId) as ReviewRow[];
      return rows.map(mapReview);
    },

    reportReview(reviewId: string): void {
      db.prepare("UPDATE two_way_reviews SET status = 'reported' WHERE id = ?").run(reviewId);
    },

    // --- EVENT ENQUIRIES ---
    createEventEnquiry(input: {
      eventId: string;
      name: string;
      contactBack: string;
      tickets?: number;
      message: string;
    }): EventEnquiry {
      const event = this.getEvent(input.eventId);
      if (!event) throw new CommunityError('Event not found.', 404);

      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO event_enquiries (
          id, event_id, organizer_id, name, contact_back, tickets, message, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        event.id,
        event.organizerId,
        input.name.trim(),
        input.contactBack.trim(),
        Math.max(1, input.tickets || 1),
        input.message.trim(),
        'new',
        now
      );

      const row = db.prepare('SELECT * FROM event_enquiries WHERE id = ?').get(id) as EnquiryRow;
      return mapEnquiry(row);
    },

    listEventEnquiries(organizerId: string): EventEnquiry[] {
      const rows = db
        .prepare('SELECT * FROM event_enquiries WHERE organizer_id = ? ORDER BY created_at DESC')
        .all(organizerId) as EnquiryRow[];
      return rows.map(mapEnquiry);
    },

    updateEventEnquiryStatus(organizerId: string, enquiryId: string, status: 'replied' | 'archived'): EventEnquiry {
      const row = db.prepare('SELECT * FROM event_enquiries WHERE id = ? AND organizer_id = ?').get(enquiryId, organizerId) as EnquiryRow | undefined;
      if (!row) throw new CommunityError('Enquiry not found.', 404);

      db.prepare('UPDATE event_enquiries SET status = ? WHERE id = ?').run(status, enquiryId);
      const updated = db.prepare('SELECT * FROM event_enquiries WHERE id = ?').get(enquiryId) as EnquiryRow;
      return mapEnquiry(updated);
    },
  };
}

export type Marketplace = ReturnType<typeof createMarketplace>;
let marketplaceInstance: Marketplace | undefined;
export const getMarketplace = () => (marketplaceInstance ??= createMarketplace(openDb(getConfig().dataDir)));
