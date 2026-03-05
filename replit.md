# MyPerfectMeals (MPM)

## Overview
MyPerfectMeals is a full-stack TypeScript application for comprehensive meal planning and nutrition. It features AI-powered meal generation, diverse dietary tracking, biometrics monitoring, and specialized meal builders (e.g., craving, dessert, holiday). The project aims to provide a robust platform for personalized nutrition management with a significant market impact in health and wellness technology.

## User Preferences

### UI Component Rules (MANDATORY)
- **NEVER use radio buttons.** The app uses a pill button system for all selection inputs. Always use pill buttons instead of radio buttons, no exceptions.
- Dismissible UI must follow the `mpm.dismiss.<featureName>` localStorage pattern (see Dismissible UI Pattern below).

### Change Control Protocol (MANDATORY)

#### Pre-Change
1. Record current checkpoint hash in `BASELINE_STATUS.md`
2. For High-Risk changes (auth, onboarding, macros, meal boards, middleware): run full Golden Path checklist and record pass/fail
3. Write a 1-paragraph change scope: "We are changing X. It affects Y files/routes. It should NOT affect A, B, C flows."

#### During Change
- One change set, one purpose — no bonus refactors, no "while I'm here" edits
- Only touch files listed in the scope

#### Post-Change
1. Run Golden Path again — every item must match baseline unless intentionally changed
2. Review diff — confirm only intended files were modified
3. Check logs for new warnings, 403s, 404s, unexpected middleware hits
4. If anything regressed that wasn't in scope: STOP, fix immediately, do not proceed
5. Record the change in `CHANGE_LOG.md` with: date, what changed, files touched, expected impact, Golden Path result
6. Update `BASELINE_STATUS.md` with new checkpoint hash

### Reference Files
- `BASELINE_STATUS.md` — Current known-good state and Golden Path pass/fail
- `CHANGE_LOG.md` — Surgical log of every change with scope and verification

### Operating Rules (MANDATORY)

#### Rule 1: One change set, one purpose
Every commit must answer: "What single outcome is this supposed to change?" If it changes more than one feature, split it.

#### Rule 2: No new work until the last change is proven
A feature is not "done" when it compiles. It is done when it passes the Golden Path checklist on web (and iOS for key flows).

#### Rule 3: High-Risk zones require extra checks
Any change touching **auth, onboarding, macros, or meal boards** is High Risk. Extra verification required, no exceptions.

#### Rule 4: Stop the line on regressions
If a regression is found: stop feature work, fix the regression first, ship the fix, then resume.

#### Rule 5: One ticket at a time
Fix one bug → verify Golden Path → commit and deploy → then start the next bug. No stacking.

## System Architecture
The application is a full-stack TypeScript project with a focus on personalized nutrition management.

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, shadcn/ui. Wouter for client-side routing.
- **Backend**: Express.js (Node.js 20) for API routes and serving the frontend.
- **Database**: PostgreSQL via Drizzle ORM.
- **AI Integration**: OpenAI API for meal generation and content translation.
- **Navigation**: Role and workspace-based navigation (client and clinician views), `BuilderHeader` for builders, `ProClientContext` for clinician-client interactions.
- **Desktop Layout**: `client/src/layout/AppLayout.tsx` wraps content in `DesktopLayout` (sidebar + workspace, >=1024px) or `MobileLayout`. Full-screen routes (auth, onboarding, etc.) bypass the desktop layout. Mobile bottom nav hidden on desktop via `useIsDesktop` hook in `Router.tsx`. Sidebar uses wouter `Link` for SPA navigation with active state highlighting. `DesktopLayout.tsx` renders a sectioned sidebar (HOME, MEAL INTELLIGENCE, TOOLS, PROFESSIONAL, ACCOUNT) plus `DesktopHeader.tsx` (page title, plan badge, user avatar). `DashboardNew.tsx` has a dedicated desktop branch with hero+plan card grid, quick actions, tools grid, and professional section.
- **Routing & Gating Architecture**:
    - Free-first: Free users land on `/macro-counter` after WelcomeGate. Paid users land on `/dashboard`.
    - `client/src/lib/subscriptionCheck.ts`: `hasActivePaidSubscription(user)` is the single source of truth for subscription state. Checks `planLookupKey`, `isTester`, `accessTier`, `trialEndsAt`.
    - Onboarding is gated behind paid subscription — free users skip it entirely.
    - WelcomeGate: Shows once per session via `sessionStorage("mpm.welcomeGateDone")`. Skippable via `localStorage("mpm.skipWelcomeGate")`. Not shown in professional workspace (route-based detection via `/care-team`, `/pro-portal`, `/pro/` prefixes OR `localStorage("mpm_active_space") === "workspace"`).
    - Workspace switching: `mpm_active_space` localStorage key tracks "personal" vs "workspace". Set by WorkspaceChooser in Auth.tsx, More.tsx, StudioBottomNav.tsx.
    - Auth.tsx: No routing decisions — authenticates only, then routes to `/` (AppRouter decides) or `/onboarding` (paid + incomplete). Professionals see WorkspaceChooser.
    - Profile.tsx: "Reset Tutorial & Coach Mode" clears session flag; "Skip Welcome Screen" toggle writes `mpm.skipWelcomeGate`.
    - `PRE_LAUNCH_FULL_ACCESS = true` in `server/lib/accessTier.ts` grants PAID_FULL server-side; client subscription check uses `planLookupKey` directly.
- **Access Tier System**: Centralized `shared/planFeatures.ts` defines tiers (free, basic, premium, ultimate) and entitlements. Backend middleware (`requireAuth`, `requireActiveAccess`, etc.) enforces access.
- **Feature Flags**: `PhaseGate` component allows phased rollouts, especially for ProCare features.
- **Versioned Storage**: `APP_STORAGE_VERSION` for schema versioning of drafts and temporary data.
- **Deployment**: Designed for autoscale with separate build/start scripts for production.
- **iOS/Capacitor Integration**: Supports iOS via Capacitor, bundling web assets and using StoreKit for in-app purchases. Global error handling prevents silent failures.
- **ProCare Architecture**:
    - Enforces a single active professional per client via a unique partial index on `client_links`.
    - `clientLinkService` manages link creation, activation, and termination.
    - `requireBoardAccess` middleware checks `care_team_member` or `client_links` for access.
    - Middleware chain includes `requireAuth` → `requirePremiumAccess` → route-specific checks.
    - Uses feature flags like `PRE_LAUNCH_FULL_ACCESS` and `ENFORCE_SWITCH_LIMITS` for controlled feature rollout.
- **Pro Week Board Architecture**:
    - Uses a unified `week_boards` table for both Pro and client editing.
    - Pro-scoped API endpoints (`/api/pro/week-boards/:clientId/...`) with `requireBoardAccess`.
    - `useWeeklyBoard` hook and `boardApi.ts` functions support `proClientId` for contextual data loading.
    - Pro builder routes render actual builder components, not a separate viewer.
    - `builderMap.ts` centralizes builder keys and routes.
- **Clinical Mode Architecture**:
    - Anti-Inflammatory Builder supports clinical modes via `board.meta.clinicalMode` (database-persisted, not localStorage).
    - `shared/clinical/guardrails.ts` provides shared guardrail functions: `getGuardrails()`, `applyGuardrailsToPrompt()`, `filterPremadesByGuardrails()`, `isMealAllowed()`.
    - `resolveClinicalMode(board)` helper in `shared/schema/weeklyBoard.ts` defaults to "anti-inflammatory" when undefined.
    - Liver-support mode: hard blocks alcohol/fried/soda/processed, soft discourages bacon/sausage/butter-heavy, prioritizes leafy greens/omega-3/beans/olive oil.
    - Server guardrails: `liverSupportPromptBuilder.ts`, `liverSupportRules.ts`, `liverSupportValidator.ts` in `server/services/guardrails/`.
    - Client pickers (`MealPremadePicker`, `SnackPickerDrawer`) filter premades through guardrails when `dietType === "liver-support"`.
- **Macro Sync Architecture (Option B)**:
    - Save Day in all 7 builders POSTs locked-day summary to `POST /api/users/:userId/macros/daily-summary` (upsert via `ON CONFLICT`).
    - `macro_logs` table with unique index `macro_logs_daily_source_idx` on `(user_id, source, date)`.
    - `useTodayMacros(userId)` requires explicit userId — no hardcoded fallback.
    - Biometrics page (`my-biometrics.tsx`) fetches from `GET /api/users/:userId/macro-logs/daily-with-source` (locked-day priority SQL). localStorage is offline fallback only.
    - `macros:updated` window event triggers refetch in biometrics when Save Day fires.
    - DEV_USER_ID removed from all client files except: `AuthContext.tsx` (guest fallback), `useWeeklyBoard.ts` (Apple review flag), `api.ts` (localStorage migration keys).
- **Reactivity & Refresh Architecture**:
    - Global `refetchOnWindowFocus` is OFF in `queryClient.ts`. Selective per-query opt-in only.
    - `useVisibilityRefresh` hook (mounted in `App.tsx`) listens for `visibilitychange` and invalidates critical query prefixes (`/api/users`, `/api/weekly-board`, `/api/pro/weekly-board`), then dispatches `mpm:visibility-resumed` window event.
    - `useTodayMacros` has `refetchOnWindowFocus: true` and `refetchOnReconnect: true` per-query.
    - `useWeeklyBoard` polls every 45s while visible (stops when hidden), refreshes on `mpm:visibility-resumed`.
    - `TrainerClientDashboard` re-reads proStore + refetches body composition on `mpm:visibility-resumed`.
    - Pattern: global hook fires once → dispatches `mpm:visibility-resumed` → per-component listeners react. No duplicate fetches.
    - Push notifications: `pushToUser()` and `pushToCoachOfClient()` in `server/services/pushNotify.ts`. Wired into studioRoutes (builder assign → client), manualMacros (macro targets → client), proWeekBoard (board save → client), weekBoard (client board save → coach).
- **iOS Purchase Flow**:
    - StoreKit plugin: `@squareetlabs/capacitor-subscriptions` via `client/src/lib/storekit.ts`.
    - `verifyAndActivate()` POSTs to `/api/ios/verify-purchase`, MERGES server response with existing localStorage user (never overwrites — preserves `onboardingCompletedAt`, `role`, `activeBoard`, etc.).
    - `mpm:user-updated` event dispatched after purchase → `AuthContext` listener calls `refreshUser()` to sync React state with server.
    - Server (`iosVerify.ts`) returns complete `safeUser` with `role`, `onboardingCompletedAt`, `selectedMealBuilder`, `activeBoard`, `profilePhotoUrl`, `nickname`.
    - Defensive JSON parsing on all `response.json()` calls to prevent crashes from non-JSON error responses.
- **Studio Metrics Architecture**:
    - Studio reads DATABASE only, never localStorage. Consumer pages (my-biometrics, macro-calculator) are coach's personal space.
    - `StudioMetricsSnapshot` shows macro targets (from proStore), today's logged macros, and body composition via database APIs.
    - `ProClientWeightSnapshot` shows weight trend chart + 30D/90D deltas via `GET /api/pro/clients/:clientId/biometrics/weight`.
    - `proBiometricsRoutes.ts` provides pro-scoped weight API using `requireBoardAccess` middleware.
    - Both components render inline in `ProClientFolderModal` — no consumer page routing needed.

## External Dependencies
- **PostgreSQL**: Primary database (Neon-backed on Replit).
- **OpenAI API**: AI-powered features (meal generation, translation).
- **Stripe**: Payment processing.
- **Resend**: Email services.
- **Twilio**: SMS notifications.
- **VAPID**: Push notifications.
- **@squareetlabs/capacitor-subscriptions**: iOS StoreKit plugin for subscription management.