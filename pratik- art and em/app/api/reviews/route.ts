import { z } from 'zod';
import { getMarketplace } from '@/lib/marketplace/store';
import {
  apiError,
  bodyJson,
  json,
  requireMember,
  sameOrigin,
} from '@/lib/community/http';

export const runtime = 'nodejs';

const reviewSchema = z.object({
  targetType: z.enum(['shop', 'event', 'visitor']),
  targetId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(100),
  feedback: z.string().trim().min(5).max(1000),
  interactionRef: z.string().trim().max(100).optional(),
});

const reportSchema = z.object({
  reviewId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get('targetType') as 'shop' | 'event' | 'visitor' | null;
    const targetId = searchParams.get('targetId');

    if (!targetType || !targetId) {
      return json({ ok: false, error: 'targetType and targetId are required.' }, 400);
    }

    const marketplace = getMarketplace();
    const reviews = marketplace.listReviewsForTarget(targetType, targetId);
    return json({ ok: true, reviews });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireMember();
    const data = reviewSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    const review = marketplace.createReview(user, data);
    return json({ ok: true, review }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    await requireMember();
    const data = reportSchema.parse(await bodyJson(req));
    const marketplace = getMarketplace();
    marketplace.reportReview(data.reviewId);
    return json({ ok: true, message: 'Review reported for moderation.' });
  } catch (error) {
    return apiError(error);
  }
}
