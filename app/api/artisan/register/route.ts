import { z } from 'zod';
import { getCommunity } from '@/lib/community/store';
import { getMarketplace } from '@/lib/marketplace/store';
import {
  apiError,
  bodyJson,
  currentMember,
  json,
  requestKey,
  sameOrigin,
  setSession,
} from '@/lib/community/http';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/).optional(),
  name: z.string().trim().min(2).max(60).optional(),
  password: z.string().min(12).max(128).optional(),
  shopName: z.string().trim().min(2).max(100),
  craft: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(1000),
  story: z.string().trim().max(2000).optional(),
  locality: z.string().trim().max(100).optional(),
  openingHours: z.string().trim().max(100).optional(),
  languages: z.array(z.string()).optional(),
  contactMethod: z.string().trim().max(100).optional(),
  coverImage: z.string().trim().optional(),
  profileImage: z.string().trim().optional(),
  ownershipConfirmed: z.boolean().refine((val) => val === true, 'You must confirm authority to operate this shop listing.'),
  guidelinesAccepted: z.boolean().refine((val) => val === true, 'You must accept the MIRAS marketplace guidelines.'),
});

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const data = schema.parse(await bodyJson(req));
    const community = getCommunity();
    const marketplace = getMarketplace();

    let user = await currentMember();
    let recoveryCode: string | undefined;

    if (!user) {
      if (!data.username || !data.name || !data.password) {
        return json({ ok: false, error: 'Username, name, and password are required for registration.' }, 400);
      }
      community.limit(`register:${requestKey(req)}`, 8, 3_600_000);
      const reg = await community.register(data.username, data.name, data.password, 'artisan');
      user = reg.user;
      recoveryCode = reg.recoveryCode;
      await setSession(reg.token);
    } else {
      // Existing user upgrading to artisan role
      user = community.setRole(user.id, 'artisan');
    }

    const shop = marketplace.createShop(user.id, {
      name: data.shopName,
      craft: data.craft,
      description: data.description,
      story: data.story,
      locality: data.locality,
      openingHours: data.openingHours,
      languages: data.languages,
      contactMethod: data.contactMethod,
      coverImage: data.coverImage,
      profileImage: data.profileImage,
      status: 'published',
    });

    return json({ ok: true, user, shop, recoveryCode }, 201);
  } catch (error) {
    return apiError(error);
  }
}
