import { clientKey, readJson } from "@/lib/http";
import { submitEnquiry } from "@/lib/services/enquiries";

export async function POST(req: Request) {
  const result = submitEnquiry(await readJson(req), clientKey(req));
  if (!result.ok) return Response.json(result, { status: result.status });
  return Response.json({ ok: true, id: result.enquiry.id }, { status: 201 });
}
