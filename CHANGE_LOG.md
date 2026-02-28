# MPM Change Log

Every change is recorded here with scope, files touched, expected impact, and Golden Path result.

---

## 2026-02-28: Builder Switch — Subscription Anniversary Reset + "Current" Badge Fix

**What changed:**
- Builder switch limit window changed from calendar-year to subscription anniversary (user's `createdAt` date)
- Leap year (Feb 29) accounts clamped to Feb 28, all date math uses UTC
- "Current" badge on Meal Builder Exchange now reads `selectedMealBuilder` directly — no role-based branching
- PATCH `/api/user/meal-builder` now syncs both `selectedMealBuilder` and `activeBoard` together
- Added `confirmedBuilder` local state for instant badge update before server round-trip
- Frontend copy changed to "Program Transitions" with subscription year language

**Files touched:**
- `server/services/builderSwitchService.ts` — anniversary logic, UTC, leap year
- `server/routes.ts` — PATCH endpoint syncs `activeBoard` with `selectedMealBuilder`
- `client/src/pages/MealBuilderSelection.tsx` — badge logic, init effect, copy

**Expected impact:** Meal Builder Exchange only. No effect on auth, onboarding, macro calculator, or meal board generation.

**Golden Path:** Not affected (builder exchange is not in critical path)

---

## 2026-02-27: Forgot Password Fix (3 root causes)

**What changed:**
1. Removed duplicate broken `server/routes/password-reset.ts` (used empty MemStorage) from `server/index.ts`
2. Fixed URL generation to use `x-forwarded-proto/host` headers instead of hardcoded `NEXT_PUBLIC_APP_URL`
3. Added comprehensive `publicPaths` array to `AuthContext.tsx` so unauthenticated users can access `/reset-password`, `/forgot-password`

**Files touched:**
- `server/index.ts` — removed broken route import
- `server/routes/auth.session.ts` — URL generation fix
- `client/src/contexts/AuthContext.tsx` — public paths array

**Expected impact:** Auth flow only (High Risk — verified manually)

**Golden Path:** Identity flow verified — forgot password, reset, login all working

---

## 2026-02-27: Meal Board Blinking Fix

**What changed:** Hoisted all `withPageErrorBoundary()` calls from inline JSX to module-level constants in Router.tsx

**Files touched:** `client/src/components/Router.tsx`

**Expected impact:** All page routes (High Risk — verified manually)

**Golden Path:** Dashboard, meal builders, navigation all stable

---

## 2026-02-27: Phase 1 Lifestyle Cleanup

**What changed:** Deleted Kids Hub, Toddler Hub, Alcohol Hub, Mocktails, Craving Presets pages + data files + images. Cleaned routes and cross-references.

**Files touched:** ~30 files deleted, Router.tsx, LifestyleLandingPage, DevNavigator, featureRegistry, copilot references

**Expected impact:** Removed features only. Craving Creator engine preserved.

**Golden Path:** All core flows verified post-cleanup
