---
name: Canonical Media Asset Architecture — Step 4
description: Full lifecycle for meal images through media_assets table, paginated favorites, and lifecycle gates. Object Storage API quirks and test patterns.
---

## Founder-required finalized image policy

Once My Perfect Meals generates and finalizes a recipe, its image must be a permanent static asset attached to that recipe. This applies to every active feature that generates, displays, saves or restores AI-generated meal images, including newly discovered features, shared components and shared services; named creators are examples, never a scope limit. Generate images only during an authorized initial recipe-generation workflow. Navigation, refresh, Favorites, Saved Meals, meal-plan access, Guided Cooking, cache expiration and delivery failure must never automatically regenerate a finalized image.

**Why:** The founder explicitly requires the generated image to stay on its meal card in perpetuity. Users did not supply these photos and must not be asked to re-upload them to compensate for an application persistence failure.

**How to apply:** Make the existing persistence system dependable rather than introduce another image-generation system. Preserve the original asset and recipe association; distinguish delivery or permission failures from actual object loss. Before repairs, establish whether the relevant persistence code is in the running Production build, whether the exact file exists, and whether its runtime can retrieve it. Do not regenerate a replacement to conceal a read failure. Preserve the complete From Scratch recipe package alongside its permanent image reference.

Initial image-storage failure must be recorded explicitly; never represent an unsuccessful upload as a successfully persisted image. Keep the preparation guide, cooking instructions, ingredients, nutrition and original image association attached to the finalized recipe.

**Why:** The founder explicitly required honest failure handling and complete recipe persistence, rather than another workaround for From Scratch.

**How to apply:** Audit existing creators' finalization, storage references and regeneration triggers before implementing repairs. Verify actual running Development and Production behavior separately; source presence alone is not runtime verification. Existing image-persistence behavior must be reliable before From Scratch implementation.

Preserve the original image identity across every location where the finalized recipe appears. Retrieval failures permit read-only recovery of that original asset, followed by an appropriate error if unsuccessful. Neither a generation cache nor browser state is permanent image storage; active builders must not implement independent exceptions.

**Why:** The founder explicitly clarified platform-wide scope and required any eventual repair to enforce these rules across the platform, not merely on individual creator screens.

**How to apply:** Build the audit inventory from all active generation, restoration and display pathways, including their shared dependencies. The focused audit is read-only; implementation requires explicit approval afterward.

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

## Broken Permanent-URL Recovery
- A delivery-failure report permits a read-only delivery check, not replacement generation. Bind checks to the reporting user's current saved meal, exact current media asset and canonical stored URL.
- **Why:** a stale browser report must not mutate shared media state, replace the original food photo or cause duplicate paid work.
- **How to apply:** retry delivery or use a verified surviving variant of the same asset without rewriting shared lifecycle state merely because the image was viewed. Keep authorization and recipe identity checks intact.

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
