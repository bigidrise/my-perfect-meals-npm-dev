---
name: Unified Meal Image Pipeline
description: Architecture, root causes, and fixes for platform-wide meal image generation and persistence.
---

# Unified Meal Image Pipeline

## The contract
Every AI meal-generating surface must: generate text → generate image server-side → return permanent imageUrl → card renders complete. No card should appear before its image is ready.

## Storage backend status (as of last session)
- **S3**: returns 403 (IAM policy) — pre-existing, long-standing
- **Replit Object Storage sidecar (127.0.0.1:1106)**: returns 401 — was previously working, now broken
- **Fallback**: `generateMealImageUnified` returns `data:image/png;base64,...` when both backends fail

## The persistence bug (fixed)
**Root cause**: `server/services/imageLifecycle.ts:212-221` — `processMealImageForSave` was returning `null` when ingestion failed, regardless of URL type. This policy was correct for expiring OpenAI CDN URLs but wrong for base64 data URIs (which never expire and are self-contained).

**Fix**: Split the failure policy by URL type:
- `data:` base64 → preserve (self-contained, no expiry; retry upload on next save)
- CDN/external URLs → null (they expire in ~1h, would show broken images)

**Why Grocery Coach worked but builders didn't**: `mealCardFinalizer.ts` stores imageUrl directly to `saved_meals` DB rows, bypassing `processMealImageForSave` entirely. Builders go through `processAllMealImagesForSave` on every `saveBoard()` call, which was nulling the base64.

## Generation-side surface coverage

### Server-side before response (complete — no shimmer on first load)
- `CreateWithChefModal` → `/api/meals/finalize` → covers all 7 builders (GNB, Performance, Diabetic, GLP-1, Anti-Inflammatory, WeeklyMealBoard, BeachBodyMealBoard)
- Gatherings → batch Promise.all in `server/routes/gatherings.ts` (removed `skipImage: true`)
- Fridge Rescue → batch Promise.all in `server/routes.ts`
- My Perfect Beginnings `/create-dish` → `server/routes/my-perfect-beginning.ts` + client reads `data.imageUrl` directly
- SocialFindMeals / meal-finder → batch in `server/routes/mealFinder.ts`
- Craving Creator, Dessert Creator, Beverage Creator, Athlete's Beverage Creator, Restaurant Guide — were already server-side before this work
- Sushi Creator — uses Craving Creator server path (already server-side)

### Not yet migrated
- **Meals Away From Home** (`client/src/pages/FastFoodGuidePage.tsx`) — still client-side via `useChefFlowImages`; persistence fix applies when board-saved
- **Recipe Scan** (`client/src/pages/DashboardNew.tsx`) — uses localStorage; not audited

### Not applicable
- Spirits & Wine Pairing — text recommendations only, no meal images
- My Perfect Buffet — no AI meal image generation

## Shared utilities created
- `client/src/lib/imageUrlUtils.ts` — `isPermanentImageUrl`, `isTemporaryImageUrl`, `shouldProtectExistingImage`; all builder files import from here
- `server/services/mealFinalizer.ts` — generic server-side finalizer service
- `POST /api/meals/finalize` — endpoint in `server/routes/meals.ts`

## Key non-obvious rules
- `imagePending: true` in board JSONB has zero client readers — safe to set when upload pending
- Express body-parser limit is 10mb — sufficient for a 2MB base64 in board JSONB
- `normalizeMealArray` in `weekBoard.ts:123` uses `String(m.imageUrl)` — preserves base64 correctly
- `useMealImages.hydrateImages` filters `!m.imageUrl` — won't re-fetch meals that already have base64
- None of the 7 builder useEffects call `fetchImageForMeal` on board load — only on new meal insertion

**Why:** base64 is `isTemporaryImageUrl() === true` in imageUrlUtils but `isFirstPartyImageUrl() === false` in imageLifecycle — these two files use different classification systems. imageLifecycle is the authoritative gate for board saves.
