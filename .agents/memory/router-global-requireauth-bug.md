---
name: Global router.use(requireAuth) blocks public routes
description: A router.use(requireAuth) at the top of a sub-router mounted at a broad prefix (e.g. /api) will intercept ALL matching requests — including public ones like /api/auth/login — causing 401 for unauthenticated users everywhere.
---

# Global router.use(requireAuth) blocks public routes

## The Rule
Never put `router.use(requireAuth)` at the top of a router that is mounted at a broad path like `/api`. It will intercept every request under that prefix before any route matching happens — including public routes like login/register.

**Why:** Express `app.use("/api", router)` funnels ALL `/api/*` requests into the router's middleware stack. A `router.use(requireAuth)` runs first for every such request. If requireAuth returns 401, the response ends immediately — no other route handler (not even login) can run.

**How to apply:** Always apply requireAuth per-route (`router.get("/path", requireAuth, handler)`) in routers that are mounted at broad paths. Global `router.use(requireAuth)` is only safe if the router is mounted at a very specific path that only covers genuinely protected routes (e.g., `app.use("/api/admin", requireAuth, adminRouter)`).

## What went wrong
`clinicalInterventions.ts` had `router.use(requireAuth)` at line 23, but was mounted as `app.use("/api", clinicalInterventionsRouter)` in `prod.ts`. This broke ALL unauthenticated `/api/*` requests in production, including login.

## The Fix Pattern
```typescript
// ❌ WRONG — blocks every /api/* request including login
const router = Router();
router.use(requireAuth);
router.get("/pro/clients/:id/data", handler);

// ✅ RIGHT — only protects the specific routes
const router = Router();
router.get("/pro/clients/:id/data", requireAuth, handler);
router.put("/pro/clients/:id/data", requireAuth, handler);
```
