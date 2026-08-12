---
name: Object Storage Architecture (active)
description: Current working image storage path, bucket info, and why the old signed-URL path is dead.
---

## Active Architecture

`permanentImageStorage.ts` — S3 primary (403, broken IAM) → `@replit/object-storage` Client fallback (WORKING).

**Why `@replit/object-storage` Client, not signed-URL:**
The sidecar's `/object-storage/signed-object-url` returns 401 and is NOT fixable in code — it requires platform-level auth not available to server processes. The `@replit/object-storage` Client auto-discovers the bucket via `/object-storage/default-bucket` and authenticates via the GCS SDK credential flow (`/credential` + `/token` endpoints). This is the only working upload path.

**Active bucket:** `replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b` (display name: "FuzzyOrdinaryWebmaster")

**Why the old bucket stopped working:** The bucket `replit-objstore-e02a723e-40e9-4d89-9c0e-05adfa185d2d` became disconnected from the repl. The sidecar returned "no allowed resources" on all token requests. Creating a new bucket fixed it instantly.

**Public URL format:** `/public-objects/<bucket-id>/<object-path>`  
Example: `/public-objects/replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b/meal-images/foo.png`

**Route fix:** `/public-objects/` handler in routes.ts now fast-paths any URL starting with `replit-objstore-` by parsing bucket+object directly from the URL path, bypassing the `PUBLIC_OBJECT_SEARCH_PATHS` prepend. Legacy search-path behavior is preserved for other URLs.

**Env vars:** `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR` still reference the OLD bucket — they were NOT auto-updated by Replit when the new bucket was created. These matter for the legacy search-path and private-object paths, but NOT for new-format URLs. Updating them is Step 4 scope.

**S3 is still broken:** HTTP 403 (IAM policy). Not fixed. Fallback to Object Storage is the production path until S3 is repaired.

## Step 3B Migration Result

- 54 base64 images migrated → 0 remaining in DB
- 0 failures
- DB payload: 103 MB → 0.257 MB  
- 17 DALL-E CDN records left as-is (expired, unrecoverable — Step 2 stripping handles at read time)
- Migration script: `scripts/migrate-base64-saved-meals.ts` (idempotent, safe to rerun)
