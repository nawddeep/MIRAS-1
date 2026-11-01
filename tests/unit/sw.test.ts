import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "http://miras.test";
const CURRENT = "miras-shell-v4";

/** Loads public/sw.js in a sandbox with fake caches and network, and returns its event handlers. */
function loadWorker(network: (url: string) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const keyOf = (req: string | { url: string }) => (typeof req === "string" ? req : new URL(req.url).pathname);
  const handlers: Record<string, (e: unknown) => void> = {};
  const caches = {
    open: async (name: string) => ({
      put: async (req: string | { url: string }, res: Response) => void store(name).set(keyOf(req), res),
      add: async (url: string) => void store(name).set(url, await network(url)),
    }),
    match: async (req: string | { url: string }) => {
      for (const s of stores.values()) if (s.has(keyOf(req))) return s.get(keyOf(req))!.clone();
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const fetch = vi.fn((input: string | { url: string }) => network(keyOf(input)));
  vm.runInNewContext(fs.readFileSync(path.resolve("public/sw.js"), "utf8"), { self, caches, fetch, URL, Response, Set, Promise });

  const fire = async (type: string, extra: object = {}) => {
    let responded: Promise<Response | undefined> | undefined;
    let waited: Promise<unknown> | undefined;
    handlers[type]({ ...extra, respondWith: (p: Promise<Response>) => (responded = p), waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
    return responded ? await responded : undefined;
  };
  const request = (p: string, mode = "cors", method = "GET") => ({ url: ORIGIN + p, mode, method });
  return { stores, store, fetch, fire, request };
}

const html = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });

describe("service worker", () => {
  it("uses a versioned cache and pre-caches only /offline and its static assets", async () => {
    const w = loadWorker(async (url) => (url === "/offline" ? html('<script src="/_next/static/chunks/a.js"></script>') : new Response("js")));
    await w.fire("install");
    expect([...w.stores.keys()]).toEqual([CURRENT]);
    expect([...w.store(CURRENT).keys()].sort()).toEqual(["/_next/static/chunks/a.js", "/offline"]);
  });

  it("never answers /api/* from the cache, even if a copy exists", async () => {
    const w = loadWorker(async () => new Response("fresh"));
    w.store(CURRENT).set("/api/places", new Response("STALE"));
    const res = await w.fire("fetch", { request: w.request("/api/places") });
    expect(res).toBeUndefined(); // not intercepted: the browser goes to the network
  });

  it("navigations go to the network and are not cached", async () => {
    const w = loadWorker(async () => html("live page"));
    const res = await w.fire("fetch", { request: w.request("/places/pichhola", "navigate") });
    expect(await res!.text()).toBe("live page");
    expect(w.store(CURRENT).has("/places/pichhola")).toBe(false);
  });

  it("falls back to the saved /offline page only when the network fails", async () => {
    let online = true;
    const w = loadWorker(async (url) => {
      if (!online) throw new TypeError("offline");
      return url === "/offline" ? html("offline copy") : html("live");
    });
    await w.fire("install");
    online = false;
    const res = await w.fire("fetch", { request: w.request("/places/pichhola", "navigate") });
    expect(await res!.text()).toBe("offline copy");
  });

  it("serves static assets cache-first and stores them on first use", async () => {
    const w = loadWorker(async () => new Response("chunk"));
    const res = await w.fire("fetch", { request: w.request("/_next/static/chunks/b.js") });
    expect(await res!.text()).toBe("chunk");
    await new Promise((r) => setTimeout(r, 0));
    expect(w.store(CURRENT).has("/_next/static/chunks/b.js")).toBe(true);
  });

  it("keeps supplied background assets available after first use", async () => {
    let online = true;
    const w = loadWorker(async () => { if (!online) throw new TypeError("offline"); return new Response("image bytes"); });
    const request = w.request("/media/pichhola/dawn.webp");
    await w.fire("fetch", { request });
    await new Promise((r) => setTimeout(r, 0));
    online = false;
    expect(await (await w.fire("fetch", { request }))!.text()).toBe("image bytes");
  });

  it("does not intercept POSTs or other files", async () => {
    const w = loadWorker(async () => new Response("x"));
    expect(await w.fire("fetch", { request: w.request("/api/enquiries", "cors", "POST") })).toBeUndefined();
    expect(await w.fire("fetch", { request: w.request("/media/placeholders/a.svg") })).toBeUndefined();
  });

  it("deletes old cache versions on activate", async () => {
    const w = loadWorker(async () => html(""));
    w.store("miras-shell-v0");
    await w.fire("install");
    await w.fire("activate");
    expect([...w.stores.keys()]).toEqual([CURRENT]);
  });
});
