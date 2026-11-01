import { apiError, currentMember, json, sameOrigin } from "@/lib/community/http";
import { getArStories } from "@/lib/ar-stories/store";

export const runtime = "nodejs";

/** Counts a view from a signed-in member (never the author). Signed-out visitors and sample stories are not recorded. */
export async function POST(req: Request, ctx: RouteContext<"/api/ar-stories/[id]/view">) {
  try {
    sameOrigin(req);
    const member = await currentMember();
    const { id } = await ctx.params;
    if (member) getArStories().recordView(id, member.id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
