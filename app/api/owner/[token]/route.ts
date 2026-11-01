import { z } from "zod";
import { readJson } from "@/lib/http";
import { getRepos } from "@/lib/repos";
import { applyOwnerEdit, OwnerEdit, recordInAppConsent } from "@/lib/services/artisans";
import { PublishGateError, publishArtisanAsOwner, unpublishArtisan } from "@/lib/services/publishing";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), fields: OwnerEdit }),
  z.object({ action: z.literal("consent"), agreed: z.literal(true) }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
]);

/** Owner actions, authorised only by the private edit token in the URL. */
export async function POST(req: Request, ctx: RouteContext<"/api/owner/[token]">) {
  const { token } = await ctx.params;
  const artisan = getRepos().artisans.getByEditToken(token);
  if (!artisan) return Response.json({ ok: false, error: "This edit link is not valid." }, { status: 404 });

  const body = Body.safeParse(await readJson(req));
  if (!body.success) return Response.json({ ok: false, error: "Please check the form." }, { status: 400 });

  try {
    const b = body.data;
    const next =
      b.action === "save"
        ? applyOwnerEdit(artisan, b.fields)
        : b.action === "consent"
          ? recordInAppConsent(artisan)
          : b.action === "publish"
            ? publishArtisanAsOwner(artisan)
            : unpublishArtisan(artisan);
    return Response.json({ ok: true, status: next.status });
  } catch (e) {
    if (e instanceof PublishGateError) return Response.json({ ok: false, error: e.message, missing: e.missing }, { status: 409 });
    throw e;
  }
}
