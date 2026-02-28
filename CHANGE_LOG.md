# MPM Change Log

Every change is recorded here with scope, files touched, expected impact, and Golden Path result.

---

## 2026-02-28: Fix Performance builder — client 404 + coach sees own data

**Change scope:** Two bugs in PerformanceCompetitionBuilder.tsx. (1) Client gets blank/404 because standalone mode read user from wrong localStorage key ("user" instead of "mpm_current_user"), so clientId resolved to null. (2) Coach opens client builder but sees their own macro data because all data resolution calls used user.id (coach) instead of clientId (from URL param). No schema, auth, or other builder changes.

**Root causes:**
1. `getCurrentUserId()` read from `localStorage.getItem("user")` — app stores user as `mpm_current_user`. Replaced with `user?.id` from auth context.
2. `useMealBoardDraft`, `getResolvedTargets`, `DailyTargetsCard`, `isDayLocked`, `lockDay` all used `user?.id` (coach) instead of `clientId` (from URL param or auth context).

**What changed:**
- `client/src/pages/pro/PerformanceCompetitionBuilder.tsx`:
  - Removed broken `getCurrentUserId()` function, replaced with `user?.id` from auth context
  - `useMealBoardDraft({ userId: clientId })` — draft saves under client
  - `getResolvedTargets(clientId)` — starch context resolves from client
  - `DailyTargetsCard userId={clientId}` — targets display client's data
  - `isDayLocked(activeDayISO, clientId)` — lock checks client's days
  - `lockDay({...}, clientId)` — lock saves under client

**Files touched:**
- `client/src/pages/pro/PerformanceCompetitionBuilder.tsx` (modified)

**Expected impact:** Performance builder only. Client can now access builder. Coach sees client's data. No other builders affected.

**Golden Path:** App compiles. Performance builder resolves data from correct user context.

---

## 2026-02-28: Shared BUILDER_MAP, expand all 7 builders, rewire dashboard routing

**Change scope:** Create single source of truth for builder keys/routes, expand assignment from 2 to 7 builders, fix "Client Dashboard" button routing to assigned builder. Routing + mapping only — no schema, auth, switch logic, or guardrail changes.

**What changed:**
- `client/src/lib/builderMap.ts` (NEW): Single shared builder map with all 7 builder keys, client routes, pro routes, labels. Exported `BUILDER_MAP`, `ALL_BUILDER_KEYS`, `isValidBuilderKey`.
- `client/src/lib/assignedBuilder.ts`: Refactored to import from shared `builderMap.ts`. `LEGACY_BUILDER_MAP` derived from `BUILDER_MAP`. No behavior change.
- `client/src/lib/proData.ts`: Expanded `BuilderType` union from `"general" | "performance"` to all 7 builder keys.
- `client/src/pages/pro/TrainerClientDashboard.tsx`: 
  - Assignment card now shows all 7 builders (driven by `ALL_BUILDER_KEYS.map`)
  - `handleBuilderAssignment` sends the actual builder key (e.g. `"diabetic"`) instead of mapping `"general"` → `"general_nutrition"`
  - "Client Dashboard" card now routes to assigned builder's pro route via `BUILDER_MAP[key].proRoute`
  - "All Meal Builders" card lists all 7 for direct access
- `client/src/components/pro/ProClientFolderModal.tsx`: "Go To Client Dashboard" button now routes to assigned builder's pro route; label shows builder name
- `client/src/components/Router.tsx`: Added missing pro-client routes: `/pro/clients/:id/weekly-builder`, `/pro/clients/:id/beach-body-builder`
- `server/routes.ts`: Expanded `POST /api/pro/assign-builder` validation from 2 to all 7 builder keys

**Files touched:**
- `client/src/lib/builderMap.ts` (new)
- `client/src/lib/assignedBuilder.ts` (modified)
- `client/src/lib/proData.ts` (modified)
- `client/src/pages/pro/TrainerClientDashboard.tsx` (modified)
- `client/src/components/pro/ProClientFolderModal.tsx` (modified)
- `client/src/components/Router.tsx` (modified)
- `server/routes.ts` (modified)

**Expected impact:** Builder assignment and routing only. All 7 builders assignable and routable. No changes to auth, meal generation, switch limits, guardrails, or onboarding.

**Golden Path:** App compiles and runs. All builder routes resolve. Assignment persists across refresh.

---

## 2026-02-28: Fix builder assignment not taking effect on client side

**Change scope:** When a Pro assigns a builder (e.g. performance_competition) to a client, the client's app stayed locked to the old builder. Three root causes identified and fixed. No changes to builder logic itself, meal generation, guardrails, or unrelated features.

**Root causes:**
1. Client's `isProCare` flag was never set to `true` during access code linking — so `assignedBuilder.ts` treated them as a regular user and read `selectedMealBuilder` (old value) instead of `activeBoard` (pro-assigned value).
2. `BUILDER_MAP` in `assignedBuilder.ts` had no entries for `general_nutrition` or `performance_competition` — even when `activeBoard` was read, it fell through to the weekly fallback.
3. Existing linked clients in the DB had `isProCare: false` — needed backfill.

**What changed:**
- `server/routes/careTeamRoutes.ts`: Added `db.update(users).set({ isProCare: true, role: "client" })` after both invite-code and access-code linking paths.
- `client/src/lib/assignedBuilder.ts`: Added `general_nutrition` and `performance_competition` entries to `BUILDER_MAP` with correct paths and types. Expanded `AssignedBuilder.type` union.
- DB backfill: Set `isProCare: true` for all 3 existing active client links.

**Files touched:**
- `server/routes/careTeamRoutes.ts` (modified)
- `client/src/lib/assignedBuilder.ts` (modified)

**Expected impact:** ProCare client builder resolution only. When pro assigns a builder, client app now picks it up after profile refresh.

**Golden Path:** App compiles and runs. Client's `isProCare` is `true`, `activeBoard` takes priority in builder resolution.

---

## 2026-02-28: Fix auth token key mismatch in ProClients + TrainerClientDashboard

**Change scope:** Fix 401 errors when assigning builders to clients and when loading studio data on Pro Clients page. Wrong localStorage key was being used for auth token. No changes to auth flow, middleware, schema, or unrelated features.

**What changed:**
- `client/src/pages/pro/ProClients.tsx`: Replaced `localStorage.getItem("auth_token")` with `getAuthHeaders()` from `@/lib/auth`. Added import.
- `client/src/pages/pro/TrainerClientDashboard.tsx`: Same fix — replaced manual wrong-key token read with `getAuthHeaders()`. Added import.

**Root cause:** Auth token is stored under `mpm_auth_token` (defined in `client/src/lib/auth.ts`), but both files were reading `auth_token` — always got `null`, so requests went out without auth.

**Files touched:**
- `client/src/pages/pro/ProClients.tsx` (modified)
- `client/src/pages/pro/TrainerClientDashboard.tsx` (modified)

**Expected impact:** Pro Portal and Trainer Dashboard only. Builder assignment now works. Studio data loads.

**Golden Path:** App compiles and runs. No 401s on studio or assign routes.

---

## 2026-02-28: ProCare Phase 5A — Pro Client Tablet

**Change scope:** Add a per-client, persistent, translatable tablet inside the Client Folder Modal. Uses existing client_notes table. No schema changes. No new tables. No changes to auth, onboarding, builders, or unrelated features.

**What changed:**
- Created `server/routes/proTabletRoutes.ts`:
  - GET /api/pro/tablet/:clientId — returns last 100 notes ordered ascending by created_at, filtered by pro's studio_id and client_user_id. Protected by requireAuth + requireWorkspaceAccess.
  - POST /api/pro/tablet/:clientId — inserts into client_notes with studio_id, client_user_id, author_user_id, note_type='general', visibility='professional_only'. Protected by requireAuth + requireWorkspaceAccess.
- Modified `server/routes.ts`: mounted proTabletRoutes under /api/pro/tablet
- Modified `client/src/components/pro/ProClientFolderModal.tsx`:
  - Replaced "Coming soon" tablet placeholder with real tablet UI
  - Scrollable history list with timestamps, "Coach" label, body text
  - Per-entry translate button using /api/translate endpoint with session caching
  - Input textarea + Send button with loading states
  - Fetches notes on modal open, POSTs on send

**Files touched:**
- `server/routes/proTabletRoutes.ts` (new)
- `server/routes.ts` (mount only)
- `client/src/components/pro/ProClientFolderModal.tsx` (modified)

**Expected impact:** Pro Folder Modal only. No backend schema changes. No routing changes. No auth changes.

**Golden Path:** App compiles and runs. Tablet notes persist in DB via client_notes table.

---

## 2026-02-28: ProCare Phase 4A — Pro Session Navigation Fix

**Change scope:** Fix modal navigation so View Biometrics and Macro Calculator go to the actual client pages (not the pro dashboard), with pro session context and return-to-Pro-Portal buttons.

**What changed:**
- Modified `client/src/components/pro/ProClientFolderModal.tsx`: View Biometrics sets pro session flags then navigates to /biometrics. Macro Calculator sets pro session flags then navigates to /macro-counter. Dashboard button navigates to /pro/clients/:id/:workspace (no session flags).
- Modified `client/src/pages/my-biometrics.tsx`: Added "Return to Pro Portal" button when pro-session is active. Clears session flags on click.
- Modified `client/src/pages/MacroCalculator.tsx`: Same return button behavior. Added ArrowLeft import.
- Modified `client/src/pages/pro/TrainerClientDashboard.tsx`: Back button now goes to /pro/clients (was /care-team/trainer)
- Modified `client/src/pages/pro/ClinicianClientDashboard.tsx`: Back button now goes to /pro/clients (was /care-team/physician)

**Files touched:**
- `client/src/components/pro/ProClientFolderModal.tsx`
- `client/src/pages/my-biometrics.tsx`
- `client/src/pages/MacroCalculator.tsx`
- `client/src/pages/pro/TrainerClientDashboard.tsx`
- `client/src/pages/pro/ClinicianClientDashboard.tsx`

**Expected impact:** Pro navigation only. No backend changes.

**Golden Path:** App compiles and runs. All three modal buttons go to different destinations. Return buttons work on biometrics and macro calculator.

---

## 2026-02-28: ProCare Phase 4 — Pro Portal Restructure

**Change scope:** We are restructuring the Pro Portal client list to use a central Client Folder Modal instead of direct navigation. We are adding builder badges to client cards. We are NOT touching ProClientDashboard, macro logic, guardrails, translation, onboarding, builder internals, studio DB schema, or routing structure.

**What changed:**
- Modified `client/src/pages/pro/ProClients.tsx`:
  - "Open" button renamed to "Open Folder" with FolderOpen icon
  - Added Active Builder badge (orange) to client cards — shows assignedBuilder or activeBoardId with readable labels
  - Added modal state (folderClient, folderOpen) and openFolder handler
  - Wired ProClientFolderModal component
- Created `client/src/components/pro/ProClientFolderModal.tsx`:
  - Uses shadcn Dialog (existing pattern, decentralized state)
  - Header: client name, email, Active/Archived status badge, role badge, builder badge (conditional)
  - Body: Tablet placeholder ("Coming soon"), View Biometrics button (→ workspace), View Macro Calculator button (→ /macro-counter), Go To Client Dashboard button (→ existing dashboard route)
  - Builder badge uses BUILDER_LABELS map with fallback formatting, conditional display (null if unassigned)

**Files touched:**
- `client/src/pages/pro/ProClients.tsx` (modified)
- `client/src/components/pro/ProClientFolderModal.tsx` (new)

**Expected impact:** Pro Portal flow only. No backend changes, no routing changes, no dashboard logic changes.

**Golden Path:** App compiles and runs. Pro Portal accessible, client cards display correctly.

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
