import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import { apiError, bodyJson, json, requireMember, sameOrigin } from '@/lib/community/http';

export const runtime = 'nodejs';

const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  description: z.string().trim().min(10).max(2500).optional(),
  coverImage: z.string().trim().optional(),
  location: z.string().trim().min(2).max(200).optional(),
  startsAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  language: z.string().trim().max(100).optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
  cost: z.string().trim().max(100).optional(),
  howToBook: z.string().trim().max(500).optional(),
  status: z.enum(['draft', 'published', 'cancelled']).optional(),
  craftSkill: z.string().trim().max(200).optional(),
  materialsProvided: z.string().trim().max(500).optional(),
  skillLevel: z.string().trim().max(100).optional(),
  instructorInfo: z.string().trim().max(200).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const marketplace = getMarketplace();
    const event = marketplace.getEvent(id);
    if (!event) return json({ ok: false, error: 'Event not found.' }, 404);
    return json({ ok: true, event });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(req);
    const { id } = await params;
    const user = await requireMember();
    const data = updateEventSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const event = marketplace.updateEvent(user.id, id, data);
    return json({ ok: true, event });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(req);
    const { id } = await params;
    const user = await requireMember();
    const marketplace = getMarketplace();
    marketplace.deleteEvent(user.id, id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
