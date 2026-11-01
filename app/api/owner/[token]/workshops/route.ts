import { z } from "zod";
import { readJson } from "@/lib/http";
import { getRepos } from "@/lib/repos";
import { PublishGateError } from "@/lib/services/publishing";
import { confirmAndPublishWorkshop, saveWorkshopDraft, unpublishWorkshop, WorkshopEdit } from "@/lib/services/workshops";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.string().optional(), fields: WorkshopEdit }),
  z.object({ action: z.literal("publish"), id: z.string(), confirmed: z.literal(true) }),
  z.object({ action: z.literal("unpublish"), id: z.string() }),
]);

/** Owner workshop actions, authorised by the artisan's private edit token. */
export async function POST(req: Request, ctx: RouteContext<"/api/owner/[token]/workshops">) {
  const { token } = await ctx.params;
  const repos = getRepos();
  const artisan = repos.artisans.getByEditToken(token);
  if (!artisan) return Response.json({ ok: false, error: "This edit link is not valid." }, { status: 404 });

  const body = Body.safeParse(await readJson(req));
  if (!body.success) return Response.json({ ok: false, error: "Please check the form. Publishing needs the confirmation box ticked." }, { status: 400 });
  const b = body.data;

  const existing = b.id ? repos.workshops.get(b.id) : undefined;
  if (b.id && (!existing || existing.artisanId !== artisan.id)) return Response.json({ ok: false, error: "Workshop not found." }, { status: 404 });

  try {
    const w =
      b.action === "save"
        ? saveWorkshopDraft(artisan.id, existing, b.fields)
        : b.action === "publish"
          ? confirmAndPublishWorkshop(existing!)
          : unpublishWorkshop(existing!);
    return Response.json({ ok: true, id: w.id, status: w.status });
  } catch (e) {
    if (e instanceof PublishGateError) return Response.json({ ok: false, error: e.message, missing: e.missing }, { status: 409 });
    throw e;
  }
}
