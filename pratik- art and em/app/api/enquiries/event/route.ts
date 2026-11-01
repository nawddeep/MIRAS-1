import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import {
  apiError,
  bodyJson,
  json,
  requireRole,
  sameOrigin,
} from '@/lib/community/http';

export const runtime = 'nodejs';

const createSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  contactBack: z.string().trim().min(3).max(120),
  tickets: z.number().int().min(1).max(100).optional(),
  message: z.string().trim().min(5).max(1000),
});

const updateSchema = z.object({
  enquiryId: z.string().min(1),
  status: z.enum(['replied', 'archived']),
});

export async function GET() {
  try {
    const user = await requireRole(['artisan', 'event_manager']);
    const marketplace = getMarketplace();
    const enquiries = marketplace.listEventEnquiries(user.id);
    return json({ ok: true, enquiries });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const data = createSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const enquiry = marketplace.createEventEnquiry(data);
    return json({ ok: true, enquiry }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireRole(['artisan', 'event_manager']);
    const data = updateSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const enquiry = marketplace.updateEventEnquiryStatus(user.id, data.enquiryId, data.status);
    return json({ ok: true, enquiry });
  } catch (error) {
    return apiError(error);
  }
}
