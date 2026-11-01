import { clientKey } from "@/lib/http";
import { limits, tooMany } from "@/lib/rate-limit";
import { createListing, ListingSubmission, MAX_IMAGE_BYTES } from "@/lib/services/onboarding";
import { getStorage } from "@/lib/storage";

export async function POST(req: Request) {
  if (!limits.onboardSubmit.allow(clientKey(req))) return tooMany();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Upload was incomplete. Please try again." }, { status: 400 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return Response.json({ ok: false, error: "Please check the form." }, { status: 400 });
  }
  const sub = ListingSubmission.safeParse(raw);
  if (!sub.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of sub.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return Response.json({ ok: false, error: "Please check the form.", fieldErrors }, { status: 400 });
  }

  const photo = form.get("photo");
  if (photo instanceof File && photo.size > MAX_IMAGE_BYTES) return Response.json({ ok: false, error: "Photo is too large." }, { status: 413 });

  try {
    const { artisan, publishBlockers } = createListing(
      sub.data,
      photo instanceof File && photo.size > 0 ? { data: Buffer.from(await photo.arrayBuffer()), mime: photo.type } : undefined,
      getStorage(),
    );
    return Response.json({ ok: true, id: artisan.id, status: artisan.status, editUrl: `/owner/${artisan.editToken}`, publishBlockers });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
