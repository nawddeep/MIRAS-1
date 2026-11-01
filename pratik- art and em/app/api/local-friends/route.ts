import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import {
  apiError,
  bodyJson,
  currentMember,
  json,
  requireRole,
  sameOrigin,
} from '@/lib/community/http';

export const runtime = 'nodejs';

const profileUpdateSchema = z.object({
  action: z.literal('toggle'),
  isEnabled: z.boolean(),
  displayName: z.string().trim().min(2).max(60).optional(),
  introduction: z.string().trim().max(1000).optional(),
  languages: z.array(z.string()).optional(),
  expertise: z.array(z.string()).optional(),
  availabilityNote: z.string().trim().max(300).optional(),
  contactPreference: z.string().trim().max(120).optional(),
});

const respondSchema = z.object({
  action: z.literal('respond'),
  requestId: z.string().min(1),
  status: z.enum(['accepted', 'declined']),
  responseNote: z.string().trim().max(500).optional(),
});

const requestSchema = z.object({
  friendAccountId: z.string().min(1),
  senderName: z.string().trim().min(2).max(60),
  senderContact: z.string().trim().min(3).max(120),
  dates: z.string().trim().max(120).optional(),
  topics: z.string().trim().max(200).optional(),
  message: z.string().trim().min(5).max(1000),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');
    const marketplace = getMarketplace();

    if (view === 'profile') {
      const user = await requireRole(['artisan', 'event_manager']);
      const profile = marketplace.getLocalFriendProfile(user.id);
      return json({ ok: true, profile: profile || null });
    }

    if (view === 'requests') {
      const user = await requireRole(['artisan', 'event_manager']);
      const requests = marketplace.listFriendRequests(user.id);
      return json({ ok: true, requests });
    }

    const role = (searchParams.get('role') as 'artisan' | 'event_manager') || undefined;
    const friends = marketplace.listPublicLocalFriends(role);
    return json({ ok: true, friends });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const data = requestSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const user = await currentMember();
    const request = marketplace.createFriendRequest(data.friendAccountId, {
      ...data,
      senderAccountId: user?.id,
    });
    return json({ ok: true, request }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireRole(['artisan', 'event_manager']);
    const raw = await bodyJson(req);
    const marketplace = getMarketplace();

    if (raw.action === 'toggle') {
      const data = profileUpdateSchema.parse(raw);
      const profile = marketplace.upsertLocalFriendProfile(user, data);
      return json({ ok: true, profile });
    }

    if (raw.action === 'respond') {
      const data = respondSchema.parse(raw);
      const request = marketplace.updateFriendRequestStatus(
        user.id,
        data.requestId,
        data.status,
        data.responseNote
      );
      return json({ ok: true, request });
    }

    return json({ ok: false, error: 'Invalid action.' }, 400);
  } catch (error) {
    return apiError(error);
  }
}
