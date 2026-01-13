# Release Checklist

## Pre-Deployment

- [ ] Both `server/index.ts` and `server/prod.ts` have identical env variable aliases
- [ ] Run `npm run build` locally with no errors
- [ ] All secrets are configured in Replit Deployments > Variables

## Post-Deployment Verification

- [ ] Hit `/api/health` - confirm `hasOpenAI: true`
- [ ] Hit `/api/health` - confirm `openAIKeyLength > 0`
- [ ] Test Craving Creator - confirm generation takes 15-30 seconds
- [ ] Test Fridge Rescue - confirm generation takes 15-30 seconds
- [ ] Check server logs for `✅ [PROD] Aliased VITE_OPENAI_API_KEY`

## Red Flags (Stop and Investigate)

- `hasOpenAI: false`
- `openAIKeyLength: 0`
- Meal generation completes in < 3 seconds
- `🚨 FALLBACK ALERT` in logs
- No `✅ Aliased` message in startup logs

## Rollback Procedure

If AI is not working in production:
1. Check if `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY` is set in deployment secrets
2. Verify `server/prod.ts` has the env alias code
3. Redeploy after fixing
