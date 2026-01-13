# My Perfect Meals - Release Checklist

## Pre-Deployment Health Check (Required Before Every Release)

This checklist ensures the app is functioning correctly before pushing to production or iOS.

---

## Automated Preflight Script (Recommended)

Run this script before every deployment:

```bash
./scripts/preflight.sh https://your-deployed-url.replit.app
```

This automatically checks:
- Build completion
- Health endpoint response
- OpenAI connection
- S3 configuration
- Fallback usage

If any check fails, the script exits with an error - do not deploy until all checks pass.

---

## Quick 60-Second Pre-Flight Check (Manual)

### 1. Build Fresh
```bash
npm run build
```
Verify: No errors, build completes successfully.

### 2. Health Endpoint Check
After deploying, visit:
```
https://[your-deployed-url]/api/health
```

**Required values:**
- `hasOpenAI: true` ← If false, OpenAI is NOT connected!
- `openAIKeyLength: 51` (or similar non-zero number)
- `hasDatabase: true`

### 3. Create With Chef Test
In the deployed app:
1. Go to Weekly Meal Builder
2. Use "Create With Chef" to request a specific meal (e.g., "French toast with bacon")
3. **Verify timing:** Should take 15-30 seconds (AI generation time)
4. **Verify result:** Meal name matches your request
5. **Verify image:** Shows an S3 URL (https://...s3...amazonaws.com/...)

**Red Flag:** If generation is INSTANT (< 2 seconds), AI is NOT working - you're seeing fallback meals!

### 4. Image Verification
Check that meal images load correctly and use S3 URLs:
- Correct: `https://my-perfect-meals-images.s3.us-east-2.amazonaws.com/meal-images/...`
- Wrong: `/public-objects/...` (old Replit storage - won't work in production)

---

## iOS Pre-Submission Checklist

Before submitting to Apple App Store:

### Required
- [ ] All Quick Pre-Flight checks pass
- [ ] TestFlight build connects to production URL
- [ ] Create With Chef works on iOS device/simulator
- [ ] Meal images load correctly on iOS
- [ ] StoreKit products load (mpm_basic_999_v2, mpm_premium_1999, mpm_ultimate_2999)
- [ ] No console errors about missing API keys

### Recommended
- [ ] Check production logs for any 🚨 FALLBACK ALERT messages
- [ ] Verify boot logs show `[BOOT] OpenAI enabled: true`

---

## What To Do If Something Fails

### OpenAI Not Connected (`hasOpenAI: false`)
1. Check if `VITE_OPENAI_API_KEY` secret exists
2. Verify `server/prod.ts` has the aliasing code
3. Rebuild and redeploy

### Instant Meal Generation (No AI)
1. Check `/api/health` for `hasOpenAI`
2. Look for 🚨 FALLBACK ALERT in logs
3. Verify OpenAI API key is valid and has credits

### Images Not Loading
1. Check S3 credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME)
2. Verify S3 bucket has public read access
3. Check image URLs are absolute (https://...) not relative (/public-objects/...)

---

## Release History

| Date | Version | Notes |
|------|---------|-------|
| Jan 2026 | 1.0.0 | Added OpenAI aliasing to prod.ts, migrated to S3 images |

---

## Critical Files

These files must stay in sync:
- `server/prod.ts` - Production entry point
- `server/index.ts` - Development entry point

Both must have:
```typescript
if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
}
```
