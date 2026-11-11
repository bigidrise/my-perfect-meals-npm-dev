import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync("client/public/sw.js", "utf8");

function worker(script = source) {
  const handlers: Record<string, (event: any) => void> = {};
  const cachedAccountA = { status: 200, json: async () => ({ userId: "account-a", calories: 1900 }) };
  const caches = {
    match: jest.fn(async () => cachedAccountA),
    open: jest.fn(),
    keys: jest.fn(async () => ["mpm-cache-v6", "mpm-cache-v7"]),
    delete: jest.fn(async () => true),
  };
  const fetch = jest.fn(async () => { throw new Error("offline"); });
  const self = { addEventListener: (name: string, handler: any) => { handlers[name] = handler; }, clients: { claim: jest.fn() } };
  runInNewContext(script, { self, caches, fetch, URL, console: { log: jest.fn() } });
  function request(path: string) {
    let response: Promise<any> | undefined;
    handlers.fetch({
      request: { method: "GET", url: `https://app.example.invalid${path}` },
      respondWith: (promise: Promise<any>) => { response = promise; },
    });
    return response;
  }
  return { request, caches, fetch, handlers, cachedAccountA };
}

test("reproduces the former cross-account offline API fallback", async () => {
  // The v6 fetch handler, kept as a regression fixture rather than contacting
  // any customer endpoint or requiring Git history to be available in CI.
  const legacy = worker(`
    self.addEventListener('fetch', event => {
      if (event.request.method !== 'GET') return;
      event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    });
  `);
  const result = await legacy.request("/api/nutrition-summary/baseline");
  expect(result).toBe(legacy.cachedAccountA);
});

test.each([
  "/api", "/api/user/profile", "/api/auth/session",
  "/api/nutrition-summary/baseline", "/api/nutrition-summary/dynamic",
  "/api/user/reminders", "/api/user/profile?account=b",
])("does not intercept, cache, or fall back for %s", path => {
  const sw = worker();
  expect(sw.request(path)).toBeUndefined(); // browser's actual network path
  expect(sw.caches.match).not.toHaveBeenCalled();
  expect(sw.caches.open).not.toHaveBeenCalled();
  expect(sw.fetch).not.toHaveBeenCalled();
});

test("still permits static offline image fallback", async () => {
  const sw = worker();
  expect(await sw.request("/images/dashboard-chef-community-hero-768.webp")).toBe(sw.cachedAccountA);
  expect(sw.caches.match).toHaveBeenCalledTimes(1);
});

test("activation retires caches containing former API responses", async () => {
  const sw = worker();
  let completion: Promise<unknown> | undefined;
  sw.handlers.activate({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
  await completion;
  expect(sw.caches.delete).toHaveBeenCalledWith("mpm-cache-v6");
  expect(sw.caches.delete).not.toHaveBeenCalledWith("mpm-cache-v7");
});
