---
name: Saved-meals DB pool contention diagnosis
description: Root cause of /api/saved-meals being slow (1.7-3.6s) — connection pool exhaustion, not query or module-load time.
---

# Saved-meals latency root cause

## The rule
`/api/saved-meals` latency is caused by DB connection pool wait, not by the query itself or `resolveDailyNutritionState`. The saved_meals query executes in 0.1ms (EXPLAIN confirmed), but waits 1700ms for a free connection.

**Why:** The dashboard fires ~10 concurrent background-polling endpoints on every page load (`tablet/unread-summary`, `pattern-alerts`, `client/tablet`, `user/profile`, etc.) that each hold DB connections for 600-940ms. With `max: 10` pool slots, all were consumed before saved-meals could get one.

**How to apply:** If Favorites (or any other page) is slow but the DB query is fast, check pool contention first — look for concurrent requests in the server logs at the same timestamp.

## Fixes applied
- `server/db.ts`: `min: 3` (pre-warm 3 connections at boot), `max: 20` (up from 10)
- `server/routes.ts` `/api/saved-meals` handler: static import of `resolveDailyNutritionState` (was dynamic), parallelized saved-meals DB query with user query, 1-second timeout on state resolution so a slow state calc never blocks the response

## Timing instrumentation pattern (for future diagnosis)
```
const t0 = Date.now();
// ... work ...
const t1 = Date.now(); console.log(`stage1=${t1-t0}ms`);
// parallel promise started at t0, awaited here:
const rows = await somePromise;
const t2 = Date.now(); console.log(`parallelQuery=${t2-t0}ms`);
```
The "parallelQuery" time measured from t0 tells you how long the promise actually took end-to-end, including pool wait.

## What did NOT help (hypothesis busted by timing data)
- Dynamic import of `resolveDailyNutritionState` — the module was already in memory; only added ~0ms; NOT the 5-second bottleneck
- `resolveDailyNutritionState` itself — takes 4ms, not the culprit; the 1s timeout was unnecessary insurance

## localStorage crash fix (same session)
`mpm_chefs_kitchen_meal` localStorage writes crash the app globally if imageUrl is a base64 data URL (500KB+). Strip before writing:
```typescript
const safeUrl = (!url || url.startsWith("data:") || url.includes("oaidalleapiprodscus")) ? null : url;
```
Fixed in 4 files: `MealCardActions.tsx`, `GeneratedMealCard.tsx`, `meal-card.tsx`, `MyPerfectBeginningCreateMealPage.tsx`.
