# MPM Change Log

Every change is recorded here with scope, files touched, expected impact, and Golden Path result.

---

## 2026-02-28: ProCare Phase 3 — Client Workspace UI Shell

**Change scope:** We are upgrading the WorkspaceShell component from a bare-bones display to a structured workspace layout with display sections. We are ONLY modifying `WorkspaceShell.tsx`. We are NOT touching backend, routes, middleware, onboarding, macro calculator, builder switching, Stripe, or any other file.

**What changed:**
- Upgraded `client/src/pages/pro/WorkspaceShell.tsx` with structured layout:
  - Header: client name, "Client Workspace" subtitle, green "Active" status indicator
  - Active Builder section: builder name + medical condition badges (excluding "none")
  - Biometrics section: age, height (cm→ft/in conversion), weight (lbs)
  - Macro Targets section: calories, protein, carbs, fat — with null handling ("—" for missing)
  - Meal Boards section: placeholder ("Read-only view coming in Phase 4")
- All sections are read-only display blocks — no editing logic, no mutations
- Uses existing Phase 2 endpoint `GET /api/pro/workspace/:clientId` — no backend changes

**Files touched:**
- `client/src/pages/pro/WorkspaceShell.tsx` (modified — UI upgrade only)

**Expected impact:** ProCare workspace display only. No effect on any other system.

**Golden Path:** App compiles and runs. No regressions — single file UI change.

---

## 2026-02-28: ProCare Phase 2 — Workspace Governance Wiring

**Change scope:** We are adding a workspace access middleware, a read-only workspace endpoint, and a frontend workspace shell route. It affects only new ProCare files + minimal mount points in routes.ts and Router.tsx. It should NOT affect onboarding, macro calculator, builder switching, studio schema, Stripe, feature flags, AppRouter, ProClientDashboard, or translation system.

**What changed:**
- Created `server/middleware/requireWorkspaceAccess.ts` — checks `client_links` table ONLY (not care_team_member), hard 403 if no active link
- Created `server/routes/workspaceRoutes.ts` — `GET /api/pro/workspace/:clientId` returns strict field selection: client name, selectedMealBuilder, activeBoard, macro targets, biometrics (height/weight/age), medicalConditions, healthConditions. Read-only, no mutations.
- Created `client/src/pages/pro/WorkspaceShell.tsx` — fetches workspace endpoint, displays client name + builder type, handles 403/404 with error states
- Added route `/pro/workspace/:clientId` in Router.tsx with module-level `SafeWorkspaceShell` constant
- Mounted `/api/pro/workspace` in routes.ts with `requireAuth` middleware

**Files touched:**
- `server/middleware/requireWorkspaceAccess.ts` (new)
- `server/routes/workspaceRoutes.ts` (new)
- `client/src/pages/pro/WorkspaceShell.tsx` (new)
- `server/routes.ts` — added workspace route mount (2 lines)
- `client/src/components/Router.tsx` — added import, Safe constant, route (3 lines)

**Expected impact:** ProCare workspace entry point only. No effect on auth, onboarding, macro calculator, meal builders, or existing Pro Portal pages.

**Golden Path:** App compiles and runs. No regressions — only new files + minimal additions to existing mount points.

---

## 2026-02-28: ProCare Phase 1 — Single Active Professional Relationship Enforcement

**Change scope:** We are enforcing single-active-professional relationships via the `client_links` table. It affects careTeamRoutes, procareRoutes, requireBoardAccess middleware, and a new clientLinkService. It should NOT affect onboarding, macro calculator, builder routing, studio schema, translation system, or any Pro UI pages.

**What changed:**
- Created `server/services/clientLinkService.ts` with `getActiveLink()`, `createLink()`, `endLink()` functions
- `createLink()` enforces single active professional per client — rejects with `CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL` if duplicate
- `endLink()` sets `active = false` (no deletes, no destructive behavior)
- Added DB-level unique partial index `idx_client_links_single_active` on `(client_user_id) WHERE active = true` for race condition protection
- Created `client_links` table in database (was defined in schema but never pushed)
- Added `POST /api/pro/end-relationship` endpoint to `procareRoutes.ts` — pro can end relationship with a client
- Updated `careTeamRoutes.ts` `/connect` endpoint — both invite code and access code branches now call `createLink()`, returning 409 if client already has active pro
- Updated `careTeamRoutes.ts` `/revoke` endpoint — calls `endLink()` using the member row's `proUserId`
- Hardened `requireBoardAccess` middleware — now checks EITHER `care_team_member` (existing) OR `client_links` (new, additive)

**Files touched:**
- `server/services/clientLinkService.ts` (new)
- `server/routes/procareRoutes.ts` — added end-relationship endpoint + imports
- `server/routes/careTeamRoutes.ts` — wired createLink into /connect, endLink into /revoke
- `server/middleware/requireBoardAccess.ts` — additive client_links check

**Expected impact:** ProCare governance layer only. No effect on auth, onboarding, macro calculator, meal builders, or UI.

**Golden Path:** All core flows verified — no regressions. App compiles and runs clean.

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
