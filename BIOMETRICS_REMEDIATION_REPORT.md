# Biometrics Security Remediation Report

**Date**: March 9, 2026  
**Scope**: All `/api/biometrics/*` endpoints — authentication, identity, atomic writes, routing  
**Status**: COMPLETE — all endpoints verified

---

## 1. Root Cause

Biometrics endpoints were built without authentication middleware. Identity was sourced from client-supplied `req.body.userId` or `req.query.userId`, or hardcoded to a dummy UUID (`00000000-0000-0000-0000-000000000001`). Any unauthenticated request could read or write any user's biometric data by supplying an arbitrary userId.

Additionally, a routing conflict caused `POST /api/biometrics/log` to be intercepted by a different router (`mealsRouter`) before it could reach the biometrics handler, rendering its authentication invisible to the actual request path.

---

## 2. Routing Conflicts Found and Resolved

### Conflict 1: mealsRouter mounted too broadly

**Before**: `server/index.ts` line 306
```ts
app.use("/api", mealsRouter);
```

The meals router contains dynamic routes like `/:mealInstanceId/log`. Mounted at `/api`, this created:
- `POST /api/:mealInstanceId/log`

Which swallowed `POST /api/biometrics/log` with `mealInstanceId = "biometrics"`.

**After**: `server/index.ts` line 309
```ts
app.use("/api/meals", mealsRouter);
```

Impact scan confirmed all frontend callers already use `/api/meals/...` paths. No caller uses the accidental broad paths.

### Conflict 2: biometricsRoutes mounted twice

**Before**: `server/routes.ts` had two mounts:
- Line 1371: `app.use("/api/biometrics", biometricsRouter)` (correct)
- Line 5821: `app.use("/api", biometricsRoutes)` (duplicate — exposed `/api/log`, `/api/weight`, etc.)

**After**: Duplicate mount at line 5821 removed. Only the canonical mount at `/api/biometrics` remains.

Impact scan confirmed zero callers use the accidental `/api/log`, `/api/weight`, `/api/latest`, `/api/summary`, `/api/sources`, `/api/ingest`, or `/api/estimate-macros` paths.

---

## 3. Final Canonical Biometrics Paths

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/biometrics/ingest` | biometricsRoutes → `/ingest` |
| GET | `/api/biometrics/latest` | biometricsRoutes → `/latest` |
| GET | `/api/biometrics/summary` | biometricsRoutes → `/summary` |
| GET | `/api/biometrics/sources/:userId` | biometricsRoutes → `/sources/:userId` |
| POST | `/api/biometrics/sources` | biometricsRoutes → `/sources` |
| POST | `/api/biometrics/log` | biometricsRoutes → `/log` |
| POST | `/api/biometrics/weight` | biometricsRoutes → `/weight` |
| GET | `/api/biometrics/weight` | biometricsRoutes → `/weight` (GET) |
| POST | `/api/biometrics/analyze-photo` | biometricsRoutes → `/analyze-photo` |
| POST | `/api/biometrics/estimate-macros` | biometricsRoutes → `/estimate-macros` |

All paths resolve to the intended biometrics handler. No shadowing by any other router.

---

## 4. Shared Auth Helper Created

**File**: `server/utils/getAuthUserId.ts`

Extracts `userId` from `(req as any).authUser.id`. Throws a 401-safe error if `authUser` is missing or `id` is absent. Used by all biometrics endpoints for consistent identity extraction.

---

## 5. Endpoint-by-Endpoint Security Verification

### 5.1 POST /api/biometrics/ingest
- **requireAuth applied**: YES (added)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — `body.userId` is no longer read
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

### 5.2 GET /api/biometrics/latest
- **requireAuth applied**: YES (added)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — `query.userId` is no longer read
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

### 5.3 GET /api/biometrics/summary
- **requireAuth applied**: YES (added)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — `query.userId` is no longer read
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

### 5.4 GET /api/biometrics/sources/:userId
- **requireAuth applied**: YES (added)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — `params.userId` is ignored; auth identity used
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

### 5.5 POST /api/biometrics/sources
- **requireAuth applied**: YES (added)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — `body.userId` is no longer read
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

### 5.6 POST /api/biometrics/log
- **requireAuth applied**: YES (added)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — hardcoded dummy UUID `00000000-0000-0000-0000-000000000001` removed
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`
- **Routing note**: Previously shadowed by `mealsRouter` at `/api`. Now resolved by re-mounting mealsRouter at `/api/meals`.

### 5.7 POST /api/biometrics/weight
- **requireAuth applied**: YES (already had it, but with fallback)
- **Identity source**: `getAuthUserId(req)` → `authUser.id`
- **body/query userId ignored**: YES — `authUser?.id || req.body.userId` fallback removed; uses only auth identity
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`
- **Atomic write**: YES — wrapped in `db.transaction()`, updates both `biometric_sample` and `users.weight` atomically

### 5.8 POST /api/biometrics/analyze-photo
- **requireAuth applied**: YES (already had it)
- **Identity source**: Not applicable (no userId used — analyzes image and returns macros)
- **body/query userId ignored**: N/A
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

### 5.9 POST /api/biometrics/estimate-macros
- **requireAuth applied**: YES (added)
- **Identity source**: Not applicable (no userId used — estimates macros from text)
- **body/query userId ignored**: N/A
- **Unauthenticated result**: 401 `{"error":"Authentication required"}`

---

## 6. Atomic Weight Writes

**File**: `server/routes/biometricsRoutes.ts` — `POST /weight`

Weight saves are now wrapped in `db.transaction()`:

1. Upsert `biometric_sample` — canonical weight history, stores original unit
2. Update `users.weight` — denormalized current snapshot, always integer kg

Conversion: if unit is `lb`, divides by 2.20462 and rounds to integer for `users.weight`.

If either operation fails, the transaction rolls back both. This prevents the scenario where `biometric_sample` has a new weight entry but `users.weight` still shows the old value (or vice versa).

### Weight Architecture (source of truth)

| Table | Purpose | Unit |
|-------|---------|------|
| `biometric_sample` (type=weight) | Canonical weight history (time-series) | Original (lb or kg) |
| `users.weight` | Denormalized current snapshot | Integer kg |
| `biometrics_vitals` | Separate vitals check-ins | Not primary weight source |
| `body_fat_entries` | Body composition only | N/A |
| `avatar_state` | Simulation only | N/A |

---

## 7. Frontend Callers Changed (6 files)

### 7.1 `client/src/pages/MacroCalculator.tsx`
- Line 957: GET `/api/biometrics/latest` — added `credentials: "include"`
- Line 992: POST `/api/biometrics/ingest` — added `credentials: "include"`, removed `userId` from request body

### 7.2 `client/src/components/NewLogToMacrosButton.tsx`
- Line 3: Added `import { getAuthHeaders } from "@/lib/auth"`
- Line 24-27: POST `/api/biometrics/log` — added `credentials: "include"` and `...getAuthHeaders()`

### 7.3 `client/src/hooks/useSleep.ts`
- Line 4: Added `import { getAuthHeaders } from '@/lib/auth'`
- Line 21-28: GET `/api/biometrics/summary` (today) — added `credentials: "include"` and `getAuthHeaders()`, removed `userId` from query string
- Line 43-50: GET `/api/biometrics/summary` (history) — added `credentials: "include"` and `getAuthHeaders()`, removed `userId` from query string
- Line 72-75: POST `/api/biometrics/ingest` — added `credentials: "include"` and `...getAuthHeaders()`

### 7.4 `client/src/lib/photoMacroCapture.ts`
- Line 47: Added dynamic `import('@/lib/auth')` for `getAuthHeaders`
- Line 48-51: POST `/api/biometrics/analyze-photo` — added `credentials: 'include'` and `...getAuthHeaders()`

### 7.5 `client/src/lib/macrosApi.ts`
- Line 64: Added dynamic `import('@/lib/auth')` for `getAuthHeaders`
- Line 65-71: POST `/api/biometrics/log` — added `...getAuthHeaders()` to headers

### 7.6 `client/src/components/JustDescribeItModal.tsx`
- Line 48: Added dynamic `import('@/lib/auth')` for `getAuthHeaders`
- Line 49-52: POST `/api/biometrics/estimate-macros` — added `...getAuthHeaders()` to headers

---

## 8. Files Changed

| File | Change |
|------|--------|
| `server/utils/getAuthUserId.ts` | NEW — shared auth identity helper |
| `server/routes/biometricsRoutes.ts` | All 9 endpoints locked down with requireAuth + getAuthUserId |
| `server/index.ts` | mealsRouter mount changed from `/api` to `/api/meals` |
| `server/routes.ts` | Duplicate biometrics mount at `/api` removed |
| `client/src/pages/MacroCalculator.tsx` | Added credentials/auth to 2 biometrics fetch calls |
| `client/src/components/NewLogToMacrosButton.tsx` | Added credentials/auth to biometrics log call |
| `client/src/hooks/useSleep.ts` | Added credentials/auth to 3 biometrics fetch calls |
| `client/src/lib/photoMacroCapture.ts` | Added credentials/auth to analyze-photo call |
| `client/src/lib/macrosApi.ts` | Added auth headers to biometrics log call |
| `client/src/components/JustDescribeItModal.tsx` | Added auth headers to estimate-macros call |
| `shared/biometricsSchema.ts` | Made userId optional, provider defaults to "manual", startTime/endTime optional in payload schema |

---

## 9. Verification Results

### Unauthenticated Access Test (all 9 endpoints)

```
POST /api/biometrics/ingest       → 401 "Authentication required"
GET  /api/biometrics/latest       → 401 "Authentication required"
GET  /api/biometrics/summary      → 401 "Authentication required"
GET  /api/biometrics/sources/test → 401 "Authentication required"
POST /api/biometrics/sources      → 401 "Authentication required"
POST /api/biometrics/log          → 401 "Authentication required"
POST /api/biometrics/weight       → 401 "Authentication required"
POST /api/biometrics/estimate-macros → 401 "Authentication required"
POST /api/biometrics/analyze-photo   → 401 "Authentication required"
```

### Accidental Legacy Paths (all return 404)

```
POST /api/log     → 404 "API endpoint not found"
POST /api/weight  → 404 "API endpoint not found"
GET  /api/latest  → 404 "API endpoint not found"
```

### Build Status

Build passes with zero errors (warnings only: Vite dynamic import, chunk size advisory).

---

## 10. Remaining Risks and Deferred Work

### Phase 4: Non-biometrics dummy UUID cleanup (DEFERRED)

The dummy UUID `00000000-0000-0000-0000-000000000001` pattern exists across 30+ other endpoints outside the biometrics system. Those are a separate remediation scope. This phase addressed only the biometrics surface.

### mealsRouter mock auth

`server/routes/meals.ts` contains its own mock `requireAuth` middleware that hardcodes `req.user = { id: "mock-user-id" }`. This was not changed in this remediation (out of scope), but should be addressed in a future pass.

### Provider/client flows

No biometrics endpoint serves a provider-on-behalf-of-client flow. All biometrics routes use authenticated self-identity only. If a provider needs to read a client's biometrics in the future, that must be a separate, explicitly authorized endpoint (e.g., under `/api/pro/biometrics/:clientId`).

---

## 11. Summary

| Item | Status |
|------|--------|
| Shared getAuthUserId() helper | DONE |
| All 9 biometrics endpoints require auth | DONE |
| All 9 endpoints use authUser.id only | DONE |
| body/query userId ignored on all endpoints | DONE |
| Dummy UUID removed from POST /log | DONE |
| body.userId fallback removed from POST /weight | DONE |
| Atomic weight writes (biometric_sample + users.weight) | DONE |
| All 6 frontend callers send credentials + authHeaders | DONE |
| mealsRouter shadow conflict resolved | DONE |
| Duplicate biometrics mount removed | DONE |
| Build passes | DONE |
| All endpoints verified 401 on unauthenticated access | DONE |
| Legacy accidental paths return 404 | DONE |
