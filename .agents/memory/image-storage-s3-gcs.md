---
name: Image storage S3→GCS fallback
description: S3 blocked by IAM; GCS via sidecar signed-URL is the correct fallback — NOT file.save() through the GCS SDK.
---

## The rule
`permanentImageStorage.ts` tries S3 first, then falls back to Replit Object Storage using the sidecar signed-URL approach. **Never use `@google-cloud/storage` file.save() for writes** — the external_account credential config points to the sidecar's `/token` endpoint which does not implement the STS protocol; Google STS rejects every exchange with "no allowed resources".

## Why (confirmed via live diagnostic — July 2026)
- **S3**: HTTP 403 IAM on every PutObject. AWS key lacks `s3:PutObject` on `my-perfect-meals-images`. Needs AWS console fix.
- **GCS file.save()**: STS token exchange fails. `StsCredentials.exchangeToken` at `sidecar/token` → Google STS returns 401 "no allowed resources". This path has never worked for writes.
- **GCS sidecar signed-URL** (correct path): POST to `http://127.0.0.1:1106/object-storage/signed-object-url` → returns a pre-signed GCS PUT URL → direct HTTP PUT with the image buffer. No SDK auth required. Returns 401 in dev (REPLIT_IDENTITY not present in dev container), works in production.

## How to apply
- GCS fallback uses sidecar signed-URL: POST `{bucket_name, object_name, method:"PUT", expires_at}` → `{signed_url}` → PUT buffer to signed_url
- This is the same mechanism `objectStorage.ts` uses for `signObjectURL()` throughout the app
- S3 upload attempt is still first — if IAM is ever fixed, it works automatically
- Return path is `/public-objects/meal-images/<filename>` served by `ObjectStorageService.searchPublicObject()`
- `isS3Url()` in `mealImageGenerator.ts` includes `/public-objects/` so GCS URLs hit the DB cache

## proWeekBoard.ts processAllMealImagesForSave — known bug history
Had 3 simultaneous bugs (fixed July 2026):
1. Missing `mealName` arg → TypeError inside uploadImageToPermanentStorage, silently swallowed
2. Property mismatch: checked `result.processed`/`result.url`/`result.pending` but function returns `result.imageUrl`/`result.imagePending`/`result.ingestionAttempted` → meal.imageUrl was NEVER updated
3. No null guard: a failed upload would write null over a valid data: URL
Correct check: `if (result.ingestionAttempted && result.imageUrl)` to update, `else if (result.imagePending)` to count pending without erasing original URL.
