---
name: Express async middleware + sub-routers
description: Express v4 does not await async middleware when paired with a sub-router in app.use(). requireAuth must live inside the router, not only at the mount point.
---

## The Rule

When a sub-router is mounted via `app.use(path, asyncMiddleware, router)`, Express v4 does NOT await the Promise returned by `asyncMiddleware`. The router can begin executing before the async work (DB queries, session lookup) finishes — leaving `req.authUser` undefined.

**Fix**: always add `requireAuth` (or any async identity middleware) as the **first** `router.use()` call inside the sub-router itself, in addition to (or instead of) the app-level mount.

```typescript
// WRONG — Express v4 does not await requireAuth before dispatching diabetesRouter
app.use("/api/diabetes", requireAuth, diabetesRouter);

// CORRECT — requireAuth lives inside the router; next() callback is synchronous
export const diabetesRouter = Router();
diabetesRouter.use(requireAuth);               // ← identity first
diabetesRouter.use(enforceAssignedBuilder(...)); // ← access checks second
```

**Why**: `app.use(path, fn1, fn2)` adds fn1 and fn2 as a layer. Express calls fn1 with a `next` callback. If fn1 is async, Express doesn't await its return value — it just waits for the `next` callback to fire. When fn1 calls `next()` from inside its async body (after awaits), that triggers fn2. **This works correctly** IF fn1 actually calls `next()`. The bug appears when fn1 has a long async path (DB query + orgContext load) and Express v4 applies the layer such that fn2 (the sub-router) gets dispatched before fn1's async work completes. Adding requireAuth inside the sub-router sidesteps this entirely.

**Also implicated**: `glp1ShotsRoutes` is mounted as `app.use("/api", glp1ShotsRoutes)` with `router.use(requireAuth, requireOrgFlag("glp1Support"))` at its top — this intercepts ALL `/api/*` requests including diabetes routes. If `requireOrgFlag` returns 403, diabetes requests are blocked there before even reaching the diabetes mount.

**Affected routers** (same pattern, same risk):
- `cookingChallengesRouter` — `app.use("/api/cooking-challenges", requireAuth, requireActiveAccess, router)`
- `cookingClassesRouter` — same
- `holidayFamilyRecipeRouter` — same

**Regression test**: `scripts/smoke-diabetes.sh` — verifies 401 for anon, 201 for authed write, 400/422 for bad input.
