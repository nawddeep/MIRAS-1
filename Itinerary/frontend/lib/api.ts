// All calls go to /api on this origin; Next.js proxies them to the FastAPI backend.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join("; ");
  } catch {
    if (res.status >= 500) message = "The trip service is not reachable right now. Is the backend running?";
  }
  throw new ApiError(res.status, message);
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined | null>, signal?: AbortSignal): Promise<T> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const url = q.size ? `${path}?${q}` : path;
  return handle<T>(await fetch(url, { signal, headers: { Accept: "application/json" } }));
}

export async function apiSend<T>(method: "POST" | "PUT", path: string, body: unknown, headers?: Record<string, string>, signal?: AbortSignal): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method,
      signal,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

export function photoUrl(ref: string, w = 800): string {
  return `/api/places/photo?ref=${encodeURIComponent(ref)}&w=${w}`;
}
