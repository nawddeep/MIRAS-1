import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import { apiError, bodyJson, json, requireArtisan, sameOrigin } from '@/lib/community/http';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(60),
  priceInr: z.number().min(0).max(10_000_000),
  images: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'made_to_order']).optional(),
  customOrderSupported: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'out_of_stock', 'archived']).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  priceInr: z.number().min(0).max(10_000_000).optional(),
  images: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'made_to_order']).optional(),
  customOrderSupported: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'out_of_stock', 'archived']).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireArtisan();
    const marketplace = getMarketplace();
    const shop = marketplace.getShopByOwner(user.id);
    if (!shop) {
      return json({ ok: true, products: [] });
    }
    const products = marketplace.listProductsByShop(shop.id, true);
    return json({ ok: true, products });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireArtisan();
    const data = createSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const product = marketplace.createProduct(user.id, data);
    return json({ ok: true, product }, 201);
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
    const product = marketplace.updateProduct(user.id, data.id, data);
    return json({ ok: true, product });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireArtisan();
    const data = deleteSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    marketplace.deleteProduct(user.id, data.id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
