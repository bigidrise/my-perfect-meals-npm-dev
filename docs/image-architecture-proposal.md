# Image Architecture Proposal
**Status: PROPOSAL ONLY — awaiting approval before implementation**  
**Date: 2026-08-18**  
**Scope: Platform-wide (all 17 image-writing surfaces)**

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Root Problems Being Eliminated](#2-root-problems-being-eliminated)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Files / Services / Components Affected](#4-files--services--components-affected)
5. [Audit: All 17 Image-Writing Surfaces](#5-audit-all-17-image-writing-surfaces)
6. [Fallback Replacement](#6-fallback-replacement)
7. [One Canonical Image Identity](#7-one-canonical-image-identity)
8. [Client Cache Lifecycle](#8-client-cache-lifecycle)
9. [Failure State Taxonomy](#9-failure-state-taxonomy)
10. [Logging / Observability Plan](#10-logging--observability-plan)
11. [Failure Recovery](#11-failure-recovery)
12. [Existing-Image Compatibility Strategy](#12-existing-image-compatibility-strategy)
13. [Migration Strategy](#13-migration-strategy)
14. [Testing Plan](#14-testing-plan)
15. [Risks](#15-risks)

---

## 1. Current Architecture

### Write path (what works)

```
generateMealImageUnified()          ← called from all 17 route surfaces
  → DALL-E 3 image generation
  → GPT-4o vision validation (PASS / FAIL / SKIPPED)
  → processImageForMeal()           ← mediaAssetService.ts
      → Sharp resize: thumb 400px JPEG@82, display 1000px JPEG@88
      → @replit/object-storage upload (thumb + display + original)
      → returns /public-objects/{bucketId}/meal-images/{slug}-thumb-{hash}.jpg
  → meal_image_cache DB upsert      ← mealImageGenerator.ts line 861–902
      (cacheKey, imageUrl, mealName, promptUsed, validation*, recipeSignature)
  → in-memory LRU cache
```

### Read/serve path (where failure can occur silently)

```
Browser: GET /public-objects/{bucketId}/meal-images/{slug}-thumb-{hash}.jpg
  → server/routes.ts line 398–436
      → objectStorageService.downloadObject()   ← server/objectStorage.ts
          → @google-cloud/storage (GCS SDK)
              → HTTP GET http://127.0.0.1:1106/credential  ← credential sidecar
              → streams bytes to browser
          → on ANY error: HTTP 500, logs console.error
          → success: HTTP 200, image/jpeg — NO access log written
```

### Client failure handling

```
Browser: <img src="/public-objects/...">
  → on load success: image renders correctly
  → on ANY error (404, 500, 401, network timeout, CORS):
      hashFallback(mealName, sourceTypePool)
        → deterministic Unsplash stock photo index
        → "Lemon Coconut Keto Cake" → index 5 → pasta photo (always)
```

### SDK split summary

| Side | SDK | Auth mechanism | Failure visibility |
|------|-----|----------------|--------------------|
| Write | `@replit/object-storage` | Replit-managed | Logged |
| Read | `@google-cloud/storage` | Credential sidecar at `:1106` | 500 logged, 200 silent |
| Fallback | Unsplash CDN | Public | Never logged |

---

## 2. Root Problems Being Eliminated

### Problem 1 — SDK split (write ≠ read)
The same bytes are uploaded via `@replit/object-storage` and served via `@google-cloud/storage` + a credential sidecar daemon at `http://127.0.0.1:1106`. These are different auth systems. Any credential mismatch, sidecar failure, or sidecar restart produces a 500 on the read path while the write path continues working normally. This failure is currently invisible because the read route has no access log.

### Problem 2 — Semantically incorrect fallback (the primary user-visible harm)
`MealImageSlot.hashFallback()` maps any image load failure to a deterministic Unsplash stock photo chosen by the meal name. For a nutrition platform, this is indefensible: a broken keto cake becomes pasta. A broken smoothie becomes a steak. The user cannot tell the difference between correct AI-generated content and the fallback. Every infrastructure failure silently produces semantic misinformation.

### Problem 3 — No access log on the serve route
A successful `GET /public-objects/*` produces zero server log output. A future wrong-image report cannot be diagnosed from server logs. The only observable evidence of delivery failure is a browser DevTools network tab.

### Problem 4 — Delivery failure triggers regeneration cost
When `useMealImages.ts` detects a missing image (`!meal.imageUrl`), it calls `POST /api/meals/generate-image` which calls `generateMealImageUnified`. If the image exists in object storage but the serve route failed, this generates and bills for a new DALL-E image unnecessarily.

### Problem 5 — Upload failure returns ephemeral URL
When `processImageForMeal` fails, `generateMealImage` (lines 903–925) returns the raw ephemeral URL (DALL-E temporary CDN or base64). `safeLocalStorage.stripLargeFields` correctly strips `data:` blobs but passes through short DALL-E CDN URLs. Those CDN URLs expire in ~60 minutes. After expiry, the same image load failure occurs, hashFallback fires, pasta appears.

### Problem 6 — Corrupted production migration
The `validation_status` column migration on `meal_image_cache` logged a failure in production (`❌ Meal image validation migration failed: ADD COLUMN IF NOT EXISTS validation_status`). If this column is absent in production, every `meal_image_cache` DB upsert throws and the row is never written. Subsequent requests for the same meal regenerate from scratch — wasting DALL-E cost — and the serve route is never tested.

### Problem 7 — Image identity is name + recipe based, not ID based
The cache key (`buildStableCacheKey`) is a hash of meal name + sorted ingredients + sourceType. This is robust for generation deduplication but does not permanently bind an image to a specific meal result. If two meals have the same name and ingredients but are used in different contexts (a weekly board vs a craving creator result vs a saved favorite), they share one image. If that shared image ever fails to serve, all three surface the wrong fallback simultaneously.

---

## 3. Proposed Architecture

### Core principle
**One SDK owns the complete lifecycle: write, read/serve, existence check, deletion, and URL construction.**  
The credential sidecar remains as the GCS auth mechanism if necessary, but the read path switches to the same `@replit/object-storage` client already used for writes — eliminating the SDK mismatch.

### Write path (unchanged)

```
generateMealImageUnified()
  → DALL-E 3
  → GPT-4o validation
  → processImageForMeal()         ← @replit/object-storage (unchanged)
  → meal_image_cache DB upsert    ← with imageId (see §7)
  → in-memory LRU
```

### Read/serve path (new)

```
Browser: GET /public-objects/{bucketId}/{objectPath}
  → server/routes.ts handler (replacement)
      → replitObjectStorage.downloadAsStream(objectPath)  ← @replit/object-storage
          → on success: pipe bytes, set Content-Type, Content-Length
                        access log: imageId, objectPath, statusCode, ms, bytes
          → on notFound: HTTP 404 — logged
          → on error:    HTTP 503 with Retry-After: 5 — logged with full error
```

**Why 503 instead of 500:** 503 is retryable and signals to the browser that the resource exists but is temporarily unavailable. The browser can retry without triggering `onerror` immediately on some implementations. More importantly, the client-side handler (see §6) treats 503 as `delivery_failed` and shows the neutral placeholder, while 404 triggers `not_found` state.

### Client-side image rendering (new — see §6 for full detail)

```
<MealImageSlot imageUrl={...} imageId={...} mealName={...}>
  → loading: skeleton shimmer
  → on HTTP 200 + load: image renders
  → on HTTP 404: "Image not available" neutral placeholder (not food)
  → on HTTP 503/network error: "Loading..." retry placeholder with exponential backoff (max 3 retries, 2s/4s/8s)
  → on 3 retries exhausted: "Image temporarily unavailable" neutral placeholder (not food)
  → NEVER: hashFallback, NEVER: Unsplash stock photo
```

---

## 4. Files / Services / Components Affected

### Server

| File | Change |
|------|--------|
| `server/objectStorage.ts` | Add `downloadAsStream(objectPath)` method using `@replit/object-storage`; keep existing GCS methods for non-image object types until fully migrated |
| `server/routes.ts` line 398–436 | Replace GCS-based `/public-objects/*` handler with `@replit/object-storage` stream handler; add access log |
| `server/services/mealImageGenerator.ts` | Add `imageId` field to DB upsert; fix upload-failure path to return `null` instead of ephemeral URL; add per-phase structured logging |
| `server/services/mediaAssetService.ts` | Return `imageId` (UUID) from `processImageForMeal`; propagate to callers |
| `server/services/imageLifecycle.ts` | Thread `imageId` through `ingestImageToPermanentStorage`; fix ephemeral-URL escape |
| `server/db/schema/mealImageCache.ts` | Add `imageId` UUID column (primary reference); ensure `validation_status` migration is idempotent |
| `server/db/migrations/` | New idempotent migration: add `imageId` to `meal_image_cache`; backfill with `gen_random_uuid()` |
| `server/prod.ts` | Boot migration: idempotent ADD COLUMN IF NOT EXISTS `imageId` on `meal_image_cache` and `media_assets`; remove fragile migration that failed |
| All 17 route files (see §5) | Propagate `imageId` from `generateMealImageUnified` response to API response body |

### Client

| File | Change |
|------|--------|
| `client/src/components/ui/MealImageSlot.tsx` | Remove `hashFallback`, `FALLBACK_POOLS`; replace with delivery-state machine (loading / loaded / not_found / delivery_failed / render_failed); neutral branded placeholder for all failure states |
| `client/src/hooks/useMealImages.ts` | Update to pass `imageId` alongside `imageUrl`; retry logic on delivery failure before triggering regeneration; distinguish "no image yet" from "delivery failed" |
| `client/src/lib/safeLocalStorage.ts` | Add `imageId` to the persisted image record alongside `imageUrl`; strip ephemeral DALL-E CDN URLs (URLs containing `oaidalleapiprodscus.blob.core.windows.net` or similar) the same way `data:` is stripped |
| `client/src/pages/craving-creator.tsx` | Pass `imageId` through the option → selection → render flow |
| All other builder pages | Same `imageId` threading |

---

## 5. Audit: All 17 Image-Writing Surfaces

All 17 surfaces call `generateMealImageUnified()` as their image generation entry point. This is good centralization — the fix to that function propagates to all surfaces automatically. However, each surface must also propagate the returned `imageId` in its API response.

| Surface | Route file | Currently propagates imageId? | Notes |
|---------|------------|-------------------------------|-------|
| Craving Creator | `craving-creator.ts` | ❌ No | Primary incident surface |
| Fridge Rescue | `fridge-rescue.ts` | ❌ No | |
| Inspiration | `inspiration.ts` | ❌ No | |
| Beverage Creator | `beverage-creator.ts` | ❌ No | |
| Dessert Creator | `dessert-creator.ts` | ❌ No | |
| Meals (manual) | `meals.ts` | ❌ No | |
| Week Board | `weekBoard.ts` | ❌ No | |
| ProCare Week Board | `proWeekBoard.ts` | ❌ No | |
| Family Recipes | `familyRecipes.ts` | ❌ No | |
| Gatherings | `gatherings.ts` | ❌ No | |
| Restaurants | `restaurants.ts` | ❌ No | |
| Meal Finder | `mealFinder.ts` | ❌ No | |
| AI Meal Plan | `aiGenerateMealPlan.ts` | ❌ No | |
| Meal Images (standalone) | `mealImages.ts` | ❌ No | `/api/meals/generate-image` endpoint |
| Meal Shares | `mealSharesRouter.ts` | ❌ No | On-save image ingestion |
| My Perfect Beginning | `myPerfectBeginning.ts` | ❌ No | |
| Saved Meals toggle | `routes.ts` inline | ❌ No | `processMealImageForSave` on save |

**All 17 are consistent**: none currently propagate `imageId` because the field doesn't exist yet. This makes the fix uniform — add `imageId` to `generateMealImageUnified`'s return type and each surface naturally passes it through.

**Exception — `processMealImageForSave` (saved meals toggle):** This re-ingests an image from an existing URL (not a fresh generation). It uses `imageLifecycle.ts` directly. It needs its own `imageId` assignment and the same `imageId` threading through the save response.

---

## 6. Fallback Replacement

### What gets removed
- `FALLBACK_POOLS` constant (Unsplash URL arrays)
- `hashFallback()` function
- `getSemanticFallback()` on the server side (returns SVG category fallbacks — these are less harmful than food photos but still misleading; remove them from the cache path)
- The `onError → hashFallback → setFallback` chain in `MealImageSlot`

### What replaces it

**Four explicit states — no food photographs in any failure state:**

```
LOADING     → skeleton shimmer (current behavior, keep)
LOADED      → actual generated image (current behavior, keep)
NOT_FOUND   → neutral "Image not available" card
              - Branded My Perfect Meals icon
              - Text: "Image not available"
              - No food, no stock photo
DELIVERY_FAILED → neutral "Loading image..." card with retry
              - Same branded icon
              - Spinner or refresh icon
              - Retries: 2s / 4s / 8s exponential backoff (max 3)
              - After 3 retries: "Image temporarily unavailable"
RENDER_FAILED → same as NOT_FOUND
              (browser decoded the bytes but <img> failed to render — rare)
```

**How the state is determined:**

The current `onError` fires without knowing whether the failure was a 404, 500, or network timeout. This must change. The component needs to know the HTTP status.

**Approach:** Replace `<img src={imageUrl}>` with a fetch-then-render pattern in the hook layer:

```
useMealImageUrl(imageUrl, imageId):
  1. Fetch HEAD /public-objects/{path}        (no body, fast)
  2. 200 → return { state: 'ready', src: imageUrl }
  3. 404 → return { state: 'not_found' }
  4. 503/5xx → return { state: 'delivery_failed', retryAt: now + 2s }
  5. networkError → same as delivery_failed
  6. Retry up to 3× before moving to 'exhausted'
```

Alternatively (simpler): keep `<img>` rendering but intercept the response at the route level. The `/public-objects/*` handler can embed a custom response header (`X-Image-State: not_found | delivery_failed`) that a service worker or XHR-based image loader can read. This avoids converting every image to a fetch call.

**Recommended approach:** XHR-based image loading inside `MealImageSlot` for generated meal images only. Static assets (`/images/`, `/assets/`) are unaffected and stay as `<img>` tags.

---

## 7. One Canonical Image Identity

### The problem
An image is currently identified only by its cache key (a hash of name + ingredients + sourceType). This is a generation deduplication key, not a stable meal-result identifier. The same cache key is shared across every context where that meal appears: craving creator results, saved favorites, weekly boards, family recipes, shared meals.

### The proposed identifier
`imageId` — a UUID v4 generated at first successful upload and stored in:
- `meal_image_cache.imageId` (server DB, primary)
- `media_assets.imageId` (server DB)
- API response body of every builder endpoint
- Client-side state for each meal result
- localStorage persisted record alongside `imageUrl`

### How it prevents wrong-image substitution

When the client receives a meal result, it stores `{ mealResultId, imageId, imageUrl }` as a triple. On hydration, cache restoration, or rerender, the `imageId` on the cached record must match the `imageId` on the current meal result. If they don't match (e.g., a stale cache entry from a different meal has been loaded), the image is treated as `NOT_FOUND` and the neutral placeholder is shown — never another meal's image.

This replaces the current pattern where `hydrateImages` skips any meal that already has `imageUrl`, regardless of whether that `imageUrl` belongs to the correct meal.

### URL construction
`imageId` is NOT embedded in the URL. The URL continues to be the permanent object storage path. `imageId` is the semantic identity that validates the URL is correct for this meal, separate from the URL being technically fetchable.

---

## 8. Client Cache Lifecycle

### Current state (multiple competing caches)

| Cache | Key | What's stored | Authoritative? |
|-------|-----|---------------|----------------|
| `mealOptions` React state | Index | Full meal option object (no imageId) | During session only |
| `generatedMeals` React state | Index | Selected meal (imageUrl from API) | During session only |
| `CRAVING_CACHE_KEY` localStorage | Builder key | Full craving result array | Persisted |
| `useMealImages` localStorage | `meal-img:{mealId}` | Permanent imageUrl | Persisted |
| `useMealImages` in-flight set | `{slug}:{hash}` | Dedup during concurrent hydration | In-memory only |
| Server `meal_image_cache` DB | SHA-256 cache key | imageUrl + validation + recipeSignature | Authoritative |
| Server in-memory LRU | SHA-256 cache key | Same as DB | Authoritative (faster) |

### Proposed resolution order (highest → lowest authority)

```
1. Server DB (meal_image_cache.imageUrl WHERE imageId = :imageId AND validation = PASS)
2. Client localStorage imageUrl WHERE imageId matches current meal's imageId
3. API response imageUrl (fresh from server)
4. NOT_FOUND state — show neutral placeholder
```

**Never:** use a cached imageUrl whose `imageId` does not match the current meal's `imageId`.

### Specific cache surfaces

**Craving Creator localStorage (`OPTIONS_CACHE_KEY`, `RESULT_CACHE_KEY`):**  
Persist `imageId` alongside `imageUrl` in the cached meal objects. On restore, validate `imageId` match before using `imageUrl`. Strip DALL-E CDN URLs during persistence (same rule as `data:` URLs — they expire).

**`useMealImages` hydration:**  
Add `imageId` to the persisted record. `lookupHydratedImageUrl(mealId)` becomes `lookupHydratedImage(imageId)` — keyed by identity, not by an opaque meal ID. `hydrateImages` checks: if `meal.imageId` and cached `imageId` match, use cached URL; if mismatch, mark as `NOT_FOUND`; if `meal.imageUrl` exists and `imageId` matches, skip hydration call.

**Weekly Meal Board, Family Recipes, Shared Meals:**  
These fetch meal data from the server, which includes `imageUrl` from the DB. The server-side record is authoritative. Client does not need a separate hydration call for these — the URL comes from `meal_image_cache` via the API, which is already validated.

**Saved Favorites:**  
`processMealImageForSave` runs on save, producing a permanent URL. `imageId` is stored with the saved meal. On restore, `imageId` validates the URL is still correct.

### Authoritative conflict resolution

When cached client state and server state disagree:
- **Server wins always.** If the API returns a new `imageId` + `imageUrl`, replace the client cache.
- Client cache is a performance optimization (avoid re-fetching), not a source of truth.
- A delivery failure on a cached URL does NOT automatically trigger regeneration. It triggers retry. Regeneration is only authorized when `meal_image_cache` has no row for this `imageId` (generation was never completed or was evicted).

---

## 9. Failure State Taxonomy

Five distinguishable states with corresponding server log entries:

| State | Definition | Server log field | Client UX |
|-------|-----------|-----------------|-----------|
| `generation_failed` | DALL-E API returned error or empty | `imageGeneration.status=failed, error=...` | Neutral placeholder immediately |
| `validation_failed` | GPT-4o validation returned FAIL on both attempts | `imageValidation.status=failed, reason=...` | Neutral placeholder — DO NOT use the invalid image |
| `storage_failed` | `processImageForMeal` threw or returned null | `imageStorage.status=failed, error=...` | Neutral placeholder; mark DB row with `storage_failed` |
| `delivery_failed` | Serve route returned non-200 for an existing object | `imageDelivery.status=failed, httpStatus=..., objectPath=..., ms=...` | Retry placeholder → after 3 retries, neutral placeholder |
| `render_failed` | Browser `<img>` decoded bytes but failed to render | `imageRender.status=failed` (client-logged via API) | Neutral placeholder |

**Key distinction:** `delivery_failed` must NOT trigger a new DALL-E call. The image exists in storage. The problem is in the serve path, not the generation path.

**`render_failed` client reporting:** The client sends a fire-and-forget `POST /api/image-diagnostics` event when a loaded image fails to render. This gives server-side visibility into client render failures without blocking the UI.

---

## 10. Logging / Observability Plan

### Full image trace per generation

Every call to `generateMealImageUnified` emits a structured log trace:

```json
{
  "imageTrace": {
    "imageId": "uuid",
    "cacheKey": "hex32",
    "mealName": "Lemon Coconut Keto Cake",
    "sourceType": "dessert",
    "phase": "generation | validation | storage | cache",
    "status": "pass | fail | skipped | hit | miss",
    "durationMs": 1240,
    "dalleModel": "dall-e-3",
    "validationModel": "gpt-4o",
    "objectPath": "meal-images/lemon-coconut-keto-cake-thumb-abc.jpg",
    "bucketId": "replit-objstore-...",
    "fromCache": false
  }
}
```

### Serve route access log (new)

Every `GET /public-objects/*` emits:

```json
{
  "imageServe": {
    "objectPath": "meal-images/lemon-coconut-keto-cake-thumb-abc.jpg",
    "httpStatus": 200,
    "contentType": "image/jpeg",
    "bytes": 21620,
    "durationMs": 43,
    "sdkCall": "replitObjectStorage.downloadAsStream"
  }
}
```

On failure:

```json
{
  "imageServe": {
    "objectPath": "...",
    "httpStatus": 503,
    "error": "...",
    "sdkError": "NotFound | PermissionDenied | DeadlineExceeded",
    "durationMs": 6002
  }
}
```

### Client delivery failure reporting

`POST /api/image-diagnostics` (fire-and-forget, no auth required):

```json
{
  "imageId": "uuid",
  "imageUrl": "/public-objects/...",
  "failureState": "delivery_failed | render_failed",
  "httpStatus": 503,
  "retryCount": 3,
  "userAgent": "..."
}
```

This gives server visibility into browser-side failures without requiring browser DevTools.

### Full trace for a future wrong-image report

With this logging, a future report ("I see pasta instead of cake") is diagnosable entirely from server logs:

```
1. Find imageTrace WHERE mealName = 'Lemon Coconut Keto Cake' AND phase = 'generation' → verify status=pass
2. Find imageTrace WHERE cacheKey = :key AND phase = 'storage' → verify objectPath
3. Find imageServe WHERE objectPath = :path → verify httpStatus=200 or see error
4. Find /api/image-diagnostics WHERE imageId = :id → verify no client failures
```

All four links in the chain are now observable without browser DevTools.

---

## 11. Failure Recovery

### Generation failure
- Return `null` imageUrl immediately
- Client shows neutral placeholder
- No retry — DALL-E errors are usually content policy or rate limit; re-calling immediately will fail again
- Next user request for the same meal regenerates from scratch (correct behavior)

### Validation failure (FAIL after 2 attempts)
- Do NOT store the image URL in `meal_image_cache`
- Return `null` imageUrl
- Client shows neutral placeholder
- Next user request regenerates — validation may have been a false positive

### Storage failure
- Do NOT return the ephemeral DALL-E CDN URL or base64 blob as the imageUrl
- Return `null` imageUrl (current code at lines 903–925 must be fixed)
- Write a `storage_failed` row to `meal_image_cache` with `imageId` but null `imageUrl`
- Client shows neutral placeholder
- Retry on next user request for the same meal (the `storage_failed` row is treated as a cache miss by the generator)

### Delivery failure (serve route returns non-200)
- Client retries 3× with exponential backoff (2s / 4s / 8s)
- Each retry is a fresh request to `/public-objects/*` — the sidecar or storage backend may recover
- After 3 retries: neutral "Image temporarily unavailable" placeholder
- Do NOT call `POST /api/meals/generate-image` — the image exists in storage
- Report failure to `/api/image-diagnostics`

### Ephemeral URL escape (current bug fix)
- `safeLocalStorage.stripLargeFields` must also strip URLs matching the DALL-E CDN pattern (`oaidalleapiprodscus.blob.core.windows.net`, `oaidalleapiprodscus2.blob.core.windows.net`, etc.)
- These expire in ~60 minutes and should never reach localStorage

### Regeneration cost protection
`useMealImages.hydrateImages` currently calls `POST /api/meals/generate-image` for any meal without `imageUrl`. This must change:

```
if meal.imageId exists and imageId is in meal_image_cache → delivery failure, NOT generation missing
  → show neutral placeholder, report delivery failure
  → do NOT call generate-image

if meal.imageId is absent or meal_image_cache has no row for imageId
  → generation is genuinely missing
  → call generate-image (DALL-E cost is authorized)
```

This requires `/api/meals/generate-image` to accept `imageId` as an optional param and check the DB before generating.

---

## 12. Existing-Image Compatibility Strategy

### URL format: no change
Existing `/public-objects/{bucketId}/meal-images/...` URLs are preserved. The serve route handler changes internally (SDK switches) but the URL format is identical. All existing saved meals, weekly boards, shared meals, and family recipes continue to use their stored URLs.

### `imageId` backfill
`meal_image_cache` rows that exist before the migration do not have an `imageId`. The migration adds `imageId UUID DEFAULT gen_random_uuid()` — every existing row gets a unique ID automatically. However, these backfilled IDs have no semantic meaning until a client references them. On first client request, the server returns the existing `imageUrl` alongside the backfilled `imageId`, and the client stores the pair. From that point forward, the pair is stable.

### `hashFallback` removal grace period
After `hashFallback` is removed, meals that previously showed a fallback will show the neutral placeholder instead. This is strictly better behavior. There is no backward compatibility concern — no user should be receiving wrong food as their intentional experience.

### `getSemanticFallback` (server-side SVG fallbacks)
These SVG fallbacks are used in `generateMealImageUnified` when ingredients are empty (the fast-return path at line 666–682). They are less harmful than Unsplash photos (they're generic food icons, not a different meal). However, they are still misleading in the context of a generation that "succeeded." Proposed: return `null` imageUrl for the empty-ingredients case and log `generation_failed` with `reason: empty_ingredient_contract`. Client shows neutral placeholder.

---

## 13. Migration Strategy

**Order of operations (production-safe, no big-bang deploy)**

### Phase 1 — Fix the DB migration (no behavior change)
**Goal:** Ensure `meal_image_cache.validation_status` and a new `imageId` column exist in production without risk of another migration failure.

- Replace the fragile `ALTER TABLE ... ADD COLUMN IF NOT EXISTS validation_status TEXT` boot migration with an idempotent script that checks `information_schema.columns` before altering
- Add `imageId UUID NOT NULL DEFAULT gen_random_uuid()` in the same idempotent script
- Run this as a boot migration in both `server/index.ts` (dev) and `server/prod.ts` (prod)
- Deploy and verify: confirm both columns exist in production DB before proceeding to Phase 2

**Risk:** Low. Idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe on live DB.

### Phase 2 — Add access logging to the existing serve route (no behavior change)
**Goal:** Make the current serve route observable before switching its SDK.

- Add `console.log` / structured logger to the `/public-objects/*` handler for both success and failure
- Deploy and verify: confirm logs appear in production for image requests
- This is a one-line change. It immediately makes future diagnosis possible without browser DevTools.

**Risk:** Near-zero. Logging only.

### Phase 3 — Switch serve route to `@replit/object-storage` SDK
**Goal:** Eliminate the GCS + credential sidecar dependency for image serving.

- Add `downloadAsStream(objectPath)` to `server/objectStorage.ts` using `@replit/object-storage`
- Replace the GCS-based handler body in `server/routes.ts` `/public-objects/*`
- Keep the same URL format, same response headers
- Existing URLs continue to work — only the internal fetch mechanism changes
- Deploy to production, verify with a fresh image request and an existing saved meal image
- Monitor: confirm 200s are logged, no 500s

**Risk:** Medium. This is the SDK switch. If `@replit/object-storage` does not have a streaming download API, Phase 3 needs an alternative (see §15 Risks). Verify the API before committing to this phase.

### Phase 4 — Fix the ephemeral URL escape
**Goal:** Prevent DALL-E CDN URLs from reaching localStorage.

- Add DALL-E CDN URL pattern to `safeLocalStorage.stripLargeFields`
- No UI change; users won't notice
- Deploy

**Risk:** Low. Pure defensive fix.

### Phase 5 — Add `imageId` to generation pipeline and API responses
**Goal:** Every new generation gets a stable identity.

- Add `imageId` field to `generateMealImageUnified` return type
- Propagate from `processImageForMeal` → `imageLifecycle` → `mealImageGenerator` → all 17 route files → API responses
- Client begins receiving `imageId` in responses (no client behavior change yet — client ignores unknown fields)
- Deploy

**Risk:** Low. Additive change. Client ignores new field until Phase 6.

### Phase 6 — Client-side `MealImageSlot` replacement
**Goal:** Remove `hashFallback`, introduce delivery state machine.

- Replace `hashFallback` and `FALLBACK_POOLS` with the four-state renderer
- Update `useMealImages` to use `imageId` for cache validation
- Update `safeLocalStorage` to persist `imageId` alongside `imageUrl`
- Update craving-creator, fridge-rescue, inspiration, and other builder pages to thread `imageId`
- Deploy

**Risk:** Medium-high. This touches the client rendering path across all builders. Requires careful testing (see §14). The neutral placeholder UI must be designed before this phase ships.

### Phase 7 — Client-side reporting endpoint
**Goal:** Add server-side visibility for browser-level failures.

- Add `POST /api/image-diagnostics` (lightweight, unauthenticated, rate-limited)
- Client fires this on delivery failure and render failure
- Deploy

**Risk:** Low. Additive.

### Phase 8 — Full observability trace
**Goal:** Complete the end-to-end trace through all generation phases.

- Structured logging in `generateMealImage`, `processImageForMeal`, and the serve route
- All logs tagged with `imageId` and `cacheKey`
- Deploy

**Risk:** Low. Logging only, but touches several files.

---

## 14. Testing Plan

### Phase 3 (serve route switch)
- [ ] Request an existing saved meal image URL via production domain — confirm HTTP 200, correct bytes
- [ ] Request a freshly generated image — confirm HTTP 200
- [ ] Simulate storage miss (non-existent objectPath) — confirm HTTP 404 in logs
- [ ] Confirm serve route access log appears in production logs for both success and failure

### Phase 6 (MealImageSlot replacement)
- [ ] Craving Creator: generate a keto cake — confirm correct image renders, no pasta
- [ ] Craving Creator: simulate a serve failure (temporarily bad URL) — confirm neutral placeholder, NO food photo
- [ ] Retry behavior: confirm 3 retries with backoff before giving up
- [ ] Saved Favorites: confirm existing saved meal images still display
- [ ] Weekly Meal Board: confirm board images still display
- [ ] Family Recipes: confirm recipe images still display
- [ ] Shared Meals (public `/m/:token` route): confirm image displays
- [ ] Beverage Creator: confirm beverage shows neutral placeholder on failure, not a different food
- [ ] localStorage: confirm `imageId` is persisted alongside `imageUrl`
- [ ] Cache restore: confirm restored cache entry uses `imageId` validation

### Regression
- [ ] All 17 write surfaces: confirm image generation still succeeds and imageUrl/imageId appear in API response
- [ ] Craving Creator "Try 3 More": confirm images appear on second generation set
- [ ] GLP-1 Craving Creator: confirm images appear with GLP-1 guardrails active
- [ ] ProCare physician builder: confirm images appear for client meals

---

## 15. Risks

### Risk 1 — `@replit/object-storage` may not have a streaming download API
**Probability:** Medium  
**Impact:** Phase 3 cannot use the simple SDK switch. Mitigation: if `@replit/object-storage` only supports `uploadBuffer` / `uploadFile` (write-only), the serve path must use a different approach:
- **Option A:** Direct public URL (if Replit object storage generates a CDN-accessible URL without server proxy) — eliminates the route handler entirely for images
- **Option B:** Keep the GCS SDK for reading but add the access log (Phase 2) and a retry wrapper around the sidecar call. This is a smaller fix, not the full architectural cleanup, but eliminates the silent-failure problem.
- **Option C:** Use Replit's `/objects/` route (already registered via `registerObjectStorageRoutes`) — this uses a different path but the same storage. Investigate whether this path can serve images.

**Action before Phase 3:** Verify `@replit/object-storage` client API for download. If unavailable, select fallback option before implementation begins.

### Risk 2 — `imageId` backfill breaks existing cache hit logic
**Probability:** Low  
**Impact:** The cache key logic in `isCacheRowServable` (lines 577–584) uses `cacheKey` (SHA-256 hash), not `imageId`. Adding `imageId` to the schema does not change the cache hit path. Existing rows get backfilled UUIDs with no semantic impact until Phase 5/6 when the client starts using them.

### Risk 3 — Neutral placeholder degrades perceived quality
**Probability:** Low-medium  
**Impact:** Some users will see the neutral placeholder for meals that previously showed a food photo (even a wrong one). This is the correct tradeoff — semantic accuracy over visual completeness. Mitigation: ensure the neutral placeholder is well-designed (branded, informative, not a broken image icon) before Phase 6 ships.

### Risk 4 — Phase 5 (imageId propagation) introduces 17-file change surface
**Probability:** Medium (merge conflicts, missed surface)  
**Impact:** One missed surface returns an API response without `imageId`. That surface's images work normally but can't be validated by the client `imageId` check. Mitigation: add a server-side test that asserts every builder response includes `imageId` when an image was generated.

### Risk 5 — Production DB migration for `imageId` fails again
**Probability:** Low (if written idempotently)  
**Impact:** If the migration fails at boot, `imageId` column is absent and Phase 5 DB upserts throw. Mitigation: Phase 1 uses the `information_schema.columns` check pattern (already proven to work for other columns in this codebase) and is deployed and verified before any subsequent phase.

---

## Summary

| | Current | Proposed |
|---|---|---|
| Write SDK | `@replit/object-storage` | `@replit/object-storage` (unchanged) |
| Read SDK | `@google-cloud/storage` + sidecar | `@replit/object-storage` (same as write) |
| Serve route access log | ❌ None | ✅ Every request |
| Image failure UX | ❌ Wrong food (deterministic) | ✅ Neutral branded placeholder |
| Retry on delivery failure | ❌ None | ✅ 3× exponential backoff |
| Unnecessary regeneration | ❌ Any missing imageUrl triggers DALL-E | ✅ Only authorized when generation genuinely absent |
| Image identity | ❌ Name+recipe hash (shared across contexts) | ✅ `imageId` UUID per generation |
| Future diagnosability | ❌ Requires browser DevTools | ✅ Full server-side trace by imageId |
| Ephemeral URL escape | ❌ DALL-E CDN URLs reach localStorage | ✅ Stripped same as base64 |
| Failed storage returns | ❌ Ephemeral URL (expires in ~60min) | ✅ null (neutral placeholder) |
| Client failure reporting | ❌ None | ✅ `/api/image-diagnostics` |
