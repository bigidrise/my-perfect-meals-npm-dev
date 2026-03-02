# MyPerfectMeals (MPM) - Replit Project

## Overview
MyPerfectMeals is a full-stack TypeScript application designed for comprehensive meal planning and nutrition. It leverages AI for meal generation, offers diverse dietary tracking, biometrics monitoring, and specialized meal builders (e.g., craving, dessert, holiday). The project aims to provide a robust platform for personalized nutrition management with a vision for significant market impact in health and wellness technology.

## User Preferences
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
The application is structured as a full-stack TypeScript project.
- **Frontend**: Developed with React 18, Vite, TypeScript, styled using Tailwind CSS, Radix UI, and shadcn/ui components. Wouter handles client-side routing.
- **Backend**: An Express.js (Node.js 20) server manages API routes and serves the frontend.
- **Database**: PostgreSQL is used for data persistence, managed via Drizzle ORM.
- **AI**: OpenAI API is integrated for various AI-driven features, including meal generation and content translation.
- **Navigation**: Features role and workspace-based navigation, differentiating between client and clinician views. A shared `BuilderHeader` component is used across specific builders, and the `ProClientContext` manages clinician-client interactions.
- **Access Tier System**: A centralized system (`shared/planFeatures.ts`) defines plan tiers (free, basic, premium, ultimate), their features, and entitlements. Backend middleware (`requireAuth`, `requireActiveAccess`, `requirePremiumAccess`, `requireMacroProfile`) enforces access based on user subscription status and profile completeness.
- **Feature Flags**: New features, especially for ProCare, are implemented behind feature flags using a `PhaseGate` component, allowing for phased rollouts and stabilization.
- **Versioned Storage**: Drafts and temporary data utilize `APP_STORAGE_VERSION` for schema versioning, ensuring compatibility and preventing data breakage during updates.
- **Deployment**: The application is designed for autoscale deployment, with separate build and start scripts for production.
- **iOS/Capacitor Integration**: The project supports iOS via Capacitor, bundling web assets and utilizing StoreKit for in-app purchases. Global error handling is configured to prevent silent failures.

## ProCare Architecture
- **Single Active Professional**: Enforced via `client_links` table with DB-level unique partial index `idx_client_links_single_active` on `(client_user_id) WHERE active = true`
- **clientLinkService**: `getActiveLink()`, `createLink()` (rejects duplicates with `CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL`), `endLink()` (sets active=false, no deletes)
- **End Relationship**: `POST /api/pro/end-relationship` — pro can end relationship with a client
- **Board Access**: `requireBoardAccess` middleware checks EITHER `care_team_member` (existing) OR `client_links` (additive)
- **Tables**: `client_links` (source of truth for active pro), `care_team_member` (permissions/roles), `studios`, `studio_memberships`, `pro_accounts`, `subscriptions`, `payouts`
- **Middleware chain**: `requireAuth` → `requirePremiumAccess` → route-specific middleware (requireBoardAccess, loadStudioMembership, etc.)
- **PRE_LAUNCH_FULL_ACCESS**: `server/lib/accessTier.ts` flag (currently `true`) grants everyone PAID_FULL — flip to `false` at App Store launch
- **ENFORCE_SWITCH_LIMITS**: `server/services/builderSwitchService.ts` flag (currently `false`) — flip to `true` when ready to enforce builder switch limits

## External Dependencies
- **PostgreSQL**: Database solution (Neon-backed on Replit).
- **OpenAI API**: For AI-powered meal generation, translation, and other intelligent features.
- **Stripe**: (Optional) For payment processing.
- **Resend**: (Optional) For email services.
- **Twilio**: (Optional) For SMS notifications.
- **VAPID**: (Optional) For push notifications.
- **@squareetlabs/capacitor-subscriptions**: iOS StoreKit plugin for subscription management.

## Key Technical Notes
- `activeBoard` = coach-assigned builder; `selectedMealBuilder` = user self-selected; PATCH syncs both
- `isProCareClient` = `isProCare AND professionalRole NOT IN [admin, coach, physician, trainer]`
- `withPageErrorBoundary` pattern: ALL Safe* constants MUST remain module-level (not inline JSX)
- React StrictMode ON in main.tsx (doubles effects in dev)
- `APP_STORAGE_VERSION = "3"` in main.tsx
- DB schema: `height` stored in cm, `weight` stored in lbs
- Dev and production share the SAME database — no staging DB

## Stripe Configuration
- **Mode**: TEST (sk_test_...) — all prices must be test-mode IDs
- **Env vars**: `STRIPE_SECRET_KEY` (one global key), `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_ULTIMATE`, `STRIPE_PRICE_FAMILY_BASE`, `STRIPE_PRICE_FAMILY_ALL_PREMIUM`, `STRIPE_PRICE_FAMILY_ALL_ULTIMATE`, `STRIPE_PRICE_PROCARE`
- **Strict mapping**: Each plan maps 1:1 to its env var. No fallback, no auto-substitution. Missing price = hard error.
- **Config file**: `server/config/stripePrices.ts` — reads env vars, logs each mapping at startup
- **Checkout route**: `server/routes/stripeCheckout.ts` — logs plan/priceId/keyMode/userId per request

## Pro Week Board Architecture
- **Unified system**: Pro editing uses the SAME `week_boards` table as clients — no separate `meal_boards` system
- **Server**: `server/routes/proWeekBoard.ts` — pro-scoped endpoints (`/api/pro/week-boards/:clientId/current-week`, `/api/pro/week-board/:clientId/:weekStartISO`, `/api/pro/weekly-board/:clientId`) using `requireBoardAccess` middleware
- **Client hook**: `useWeeklyBoard(userId, weekStartISO, proClientId?)` — when `proClientId` is set, calls pro endpoints instead of client endpoints, skips localStorage caching
- **Client API**: `boardApi.ts` functions `getCurrentWeekBoard`, `getWeekBoardByDate`, `putWeekBoard` all accept optional `proClientId` parameter
- **Builder pattern**: Each builder detects pro context via `useRoute("/pro/clients/:id/...")`, extracts `proClientId`, passes it to both `useWeeklyBoard` and direct `boardApi` calls
- **Router**: Pro builder routes (`/pro/clients/:id/weekly-builder`, etc.) render actual builder components — NOT ProBoardViewer
- **builderMap.ts**: `proRoute` values are builder-specific (`weekly-builder`, `diabetic-builder`, etc.) — NOT `board/*` paths

## Recent Changes
- 2026-03-02: Pro week board unification — coaches now edit client's actual week_boards data through pro-scoped endpoints. All 7 builders (Weekly, Diabetic, GLP-1, Anti-Inflammatory, Beach Body, General Nutrition, Performance) support proClientId override. ProBoardViewer/meal_boards system bypassed. Dashboard navigation updated to use builder routes.
- 2026-03-02: Stripe standardized to TEST mode — removed fallback/auto-substitution logic. Strict 1:1 mapping: Basic→STRIPE_PRICE_BASIC, Premium→STRIPE_PRICE_PREMIUM, Ultimate→STRIPE_PRICE_ULTIMATE. Clear startup logging of key mode and all resolved price IDs. No mixed-mode logic.
- 2026-03-02: Revoke confirmation dialog added to CareTeam.tsx, TrainerCareTeam.tsx, PhysicianCareTeam.tsx — prevents accidental one-tap revokes.
- 2026-03-02: StudioBottomNav fix — Router now checks `professionalRole` ("trainer"/"physician") in addition to `role` for showing studio nav. User with `role="client"` + `professionalRole="trainer"` was not seeing studio nav.
- 2026-03-02: Delete on all messages — trash icon shows on every message (incoming and outgoing) for both pro and client sides. Backend delete endpoints no longer restrict by authorUserId.
- 2026-03-02: iOS native detection fix — `isIosNativeShell()` no longer detects Safari on iPhone as native app. Removed `standalone` and `isiOSDevice` checks. Only Capacitor native, webkit bridge, or branded UA triggers iOS mode.
- 2026-03-02: iOS pricing buttons fix — plan buttons now call `handleIosPurchase(product)` via StoreKit instead of `openAppleSubscriptions()`. Shows loading spinner during purchase.
- 2026-03-02: Capacitor config — removed `server.url` so iOS app loads from local bundled assets instead of remote URL.
- 2026-03-02: Delete own messages — trash icon only shows on entries you authored (pro sees trash on pro entries, client on client entries). Backend delete endpoints scoped to authorUserId + entryType + visibility.
- 2026-03-01: iOS StoreKit Product ID Fix — Updated 3 product IDs to match App Store Connect (mpm.iap.basic_upgrade.v1, mpm.iap.premium_upgrade.v1, mpm.iap.ultimate_upgrade.v1). Old IDs were wrong and StoreKit returned empty products. Server-side verification updated with both old and new IDs. capacitor.config.ts now includes server.url. PricingPage iOS subscription plan list now derives from IOS_PRODUCTS.
- 2026-02-28: Fix Anti-Inflammatory builder context + Folder Modal always→dashboard. Added `effectiveUserId = proClientId || user?.id` to AntiInflammatoryMenuBuilder, replaced all 15 `user?.id` refs with it. ProClientFolderModal dashboard button always routes to client dashboard, never directly to builder. Studio navigation rule: Folder→Dashboard→Builder (never Folder→Builder).
- 2026-02-28: Shared BUILDER_MAP + expand all 7 builders + dashboard routing. New `builderMap.ts` = single source of truth for builder keys/routes. TrainerClientDashboard shows all 7 builders for assignment. "Client Dashboard" button routes to assigned builder. Backend validation expanded to 7 keys. Missing pro-client routes added (weekly-builder, beach-body-builder).
- 2026-02-28: Fix builder assignment bug — `isProCare` never set during access-code connect, `BUILDER_MAP` missing pro builders, backfill existing clients. `careTeamRoutes.ts` sets `isProCare=true`, `More.tsx` calls `refreshUser()` after connect.
- 2026-02-28: Phase 5 Tablet System — Full Install. Two-mode tablet: Messages (shared, two-way, translatable) + Provider Notes (private, provider-only, no translation). DB: Added entry_type (message|note) and sender (client|pro) columns to client_notes. Backend: proTabletRoutes split into GET/:clientId, POST/:clientId/message, POST/:clientId/note. New clientTabletRoutes: GET /api/client/tablet, POST /api/client/tablet/message (shared only, protected by client_links). Pro UI: ProClientFolderModal tabbed Messages/Provider Notes. Client UI: More page "Messages From Your Coach" expandable card (visible only for ProCare clients).
- 2026-02-28: ProCare Phase 4 — Pro Portal Restructure. ProClients "Open" → "Open Folder" modal, builder badge on cards, ProClientFolderModal with View Biometrics/Macro Calculator/Dashboard buttons.
- 2026-02-28: ProCare Phase 3 — Client Workspace UI Shell. Upgraded WorkspaceShell with structured layout: header (name/status), biometrics, macros, meal boards placeholder. Read-only display only.
- 2026-02-28: ProCare Phase 2 — Workspace Governance Wiring. Created requireWorkspaceAccess middleware (client_links only, hard 403), GET /api/pro/workspace/:clientId read-only endpoint, /pro/workspace/:clientId frontend route + WorkspaceShell component
- 2026-02-28: ProCare Phase 1 — Single Active Professional Relationship enforcement. Created clientLinkService.ts, POST /api/pro/end-relationship, wired createLink into /connect, endLink into /revoke, hardened requireBoardAccess
- 2026-02-28: Builder switch system overhauled — switches now tied to subscription anniversary (user.createdAt), not calendar year
- 2026-02-28: Created BASELINE_STATUS.md and CHANGE_LOG.md for change control discipline
- 2026-02-27: Forgot password FIXED (3 root causes)
- 2026-02-27: Fixed meal board blinking — hoisted withPageErrorBoundary calls to module-level constants
- 2026-02-27: Phase 1 Lifestyle Cleanup — Deleted Kids Hub, Toddler Hub, Alcohol Hub, Mocktails, Craving Presets pages + data + images
