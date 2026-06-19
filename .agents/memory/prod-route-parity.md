---
name: prod.ts route parity gap
description: Routes mounted in routes.ts (dev) are not automatically in prod.ts — must be added explicitly or they 404 in production only.
---

## The rule

Any route file added to `server/routes.ts` must also be explicitly mounted in `server/prod.ts`. The two files are independent — prod never calls `registerRoutes()` until late in startup, and some routes mounted early in dev via `registerRoutes` are never reached in prod if `prod.ts` doesn't mount them first.

**Why:** `server/prod.ts` has its own route registration sequence that mounts critical routes *before* calling `registerRoutes()`. Routes that need to be available without the full registerRoutes chain must appear explicitly in prod.ts.

**How to apply:** After adding any new route file, grep prod.ts for the route path. If missing, add an explicit mount after the check-in-schedules block (line ~456), matching this pattern:

```ts
const { myRouter } = await import("./routes/myRouteFile");
app.use("/api/my-path", myRouter);
```

## Known gaps caught so far

- `shoppingListV2` — `DELETE /api/shopping-list-v2/` returned 404 in production for an extended period. Fixed by adding explicit mount in prod.ts.
- `checkInSchedules` — previously had the same gap; fixed earlier (comment in prod.ts notes this explicitly).

## Symptom

Route works in dev preview, 404s in the published app. Browser shows items not deleting, API calls failing silently, or features missing only in production.
