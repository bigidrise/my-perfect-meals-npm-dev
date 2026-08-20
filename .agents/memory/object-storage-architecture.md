---
name: Object Storage Architecture (active)
description: Current working image storage path, bucket info, and why the old signed-URL path is dead.
---

## Active Architecture

`permanentImageStorage.ts` — S3 primary (403, broken IAM) → `@replit/object-storage` Client fallback (WORKING).

**Why `@replit/object-storage` Client, not signed-URL:**
The sidecar's `/object-storage/signed-object-url` returns 401 and is NOT fixable in code — it requires platform-level auth not available to server processes. The `@replit/object-storage` Client auto-discovers the bucket via `/object-storage/default-bucket` and authenticates via the GCS SDK credential flow (`/credential` + `/token` endpoints). This is the only working upload path.

**Active bucket:** `replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b` (display name: "FuzzyOrdinaryWebmaster")

## Parallel-workspace recovery

An existing App Storage bucket can be deliberately granted to another app in the same Replit account via **App Storage → bucket menu → Add an existing bucket**. A clean, parallel workspace can therefore validate against the existing database and bucket without copying data or deleting the incumbent workspace.

**Why:** A workspace-level authorization incident may justify a reversible recovery candidate, but replacing a bucket or database would unnecessarily risk user data and image history.

**How to apply:** Keep the current deployment intact; attach the existing bucket only to a temporary recovery app, configure its production secrets, test there, and move the custom domain only after verification. Disconnecting/reconnecting a custom domain is required for cutover.

**Why the old bucket stopped working:** The bucket `replit-objstore-e02a723e-40e9-4d89-9c0e-05adfa185d2d` became disconnected from the repl. The sidecar returned "no allowed resources" on all token requests. Creating a new bucket fixed it instantly.

**Public URL format:** `/public-objects/<bucket-id>/<object-path>`  
Example: `/public-objects/replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b/meal-images/foo.png`

**Route fix:** `/public-objects/` handler in routes.ts now fast-paths any URL starting with `replit-objstore-` by parsing bucket+object directly from the URL path, bypassing the `PUBLIC_OBJECT_SEARCH_PATHS` prepend. Legacy search-path behavior is preserved for other URLs.

**Reads unified on Replit SDK (Aug 2026):** `/public-objects/*` now serves via `@replit/object-storage` (same SDK as writes) — `resolvePublicObjectPath()` + `downloadAsStream()` in `objectStorage.ts`. Status contract: 404 = missing, 503 = storage error (retryable); every request emits a JSON `public_object_access` log (objectPath, httpStatus, bytes, durationMs). Note: the Replit SDK client can ONLY access buckets attached to this repl — pointing `ClientOptions.bucketId` at the old disconnected bucket (e02a723e, still in PUBLIC_OBJECT_SEARCH_PATHS) errors with a heimdall permission denial, so legacy-format URLs 503 until that env var is updated to the active bucket.

**Env vars:** `PUBLIC_OBJECT_SEARCH_PATHS` and `DEFAULT_OBJECT_STORAGE_BUCKET_ID` secrets still hold stale/invalid values (old bucket or accidental garbage). `PRIVATE_OBJECT_DIR` uses a third bucket `replit-objstore-08cdcbe0-7495-49fb-8e0e-b38a366e8f55/.private` — do not change. Code-level remap applied (objectStorage.ts): `LEGACY_DISCONNECTED_BUCKET` (e02a723e) is substituted with `ACTIVE_BUCKET_ID` (2a68d585) in three places — `getPublicObjectSearchPaths()`, `resolvePublicObjectPath()` embedded-bucket branch, and `downloadAsStream()`. Invalid search-path entries are dropped via structural bucket-ID check. Falls back to `/${ACTIVE_BUCKET_ID}/public` when all paths are invalid. Secrets still need correcting (pending a separate task), but the server is fully resilient without them.

**S3 is still broken:** HTTP 403 (IAM policy). Not fixed. Fallback to Object Storage is the production path until S3 is repaired.

## Step 3B Migration Result

- 54 base64 images migrated → 0 remaining in DB
- 0 failures
- DB payload: 103 MB → 0.257 MB  
- 17 DALL-E CDN records left as-is (expired, unrecoverable — Step 2 stripping handles at read time)
- Migration script: `scripts/migrate-base64-saved-meals.ts` (idempotent, safe to rerun)
