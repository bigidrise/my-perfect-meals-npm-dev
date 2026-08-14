# Billing Enforcement Audit — Pre-Premier Launch

**Date:** August 14, 2026  
**Auditor:** Replit Agent

---

## Summary

`BILLING_ENFORCED` is the single flag that controls the entire paywall. When it is `false` or unset, every user receives `PAID_FULL` access regardless of plan or trial status.

| Check | Status |
|-------|--------|
| Secret exists in Replit Secrets panel | ✅ Confirmed |
| Dev env var is `"true"` | ✅ Confirmed |
| Dev health endpoint: `billingEnforced: true` | ✅ Verified live on August 14, 2026 |
| Expired-trial returns `FREE` (unit tests) | ✅ 48/48 pass |
| Health-handler source-scan tests | ✅ Added (`server/tests/healthEndpoint.test.ts`) |
| Production health endpoint: `billingEnforced` | ⚠️ Field absent — production is running pre-deploy code. Must redeploy and re-check (see below). |

---

## Evidence

### 1. Secret existence

`viewEnvVars({ keys: ["BILLING_ENFORCED"] })` returned:

```json
{ "secrets": { "BILLING_ENFORCED": true } }
```

Replit secrets apply to **all environments** (development and production). The secret exists and is non-empty.

### 2. Development env var

`viewEnvVars({ environment: "development", keys: ["BILLING_ENFORCED"] })` returned:

```json
{ "envVars": { "development": { "BILLING_ENFORCED": "true" } } }
```

### 3. Dev domain health check — confirmed `billingEnforced: true`

```bash
curl https://379eabec-1527-4de0-99b0-f3d40f5cfdad-00-2g5s7ko8rwtcf-muyx111l.spock.replit.dev/api/health
```

Result (August 14, 2026):

```json
{ "ok": true, "billingEnforced": true, "env": "development" }
```

### 4. Production health check — pending redeploy

```bash
curl https://my-perfect-meals-npm-dev-1.replit.app/api/health
```

Result (August 14, 2026, **pre-deploy**):

```json
{ "ok": true, "env": "production", "isDeployment": true }
```

`billingEnforced` is absent because the production server is running code from before this task's changes were merged. After the next deployment, this endpoint will include the field.

**Required action before Premier onboarding:** redeploy the app, then run:

```bash
curl https://my-perfect-meals-npm-dev-1.replit.app/api/health | jq .billingEnforced
# Expected: true
# If false: BILLING_ENFORCED secret is wrong — set to "true" in Replit Secrets and redeploy.
```

---

## Why the production value is almost certainly `"true"` already

1. Replit secrets are shared across environments. The secret is set and non-empty in the panel.
2. The dev environment confirms `billingEnforced: true` from the same secret value.
3. The platform has been in use with paying subscribers — a `false` value would grant all users PAID_FULL, which would have been immediately visible as a billing failure.
4. The access-tier unit tests (48 pass) confirm the enforcement logic is correct when the flag is `"true"`.

---

## Code logic

**`server/lib/accessTier.ts`**
```typescript
const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";
if (!BILLING_ENFORCED) return "PAID_FULL"; // pre-launch bypass
```

**`server/services/effectiveAccess.ts`**
```typescript
const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";
if (user.isFounder || (!BILLING_ENFORCED && user.isSandbox)) { ... }
```

When enforced:

| User state | Access tier |
|------------|-------------|
| Founder | `PAID_FULL` (permanent) |
| Active paid plan | `PAID_FULL` |
| Active trial (`trialEndsAt` in future) | `PAID_FULL` |
| **Expired trial** | **`FREE`** |
| No plan, no trial | `FREE` |

---

## Risk

| `BILLING_ENFORCED` value | Effect |
|--------------------------|--------|
| `"true"` | Paywall active. Expired and free accounts are gated. |
| `"false"` or unset | **All users receive `PAID_FULL`.** Revenue and compliance risk. |

---

*Run the production health check after each deployment and update this document.*
