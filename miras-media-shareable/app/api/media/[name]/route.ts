import { getStorage } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves owner-uploaded images from local storage. Only generated upload names are accepted. */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[name]">) {
  const { name } = await ctx.params;
  const data = getStorage().read(name);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "content-type": TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream", "cache-control": "public, max-age=86400" },
  });
}
