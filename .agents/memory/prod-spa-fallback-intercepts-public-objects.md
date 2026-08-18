---
name: prod.ts early SPA fallback intercepts /public-objects/
description: The early SPA fallback in prod.ts must exclude /public-objects/ or image URLs return HTML in production.
---

## Rule

The early SPA fallback in `server/prod.ts` (registered before `registerRoutes`) must exclude **both** `/api` and `/public-objects/` paths or image requests receive `index.html` instead of the actual file.

```js
// CORRECT — both exclusions required
if (
  req.method === "GET" &&
  !req.path.startsWith("/api") &&
  !req.path.startsWith("/public-objects/")
) {
  return res.sendFile(indexPath);
}
```

**Why:** `registerRoutes` (which mounts `app.get("/public-objects/*", ...)`) runs at line ~1193 in prod.ts, well after the early static+SPA block at lines 126–157. Express evaluates `app.use` middleware in registration order, so the wildcard fallback fires first for any GET that isn't `/api`. Dev (`server/index.ts`) is immune because routes register before any SPA fallback there.

**Symptom:** In production, `<img src="/public-objects/...">` tags show the image placeholder (because `imageUrl` is truthy) but no image renders — the browser receives HTML and can't display it as JPEG.

**How to apply:** Any time a new route is registered through `registerRoutes` that serves non-API GET responses (images, PDFs, downloads), add a corresponding exclusion here to prevent the early SPA fallback from swallowing it.
