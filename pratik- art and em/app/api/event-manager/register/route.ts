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
  organizationName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  contactInfo: z.string().trim().min(3).max(120),
  locality: z.string().trim().max(100).optional(),
  languages: z.array(z.string()).optional(),
  logoImage: z.string().trim().optional(),
  guidelinesAccepted: z.boolean().refine((val) => val === true, 'You must accept the MIRAS event organizer guidelines.'),
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
      const reg = await community.register(data.username, data.name, data.password, 'event_manager');
      user = reg.user;
      recoveryCode = reg.recoveryCode;
      await setSession(reg.token);
    } else {
      user = community.setRole(user.id, 'event_manager');
    }

    const profile = marketplace.upsertOrganizerProfile(user.id, {
      organizationName: data.organizationName,
      description: data.description,
      contactInfo: data.contactInfo,
      locality: data.locality,
      languages: data.languages,
      logoImage: data.logoImage,
    });

    return json({ ok: true, user, profile, recoveryCode }, 201);
  } catch (error) {
    return apiError(error);
  }
}
