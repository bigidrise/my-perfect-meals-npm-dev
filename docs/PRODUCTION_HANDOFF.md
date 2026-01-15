# My Perfect Meals - Production Deployment Handoff

**Last Updated:** January 2026

This document provides complete context for any agent working on the production deployment of My Perfect Meals. Read this before making any changes to deployment, server configuration, or AI-related code.

---

## 1. Critical Incident: The January 2026 OpenAI Fallback Bug

### What Happened
Production deployed and appeared functional, but **all meal generation was serving instant fallback meals** (generic recipes like "Mediterranean Breakfast Bowl" with mismatched pancake images) instead of real AI-generated content.

### Root Cause
The production entrypoint (`server/prod.ts`) was missing a critical environment variable alias that the development entrypoint (`server/index.ts`) had:

```typescript
// This line was MISSING in prod.ts:
if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
}
```

Replit stores the API key as `VITE_OPENAI_API_KEY` (for client-side Vite builds), but the server code looks for `OPENAI_API_KEY`. Without aliasing, production silently fell back to static fallback meals.

### Why It Was Hard to Detect
- The app didn't crash - it gracefully served fallback meals
- No error messages in logs (fallback is designed as a safety feature)
- Users saw "real-looking" meals, just not personalized AI ones
- Generation was instant (should take 15-30 seconds)

---

## 2. How to Detect This Problem

### Red Flag: Instant Meal Generation
| Generation Time | Status |
|-----------------|--------|
| **< 3 seconds** | 🚨 FALLBACK - AI not working! |
| **15-30 seconds** | ✅ Real AI generation |

### Check the Health Endpoint
```bash
curl https://YOUR-DEPLOYED-URL/api/health
```

**Healthy response:**
```json
{
  "hasOpenAI": true,
  "openAIKeyLength": 164,
  "hasS3": true,
  "aiHealth": {
    "fallbacksUsed": 0,
    "healthy": true
  }
}
```

**Unhealthy indicators:**
- `hasOpenAI: false` - OpenAI key not configured
- `openAIKeyLength: 0` - Key is empty
- `fallbacksUsed > 0` - Fallbacks have been served
- `healthy: false` - AI is not working

### Check Server Logs for Boot Status
Look for `[BOOT]` entries at server startup:
```
[BOOT] OpenAI enabled: true
[BOOT] OpenAI key length: 164
[BOOT] S3 bucket: my-perfect-meals-images
```

### Watch for Fallback Alerts
When fallback meals are served, logs will show:
```
🚨 FALLBACK ALERT: Using fallback meals (AI unavailable)
```

---

## 3. Safety Systems Implemented

### 3.1 Shared Environment Bootstrap
**File:** `server/bootstrap/envSetup.ts`

Both `server/index.ts` (dev) and `server/prod.ts` (production) now import this shared module. It ensures:
- `VITE_OPENAI_API_KEY` is aliased to `OPENAI_API_KEY`
- Boot-time health logging is consistent
- Environment validation is centralized

**Critical:** Both entrypoints MUST import this file. If they drift apart, the bug will recur.

### 3.2 Boot-Time Health Logging
On server startup, critical service status is logged:
```
========================================
[BOOT] My Perfect Meals - Production Server
[BOOT] OpenAI enabled: true
[BOOT] OpenAI key length: 164
[BOOT] Database URL present: true
[BOOT] S3 bucket: my-perfect-meals-images
========================================
```

### 3.3 Fallback Usage Tracking
**File:** `server/services/fallbackMealService.ts`

Tracks every time a fallback meal is served and exposes stats via `/api/health`:
- `fallbacksUsed`: Total count of fallback meals served
- `lastFallback`: Timestamp of most recent fallback
- `healthy`: Boolean indicating if AI is working

### 3.4 Enhanced Health Endpoint
**Route:** `GET /api/health`

Returns comprehensive status including:
- OpenAI connection status and key length
- S3 storage configuration
- AI health statistics
- Fallback usage counters

### 3.5 Automated Preflight Script
**File:** `scripts/preflight.sh`

Run before every deployment:
```bash
./scripts/preflight.sh https://your-deployed-url.replit.app
```

This script:
1. Builds the application
2. Checks health endpoint
3. Verifies OpenAI connection
4. **Tests actual AI generation** - sends a real request and times it
5. Compares fallback count before/after to detect silent failures

If generation completes in < 3 seconds, the script FAILS and blocks deployment.

### 3.6 Release Checklist
**File:** `docs/RELEASE_CHECKLIST.md`

Step-by-step verification guide for pre-deployment checks.

---

## 4. Critical Files That Must Stay In Sync

| File | Purpose | Sync Requirement |
|------|---------|------------------|
| `server/prod.ts` | Production entrypoint | Must import `./bootstrap/envSetup` |
| `server/index.ts` | Development entrypoint | Must import `./bootstrap/envSetup` |
| `server/bootstrap/envSetup.ts` | Shared env configuration | Single source of truth for env aliasing |

**Never add environment variable handling to just one entrypoint.** Always use the shared bootstrap module.

---

## 5. How to Verify Production Health

### Quick Check (30 seconds)
```bash
# 1. Check health endpoint
curl https://YOUR-URL/api/health | jq

# Look for:
# - hasOpenAI: true
# - openAIKeyLength > 0
# - aiHealth.healthy: true
```

### Full Verification (2 minutes)
```bash
# Run the automated preflight script
./scripts/preflight.sh https://YOUR-URL
```

### Manual AI Test
1. Open the app
2. Go to any meal builder (Weekly Meal Board, etc.)
3. Use "Create With Chef" to generate a meal
4. Time how long it takes:
   - **15-30 seconds** = AI working ✅
   - **< 3 seconds** = Fallback! 🚨

---

## 6. What To Do If Things Break

### If `hasOpenAI: false`
1. Check if `VITE_OPENAI_API_KEY` is set in Replit Secrets
2. Verify `server/prod.ts` imports `./bootstrap/envSetup`
3. Check that `server/bootstrap/envSetup.ts` exists and has the aliasing logic
4. Redeploy

### If `fallbacksUsed > 0`
1. Check server logs for `🚨 FALLBACK ALERT` entries
2. Look for OpenAI API errors (rate limits, invalid key, server errors)
3. Verify OpenAI API key is valid and has credits
4. Check if this is a transient OpenAI outage (their 500 errors)

### If Images Don't Load
1. Check `hasS3: true` in health endpoint
2. Verify `S3_BUCKET_NAME` and `AWS_ACCESS_KEY_ID` are set
3. Check for DALL-E 500 errors in logs (OpenAI issue, not ours)
4. Images may have failed to upload - check `permanentImageStorage.ts` logs

### If Generation Is Instant
This is the critical symptom of the January 2026 bug:
1. **Stop deploying immediately**
2. Check `/api/health` for `hasOpenAI: false`
3. Run `./scripts/preflight.sh` to diagnose
4. Compare `server/prod.ts` with `server/index.ts` for drift
5. Ensure both import the shared bootstrap module

---

## 7. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_OPENAI_API_KEY` | Yes | OpenAI API key (aliased to OPENAI_API_KEY at runtime) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `S3_BUCKET_NAME` | Yes | AWS S3 bucket for meal images |
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials for S3 |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials for S3 |
| `AWS_REGION` | Yes | AWS region (e.g., us-east-1) |

---

## 8. Common Misunderstandings

### "The app is working, meals are showing"
Not sufficient! Check if generations take 15-30 seconds. Fallback meals look real but are generic and don't match user requests.

### "There are no errors in the logs"
Fallback is a graceful degradation - it won't error. Look for `🚨 FALLBACK ALERT` or check the health endpoint.

### "I only changed prod.ts, index.ts doesn't matter"
**Wrong!** Both files must stay in sync. Any env handling logic should go in the shared bootstrap module.

### "OpenAI returned a 500 error - we have a bug"
Not necessarily. OpenAI's DALL-E service has transient 500 errors. If the meal TEXT generates but the image fails, that's an OpenAI server issue. The meal is still created correctly - just without an image.

---

## 9. Summary

1. **Always use the shared bootstrap module** for environment setup
2. **Check `/api/health`** before and after every deployment
3. **Run the preflight script** (`./scripts/preflight.sh`) before deploying
4. **Watch for instant generation** - it means fallbacks are being used
5. **Monitor for 🚨 FALLBACK ALERT** in logs
6. **When in doubt, time a meal generation** - real AI takes 15-30 seconds

---

*This document should be read by any agent working on production deployment issues for My Perfect Meals.*
