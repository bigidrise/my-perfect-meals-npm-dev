# Production Deployment Handoff Guide

## Critical Context: January 2026 Incident

Production was silently serving fallback meals instead of AI-generated content because `server/prod.ts` was missing an environment variable alias that `server/index.ts` had.

### The Problem

The development entrypoint (`server/index.ts`) had this critical code:

```typescript
if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
}
```

The production entrypoint (`server/prod.ts`) was missing this alias, causing AI features to fail silently.

## Detection: How to Know if AI is Working

**If meal generation takes less than 3 seconds, AI is NOT working** - fallback meals are being served.

Real AI generation times:
- Craving Creator: 15-30 seconds
- Fridge Rescue: 15-30 seconds  
- Create With Chef: 15-30 seconds

## Critical Files

| File | Purpose |
|------|---------|
| `server/prod.ts` | Production entrypoint - MUST have env aliases |
| `server/index.ts` | Development entrypoint |

**Both entrypoints MUST stay in sync** - any drift causes silent failures.

## Verification Steps

### 1. Check Health Endpoint

```bash
curl https://your-deployed-url/api/health
```

Expected response:
```json
{
  "ok": true,
  "hasOpenAI": true,
  "openAIKeyLength": 164,
  "isDeployment": true
}
```

### 2. Red Flags to Watch For

- `hasOpenAI: false` in health check
- `openAIKeyLength: 0`
- Instant meal generation (< 3 seconds)
- `🚨 FALLBACK ALERT` in server logs

### 3. Pre-Deployment Verification

Before any deployment:
1. Verify `server/prod.ts` has the OPENAI_API_KEY alias
2. Test locally with `NODE_ENV=production npm run build && node dist/prod.js`
3. After deploy, hit `/api/health` and confirm `hasOpenAI: true`
4. Test actual meal generation and verify it takes 15-30 seconds

## Environment Variables

The following secrets MUST be in production:
- `OPENAI_API_KEY` (or `VITE_OPENAI_API_KEY` which gets aliased)
- `DATABASE_URL`
- `SESSION_SECRET`

## Common Mistakes

1. **Forgetting to add secrets to production deployment** - Replit secrets don't auto-copy to deployments
2. **Editing only one entrypoint** - Both `index.ts` and `prod.ts` must have the same env setup
3. **Not testing after deploy** - Always verify AI is working, not just that the server starts
