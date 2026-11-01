import { z } from "zod";
import { apiError, bodyJson, json, requireMember, sameOrigin } from "@/lib/community/http";
import { CommunityError, getCommunity } from "@/lib/community/store";
import { EMOJI, getArStories } from "@/lib/ar-stories/store";

export const runtime = "nodejs";

const schema = z.union([z.object({ emoji: z.enum(EMOJI as [string, ...string[]]) }), z.object({ text: z.string().trim().min(1).max(300) })]);

/** A quick emoji reaction, or a short reply, to a member's story. Only the story's author can read them. */
export async function POST(req: Request, ctx: RouteContext<"/api/ar-stories/[id]/react">) {
  try {
    sameOrigin(req);
    const member = await requireMember();
    const { id } = await ctx.params;
    if (id.startsWith("m-")) throw new CommunityError("This is a sample story, so it can’t take replies.", 400);
    getCommunity().limit(`ar-react:${member.id}`, 60, 3_600_000);
    const data = schema.parse(await bodyJson(req));
    const reaction = getArStories().addReaction(id, member.id, data);
    if (!reaction) throw new CommunityError("That story is no longer available.", 404);
    return json({ reaction }, 201);
  } catch (error) {
    return apiError(error);
  }
}
