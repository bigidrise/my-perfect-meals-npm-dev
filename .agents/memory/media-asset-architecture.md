---
name: Canonical Media Asset Architecture — Step 4
description: Full lifecycle for meal images through media_assets table, paginated favorites, and lifecycle gates. Object Storage API quirks and test patterns.
---

## Architecture Contract
- `server/services/mediaAssetService.ts` — the ONLY path for images entering permanent storage. Returns `{ id, thumbnailUrl, displayUrl, status }`.
- `server/services/imageLifecycle.ts` — routes through mediaAssetService; exposes `processMealImageForSave`, `isFirstPartyImageUrl`, `findMealsWithTempImages`.
- `ingestImageToPermanentStorage` kept as `@deprecated` shim (compat for mealImageGenerator.ts) — delegates to `processMealImageForSave`.
- `media_assets` table in DB: `server/db/schema/mediaAssets.ts`. Has `thumbnail_url`, `display_url`, `original_object_key`, `status` (pending/ready/failed).
- `saved_meals` has `media_asset_id UUID` FK column (added by boot migration).

## Boot Migration
- `server/db/migrations/runMediaAssetsMigration.ts` — idempotent; adds table + FK.
- Import path from that file must be `"../../db"` (not `"../db"` — migrations are one level deeper than schema).
- Registered in both `server/index.ts` (setTimeout 4800ms) and `server/prod.ts` (setTimeout 5400ms).

## Object Storage API Quirks
- `getBucket()` is `private` in TypeScript types but works at runtime. Cast: `(client as any).getBucket()`.
- `UploadOptions` only has `compress?: boolean` in type defs — `contentType` is not typed but accepted at runtime. Cast: `{ contentType } as any`.

## GET /api/saved-meals — Paginated Response
- Query params: `page` (default 1), `limit` (default 20, max 100).
- Response: `{ meals, total, page, limit, hasMore }`.
- LEFT JOIN on `media_assets` pulls `thumbnail_url`, `display_url`, `status`.
- URL hierarchy: `assetThumbnailUrl ?? (firstParty mealData.imageUrl) ?? null`.
- Base64 and DALL-E URLs silently return null (Step 2 defense-in-depth preserved).

## Lifecycle Gates Added
- `familyRecipes.ts` CREATE + UPDATE: `processMealImageForSave` before INSERT/UPDATE.
- `mealSharesRouter.ts` CREATE: blocks temp DALL-E patterns before INSERT.
- `ingestImageToPermanentStorage` in `mealImageGenerator.ts`: already routes through lifecycle via shim.

## Client Side
- `useSavedMeals.ts`: `useSavedMealsFeed(20)` returns InfiniteQuery. `useSavedMealsList()` kept for compat (flattens pages).
- `SavedMealRow.tsx`: thumbnail uses `row.thumbnailUrl || d?.imageUrl` (list), display uses `row.displayUrl || row.thumbnailUrl || d?.imageUrl` (expanded).
- `SavedMeals.tsx`: "Load more" button calls `fetchNextPage()`.

## Test Pattern for Lifecycle Tests
- Test file location: `server/tests/` (Jest `roots` points there, NOT `tests/`).
- Must stub ESM-only transitive deps at top of test file:
  ```typescript
  jest.mock("@replit/object-storage", () => ({ Client: class { } }));
  jest.mock("sharp", () => jest.fn());
  jest.mock("../db", () => ({ db: {} }));
  jest.mock("../db/schema/mediaAssets", () => ({ mediaAssets: {} }));
  ```
- 43/43 tests in `server/tests/mediaAssetLifecycle.test.ts`.

## Remaining Work (not done in this session)
- 6 Prepare-with-Chef localStorage paths in fridge-rescue.tsx, craving-creator.tsx, and 4 others — need imageUrl safety check before `localStorage.setItem`.
