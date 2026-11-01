import fs from "node:fs/promises";
import path from "node:path";
import { apiError, json, requireMember, sameOrigin } from "@/lib/community/http";
import { CommunityError } from "@/lib/community/store";
import { getArStories, uploadDir } from "@/lib/ar-stories/store";

export const runtime = "nodejs";

/** Delete your own story. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/ar-stories/[id]">) {
  try {
    sameOrigin(req);
    const member = await requireMember();
    const { id } = await ctx.params;
    const file = getArStories().remove(id, member.id);
    if (!file) throw new CommunityError("That story was not found, or it isn’t yours to delete.", 404);
    await fs.unlink(path.join(uploadDir(), path.basename(file))).catch(() => {});
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
