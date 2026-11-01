import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import {
  apiError,
  bodyJson,
  currentMember,
  json,
  requireMember,
  sameOrigin,
} from '@/lib/community/http';

export const runtime = 'nodejs';

const eventTypeEnum = z.enum([
  'workshop',
  'heritage_walk',
  'cultural_performance',
  'exhibition',
  'festival',
  'guided_experience',
  'community_event',
  'other',
]);

const createEventSchema = z.object({
  eventType: eventTypeEnum,
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(2500),
  coverImage: z.string().trim().optional(),
  location: z.string().trim().min(2).max(200),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  language: z.string().trim().max(100).optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
  cost: z.string().trim().max(100).optional(),
  howToBook: z.string().trim().max(500).optional(),
  status: z.enum(['draft', 'published']).optional(),
  // Workshop specific fields:
  craftSkill: z.string().trim().max(200).optional(),
  materialsProvided: z.string().trim().max(500).optional(),
  skillLevel: z.string().trim().max(100).optional(),
  instructorInfo: z.string().trim().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('type') || undefined;
    const organizerId = searchParams.get('organizerId') || undefined;
    const includeDrafts = searchParams.get('drafts') === 'true';
    const onlyUpcoming = searchParams.get('upcoming') !== 'false';

    const marketplace = getMarketplace();
    const user = await currentMember();

    // Only owners can see their own drafts
    const canIncludeDrafts = Boolean(includeDrafts && organizerId && user?.id === organizerId);

    const events = marketplace.listEvents({
      eventType,
      organizerId,
      includeDrafts: canIncludeDrafts,
      onlyUpcoming,
    });

    return json({ ok: true, events });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireMember();
    const data = createEventSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const event = marketplace.createEvent(user, data);
    return json({ ok: true, event }, 201);
  } catch (error) {
    return apiError(error);
  }
}
