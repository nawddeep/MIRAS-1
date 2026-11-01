import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import { apiError, bodyJson, json, requireEventManager, sameOrigin } from '@/lib/community/http';

export const runtime = 'nodejs';

const updateSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  contactInfo: z.string().trim().min(3).max(120),
  locality: z.string().trim().max(100).optional(),
  languages: z.array(z.string()).optional(),
  logoImage: z.string().trim().optional(),
});

export async function GET() {
  try {
    const user = await requireEventManager();
    const marketplace = getMarketplace();
    const profile = marketplace.getOrganizerProfile(user.id);
    return json({ ok: true, profile: profile || null });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireEventManager();
    const data = updateSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const profile = marketplace.upsertOrganizerProfile(user.id, data);
    return json({ ok: true, profile });
  } catch (error) {
    return apiError(error);
  }
}
