# Weight & Biometrics System — Full Technical Audit

**Date:** March 9, 2026  
**Scope:** Complete audit of weight data flow, authentication, user ID sources, and data integrity risks  
**Status:** ANALYSIS ONLY — No code changes made

---

## 1. Weight Data Flow (End-to-End Pipeline)

### 1A. User Saves Weight (Manual Entry)

```
User enters weight on My Biometrics page
        ↓
client/src/pages/my-biometrics.tsx (line 1082)
  fetch(POST /api/biometrics/weight) with credentials + authHeaders
        ↓
server/routes/biometricsRoutes.ts (line 260)
  router.post('/weight', requireAuth, ...)
  userId = authUser.id || req.body.userId   ← FIXED (was dummy UUID)
        ↓
Upserts into: biometric_sample table
  (type='weight', value=lbs, unit='lb', startTime=date)
        ↓
Also updates: users.weight (line 330-345 in biometricsRoutes.ts)
```

### 1B. User Views Weight Graph

```
My Biometrics page loads
        ↓
client/src/pages/my-biometrics.tsx (line 1014)
  fetch(GET /api/biometrics/weight?range=365d) with credentials + authHeaders
        ↓
server/routes/biometricsRoutes.ts (line 362)
  router.get('/weight', requireAuth, ...)
  userId = authUser.id   ← FIXED (was dummy UUID fallback)
        ↓
Reads from: biometric_sample WHERE userId=X AND type='weight'
        ↓
Returns JSON { history: [...], latest, count }
        ↓
my-biometrics.tsx renders recharts graph
```

### 1C. Macro Calculator Saves Weight

```
User enters weight in Macro Calculator
        ↓
client/src/pages/MacroCalculator.tsx (line 988)
  fetch(POST /api/biometrics/ingest) with authHeaders (NO credentials)
        ↓
server/routes/biometricsRoutes.ts (line 13)
  router.post('/ingest', ...) — NO requireAuth
  userId = req.body.userId   ← FROM REQUEST BODY
        ↓
Writes to: biometric_sample table
```

### 1D. Pro/Coach Views Client Weight

```
Trainer Dashboard loads client weight
        ↓
client/src/components/pro/ProClientWeightSnapshot.tsx (line 145)
  fetch(GET /api/pro/clients/:clientId/biometrics/weight) with credentials + authHeaders
        ↓
server/routes/proBiometricsRoutes.ts
  requireAuth + requireBoardAccess
  userId = req.boardAccess.clientUserId   ← SECURE
        ↓
Reads from: biometric_sample WHERE userId=clientUserId AND type='weight'
```

---

## 2. User ID Source Audit — Every Biometrics Endpoint

### server/routes/biometricsRoutes.ts (mounted at /api/biometrics)

| Method | Path | requireAuth? | userId Source | CRITICAL? |
|--------|------|:------------:|--------------|:---------:|
| POST | `/ingest` | NO | `req.body.userId` | **YES** |
| GET | `/latest` | NO | `req.query.userId` | **YES** |
| GET | `/summary` | NO | `req.query.userId` | **YES** |
| GET | `/sources/:userId` | NO | `req.params.userId` | **YES** |
| POST | `/sources` | NO | `req.body.userId` | **YES** |
| POST | `/log` | NO | Hardcoded dummy UUID | **YES** |
| POST | `/weight` | YES | `authUser.id \|\| req.body.userId` | PARTIAL |
| GET | `/weight` | YES | `authUser.id` | OK |
| POST | `/analyze-photo` | YES | N/A | OK |
| POST | `/estimate-macros` | NO | N/A (pure AI) | LOW |

### server/routes/proBiometricsRoutes.ts (mounted at /api/pro)

| Method | Path | requireAuth? | userId Source | CRITICAL? |
|--------|------|:------------:|--------------|:---------:|
| GET | `/clients/:clientId/biometrics/weight` | YES + boardAccess | `req.boardAccess.clientUserId` | OK |

---

## 3. Dummy User ID Audit (00000000-0000-0000-0000-000000000001)

### Biometrics-Specific (Direct Impact on Weight Data)

| File | Line | Context | Production Impact |
|------|------|---------|-------------------|
| `server/routes/biometricsRoutes.ts` | 206 | `POST /log` — hardcoded userId for macro logging | **CRITICAL** — All macro logs go to dummy user |

### Other Server Routes (Indirect Impact)

| File | Lines | Context | Production Impact |
|------|-------|---------|-------------------|
| `server/routes/builderPlans.ts` | 11, 35, 67, 99, 126 | All Builder Plan CRUD — hardcoded userId | **CRITICAL** — All builder plans shared |
| `server/routes/meals.ts` | 234, 264, 292, 340 | Meal replacement endpoints | **CRITICAL** — Wrong user's meals |
| `server/routes/mealPlans.ts` | 35 | Meal plan generation | **CRITICAL** |
| `server/routes/mealPlans.routes.ts` | 27, 83 | Generate & current plan | **CRITICAL** |
| `server/routes/shoppingListV2.ts` | 37, 131, 150, 183, 209 | All shopping list CRUD | **CRITICAL** — Shared shopping lists |
| `server/routes/shoppingList.ts` | 19 | getUserId helper | **CRITICAL** |
| `server/routes/userMealPrefs.ts` | 12, 42 | Meal preferences get/set | **CRITICAL** |
| `server/routes/manualMacros.ts` | 30 | Macro logging default param | **CRITICAL** |
| `server/routes/familyRecipes.ts` | 19 | getUserId helper | **HIGH** |
| `server/routes/community.ts` | 74 | Comment posting | MEDIUM |
| `server/routes/alcohol-log.ts` | 10 | DEV_USER_ID constant | **HIGH** |
| `server/routes/procareRoutes.ts` | 23 | getUserId helper | **HIGH** |
| `server/routes/meal-plan-replace.ts` | 40 | Custom meal replacement | **HIGH** |
| `server/routes.ts` | 350, 548, 3083, 5098, 5113, 5246 | Various endpoints | **HIGH** |
| `server/middleware/studioAccess.ts` | 26 | getUserId helper | **HIGH** |
| `server/services/weeklyMealPlanningServiceC.ts` | 26 | Cafeteria plan generation | MEDIUM |
| `server/services/weeklyMealPlanningServiceB.ts` | 14 | Plan B meal engine | MEDIUM |

### Legitimate Uses (Apple Review / Demo)

| File | Line | Context | Status |
|------|------|---------|--------|
| `server/data/weekBoardsRepo.ts` | 79 | `APPLE_REVIEW_USER_ID` constant | OK — Intentional |
| `client/src/contexts/AuthContext.tsx` | 141 | Apple reviewer demo user | OK — Intentional |
| `client/src/hooks/useWeeklyBoard.ts` | 11 | Apple review header | OK — Intentional |
| `client/src/lib/api.ts` | 377, 401 | Legacy plan migration key | OK — Migration only |

---

## 4. Frontend Authentication Audit

| Component / File | Endpoint | credentials | authHeaders | Status |
|-----------------|----------|:-----------:|:-----------:|:------:|
| `my-biometrics.tsx` | GET `/api/biometrics/weight` | YES | YES | OK |
| `my-biometrics.tsx` | POST `/api/biometrics/weight` | YES | YES | OK |
| `MacroCalculator.tsx` | GET `/api/biometrics/latest` | NO | YES | **PARTIAL** |
| `MacroCalculator.tsx` | POST `/api/biometrics/ingest` | NO | YES | **PARTIAL** |
| `ProClientWeightSnapshot.tsx` | GET `/api/pro/clients/.../weight` | YES | YES | OK |
| `macrosApi.ts` | POST `/api/biometrics/log` | YES | NO | **PARTIAL** |
| `NewLogToMacrosButton.tsx` | POST `/api/biometrics/log` | NO | NO | **MISSING** |
| `JustDescribeItModal.tsx` | POST `/api/biometrics/estimate-macros` | YES | NO | **PARTIAL** |
| `useSleep.ts` | GET `/api/biometrics/summary` | NO | NO | **MISSING** |
| `useSleep.ts` | POST `/api/biometrics/ingest` | NO | NO | **MISSING** |
| `photoMacroCapture.ts` | POST `/api/biometrics/analyze-photo` | NO | NO | **MISSING** |

---

## 5. Weight Data Sources — Where Each Feature Gets Weight

| Feature | Source Table | Source Field | Notes |
|---------|-------------|-------------|-------|
| User profile weight | `users` | `weight` (integer, kg) | Baseline, updated on save |
| Weight graph history | `biometric_sample` | `value` WHERE `type='weight'` | Time-series, primary graph source |
| Macro Calculator input | `users` | `weight` | Pre-fills from profile |
| Macro Calculator save | `biometric_sample` | Via POST `/api/biometrics/ingest` | Writes new sample |
| Body composition page | `body_fat_entries` | `currentBodyFatPct` | Separate table for scans |
| Pro/Coach weight view | `biometric_sample` | Via `/api/pro/clients/.../weight` | Same data, pro access |
| Vitals tracking | `biometrics_vitals` | `weightKg` | Daily manual check-ins |
| FitLife simulation | `avatar_state` / `avatar_day` | `weightLbs` | Gamification feature |

### Table Interaction Notes

- `users.weight` is the **static profile weight** (set during onboarding/profile edit)
- `biometric_sample` is the **time-series weight** (weight graph, trend tracking)
- `biometrics_vitals` stores **daily vitals check-ins** (weight + blood pressure + waist)
- `body_fat_entries` stores **body composition scans** (DEXA, BodPod, etc.)
- These tables do NOT automatically sync with each other. The POST `/weight` endpoint updates BOTH `biometric_sample` AND `users.weight`.

---

## 6. Data Integrity Risks — CRITICAL FINDINGS

### CRITICAL: Cross-User Data Exposure

1. **GET `/api/biometrics/latest`** — No auth. Anyone can pass `?userId=<any-uuid>` and read another user's latest biometrics.

2. **GET `/api/biometrics/summary`** — No auth. Anyone can pass `?userId=<any-uuid>` and read another user's biometric summary.

3. **POST `/api/biometrics/ingest`** — No auth. Anyone can write biometric data to ANY user by passing `userId` in the request body.

4. **GET `/api/biometrics/sources/:userId`** — No auth. Anyone can read any user's biometric sources.

### CRITICAL: Dummy Data in Production

5. **POST `/api/biometrics/log`** — Hardcoded dummy UUID. ALL macro logs from meal generators go to the dummy user account, not the actual user. This means users' macro tracking is incomplete.

6. **POST `/api/biometrics/weight`** — Has requireAuth BUT falls back to `req.body.userId` if `authUser.id` is null. A malicious request could write weight to another user's account.

### HIGH: Query Parameters Control Identity

7. Multiple endpoints accept `userId` from query params or request body without verifying it matches the authenticated session. This allows:
   - Reading any user's data by guessing/knowing their UUID
   - Writing data to any user's account

---

## 7. System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  my-biometrics.tsx ──── GET/POST /api/biometrics/weight     │
│       (Weight graph + manual entry)                         │
│       ✅ Auth: credentials + authHeaders                     │
│                                                             │
│  MacroCalculator.tsx ── GET /api/biometrics/latest           │
│                         POST /api/biometrics/ingest          │
│       ⚠️  Auth: authHeaders only, no credentials             │
│                                                             │
│  ProClientWeightSnapshot.tsx                                │
│       ── GET /api/pro/clients/:id/biometrics/weight         │
│       ✅ Auth: credentials + authHeaders                     │
│                                                             │
│  NewLogToMacrosButton.tsx ── POST /api/biometrics/log       │
│       ❌ Auth: NONE                                          │
│                                                             │
│  useSleep.ts ── GET /api/biometrics/summary                 │
│                 POST /api/biometrics/ingest                  │
│       ❌ Auth: NONE                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  POST /api/biometrics/weight   ✅ requireAuth                │
│  GET  /api/biometrics/weight   ✅ requireAuth                │
│  POST /api/biometrics/ingest   ❌ NO AUTH                    │
│  GET  /api/biometrics/latest   ❌ NO AUTH                    │
│  GET  /api/biometrics/summary  ❌ NO AUTH                    │
│  POST /api/biometrics/log      ❌ NO AUTH + HARDCODED UUID   │
│  GET  /api/biometrics/sources  ❌ NO AUTH                    │
│  POST /api/biometrics/sources  ❌ NO AUTH                    │
│                                                             │
│  GET /api/pro/.../biometrics/weight  ✅ requireAuth+board    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE TABLES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  biometric_sample    ← Primary weight time-series           │
│    (id, userId, type, value, unit, startTime, provider)     │
│                                                             │
│  users               ← Static profile weight (kg)          │
│    (id, weight, height)                                     │
│                                                             │
│  biometrics_vitals   ← Daily manual vitals check-ins        │
│    (id, userId, date, weightKg, waistCm, systolic, ...)    │
│                                                             │
│  body_fat_entries    ← Body composition scans               │
│    (id, userId, currentBodyFatPct, scanMethod, ...)        │
│                                                             │
│  avatar_state        ← FitLife simulation                   │
│    (userId, weightLbs, bodyFatPct, muscleMassLbs)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI DISPLAY                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Weight Graph (my-biometrics.tsx)                            │
│    Source: biometric_sample via GET /api/biometrics/weight   │
│                                                             │
│  Current Weight Display                                     │
│    Source: users.weight (profile)                            │
│                                                             │
│  Pro Dashboard Weight Card                                  │
│    Source: biometric_sample via GET /pro/.../weight          │
│                                                             │
│  Macro Calculator Pre-fill                                  │
│    Source: users.weight (profile) + biometric_sample         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Summary of Findings

### Already Fixed (This Session)
- GET `/api/biometrics/weight` — Now uses `requireAuth` + `authUser.id` instead of dummy UUID
- Frontend weight fetch calls — Now include `credentials: "include"` + `getAuthHeaders()`

### Remaining Critical Issues (8 items)
1. POST `/api/biometrics/ingest` — No auth, userId from request body
2. GET `/api/biometrics/latest` — No auth, userId from query param
3. GET `/api/biometrics/summary` — No auth, userId from query param
4. GET `/api/biometrics/sources/:userId` — No auth, userId from URL param
5. POST `/api/biometrics/sources` — No auth, userId from request body
6. POST `/api/biometrics/log` — No auth, hardcoded dummy UUID
7. POST `/api/biometrics/weight` — Still falls back to `req.body.userId` if authUser missing
8. Multiple frontend callers missing credentials/authHeaders

### Remaining High-Risk (Broader System — Not Biometrics-Specific)
- 30+ endpoints across the server use the dummy UUID as a fallback
- Shopping lists, meal plans, builder plans, meal preferences, and community features all affected
- These need a systematic fix but are outside the immediate biometrics scope

---

*This report is analysis only. No code changes have been made.*
