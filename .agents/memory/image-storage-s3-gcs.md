---
name: Image storage S3→GCS fallback
description: S3 is configured but blocked by IAM policy; Replit Object Storage (GCS) is the working permanent image store.
---

## The rule
`permanentImageStorage.ts` now tries S3 first, then falls back to Replit Object Storage (GCS via sidecar at `http://127.0.0.1:1106`). Never rely on S3 alone.

## Why
AWS S3 bucket returns 403 Forbidden on every `PutObject` call (IAM permissions issue). The AWS SDK v3 XML parser then crashes with `[EntityReplacer] Invalid character '#' in entity name: "#xD"` — a known bug where the SDK can't parse CRLF-containing XML error responses — so the real HTTP 403 was invisible in logs. The code fell back to returning a raw ~2MB base64 `data:` URI which most `<img>` components and localStorage can't handle.

## How to apply
- S3 upload attempt is still first (if it ever gets unblocked, it works automatically)
- On any S3 error, fall back to: parse `PUBLIC_OBJECT_SEARCH_PATHS` → upload buffer to GCS bucket → return `/public-objects/meal-images/<filename>`
- The `/public-objects/*` route in `server/routes.ts` (line ~381) serves these files via `ObjectStorageService.searchPublicObject()`
- `isS3Url()` in `mealImageGenerator.ts` includes `/public-objects/` so GCS URLs hit the DB cache
- `imageLifecycle.ts` already lists `/public-objects/` as a first-party prefix — no changes needed there
