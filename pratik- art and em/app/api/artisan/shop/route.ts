import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import { apiError, bodyJson, json, requireArtisan, sameOrigin } from '@/lib/community/http';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  craft: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().min(10).max(1000).optional(),
  story: z.string().trim().max(2000).optional(),
  locality: z.string().trim().max(100).optional(),
  openingHours: z.string().trim().max(100).optional(),
  languages: z.array(z.string()).optional(),
  contactMethod: z.string().trim().max(100).optional(),
  coverImage: z.string().trim().optional(),
  profileImage: z.string().trim().optional(),
  status: z.enum(['draft', 'published']).optional(),
});

export async function GET() {
  try {
    const user = await requireArtisan();
    const marketplace = getMarketplace();
    const shop = marketplace.getShopByOwner(user.id);
    return json({ ok: true, shop: shop || null });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireArtisan();
    const data = updateSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const shop = marketplace.updateShop(user.id, data);
    return json({ ok: true, shop });
  } catch (error) {
    return apiError(error);
  }
}
