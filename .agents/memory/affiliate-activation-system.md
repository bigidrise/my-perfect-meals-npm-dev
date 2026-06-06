---
name: Affiliate Activation System
description: Architecture of the MPM Affiliate Certification → Rewardful activation system — tracks, triggers, eligibility, and webhook endpoint.
---

# Affiliate Activation System

## Track model
- `social_affiliate` — phase 1 only (affiliate_social cert complete → activate)
- `business_affiliate` — phase 1 + 2 (affiliate_social AND platform both complete → activate)
- Upgrade allowed: social → business (if not yet activated). Never downgrade.

## DB table
`user_affiliate_accounts` — see `server/db/schema/affiliateAccounts.ts`

## Trigger point
`certificationRoutes.ts` complete endpoint calls `evaluateAffiliateActivation(userId)` non-blocking after every cert completion. Never throws — cert must succeed even if affiliate activation fails.

## Eligibility gate (business track)
`server/services/affiliateEligibility.ts` — requires isProCare=true + active studio + physician license verified. Called server-side on register-track and in the eligibility modal on the frontend.

## Rewardful API
- Campaign ID stored in `REWARDFUL_CAMPAIGN_ID` env secret
- API Secret in `REWARDFUL_API_SECRET`
- 422 on create = email already exists → look up by email and return existing affiliate
- SSO magic link via `GET /v1/affiliates/:id/sso`

## Webhook endpoint
`POST /api/webhooks/rewardful` — HMAC verified when `REWARDFUL_WEBHOOK_SECRET` is set. Without it, all events accepted (fine for dev).
Production URL: `https://www.myperfectmeals.com/api/webhooks/rewardful`

**Why:** Rewardful state changes (suspend/delete affiliate) must sync back to MPM so access can be revoked without a code deploy.

## Eligibility UX modal
When non-eligible user clicks Business path → modal with "Become a Coach" → `/procare-welcome?role=trainer&returnTo=...`, "Become a Physician" → `/physician-welcome?returnTo=...`, "Learn More" → `/procare-info`, "Cancel". Return path saved in `localStorage.mpm.affiliate.returnPath`.
