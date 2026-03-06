# MyPerfectMeals (MPM)

## Overview
MyPerfectMeals is a full-stack TypeScript application dedicated to comprehensive meal planning and nutrition. It leverages AI for meal generation, offers diverse dietary tracking, biometrics monitoring, and specialized meal builders (e.g., for cravings, desserts, beverages, and holidays). The project aims to establish a robust platform for personalized nutrition management, addressing a significant market need in health and wellness technology.

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
The application is a full-stack TypeScript project focused on personalized nutrition management.

-   **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, shadcn/ui. Wouter for client-side routing.
-   **Backend**: Express.js (Node.js 20) for API routes and serving the frontend.
-   **Database**: PostgreSQL via Drizzle ORM.
-   **AI Integration**: OpenAI API for meal generation and content translation.
-   **Navigation**: Role and workspace-based navigation (client and clinician views) with `BuilderHeader` and `ProClientContext`. Desktop layout (`DesktopLayout.tsx`) for larger screens and mobile layout for smaller. Specific routes bypass desktop layout (e.g., auth, onboarding).
-   **Routing & Gating**: Implements a free-first model. Subscription state is managed by `hasActivePaidSubscription(user)` in `subscriptionCheck.ts`. Onboarding is gated for paid users. `WelcomeGate` manages initial user experience, while `mpm_active_space` localStorage key tracks personal vs. workspace views.
-   **Access Tier System**: Centralized `shared/planFeatures.ts` defines tiers and entitlements, enforced by backend middleware (`requireAuth`, `requireActiveAccess`).
-   **Feature Flags**: `PhaseGate` component enables phased rollouts.
-   **Versioned Storage**: `APP_STORAGE_VERSION` for schema versioning.
-   **Deployment**: Designed for autoscale with separate build/start scripts.
-   **iOS/Capacitor Integration**: Supports iOS via Capacitor, including StoreKit for in-app purchases, with global error handling.
-   **ProCare Architecture**: Enforces a single active professional per client via unique partial indexes. `clientLinkService` manages links, and `requireBoardAccess` middleware ensures proper access.
-   **Pro Week Board Architecture**: Uses a unified `week_boards` table. Pro-scoped API endpoints (`/api/pro/week-boards/:clientId/...`) with `requireBoardAccess`. `useWeeklyBoard` hook supports `proClientId`.
-   **Clinical Mode Architecture**: Supports clinical modes (e.g., Anti-Inflammatory, Liver Support) via `board.meta.clinicalMode`. `shared/clinical/guardrails.ts` provides functions for applying dietary guardrails to prompts and filtering premade meals. Server-side guardrails are implemented for specific clinical modes.
-   **Macro Sync Architecture**: `macro_logs` table stores daily macro summaries. `useTodayMacros(userId)` fetches data from `daily-with-source` API, with localStorage as an offline fallback. `macros:updated` window event triggers refetches.
-   **Reactivity & Refresh Architecture**: Global `refetchOnWindowFocus` is off; selective per-query opt-in. `useVisibilityRefresh` invalidates critical queries on visibility change. Push notifications are implemented via `pushToUser()` and `pushToCoachOfClient()`.
-   **iOS Purchase Flow**: Uses `@squareetlabs/capacitor-subscriptions`. `verifyAndActivate()` merges server response with existing user data after purchase, dispatching `mpm:user-updated` event to sync React state.
-   **Compliance Engine Architecture**: `server/services/complianceEngine.ts` calculates a rolling compliance score based on calories, protein, and logging consistency. It uses the `macro_logs` table and provides an API endpoint `/api/users/:userId/compliance`.
-   **Studio Metrics Architecture**: Studio reads directly from the database for macro targets, logged macros, and body composition. `ProClientWeightSnapshot` displays weight trends.
-   **Program Adjustment History**: `macro_program_history` table stores historical macro target changes. Every macro target save inserts a history row. An API endpoint `/api/pro/clients/:clientId/program-history` provides this data.
-   **Macro Targets Auth**: Both GET and POST `/api/users/:userId/macro-targets` require `requireAuth` and `assertSelfOrProAccess` for secure data access.
-   **Tablet Communication Layer**: Full coach-client messaging system via `client_notes` table with `proTabletRoutes.ts` (pro side) and `clientTabletRoutes.ts` (client side).
    -   **Moderation**: `tabletModerationService.ts` — server-side blocklist/regex with severity levels (high=blocked, medium=blocked, low=flagged+allowed). Returns `{allowed, severity, reason, matchedTerms}`. Blocked messages return 422 and are logged as `message_blocked` in audit. Low-severity messages are `message_flagged`.
    -   **Notifications**: `tabletNotificationService.ts` — three functions: `notifyClientOfMessage()`, `notifyProfessionalOfMessage()`, `notifyClientOfNote()`. Fire post-commit, non-blocking. Reuses existing `pushToUser`/`pushToCoachOfClient` infrastructure.
    -   **Audit Logging**: Extended `activity_action` enum with `message_sent`, `message_deleted`, `note_deleted`, `message_blocked`, `message_flagged`. All tablet operations logged via `logClientActivity`.
    -   **Unread Indicators**: Pro side uses `mpm.tablet.lastSeen.<clientId>` localStorage; client side uses `mpm.tablet.client.lastSeen`. Orange pulsing badge on Messages tab (pro) and tablet card (client). Poll-driven (10s active, 30s background), works without push.
    -   **Push Route Security**: All `/api/push/*` routes now require `requireAuth`. UserId derived from session, not request body. Hardcoded VAPID private key fallback removed.
-   **Legal Document Acceptance System**: DB-backed legal acceptance with version enforcement.
    -   **Registry**: `shared/legalDocuments.ts` — single source of truth for document types, versions, and flow grouping (client, professional, attestation).
    -   **Database**: `user_document_acceptance` table stores userId, documentType, version, acceptedAt, ipAddress, userAgent. Schema in `server/db/schema/legal.ts`.
    -   **API**: `POST /api/legal/accept` (requireAuth, userId from session), `GET /api/legal/status?flow=` returns required/accepted docs and missing list.
    -   **Server Enforcement**: `upgrade-to-procare` checks attestation + professional docs; `care-team/connect` checks client docs. Both return 409 with missing list if docs not accepted.
    -   **ProCare Flow**: Attestation → DB record → ProfessionalLegalModal (3 docs) → upgrade. localStorage no longer stores attestation text/version.
    -   **Client Flow**: Connect with code → ClientLegalModal (4 docs) if 409 → retry after acceptance.
    -   **Version Enforcement**: Bumping version in registry forces reacceptance; server rejects outdated versions.
    -   **Legal Documents**: 7 files in `client/src/legal/` (clientCoachingAgreement, clientLiabilityWaiver, clientDataConsent, nutritionDisclaimer, coachProfessionalAgreement, coachConductPolicy, scopeOfPractice).

## External Dependencies
-   **PostgreSQL**: Primary database (Neon-backed).
-   **OpenAI API**: AI-powered features.
-   **Stripe**: Payment processing.
-   **Resend**: Email services.
-   **Twilio**: SMS notifications.
-   **VAPID**: Push notifications.
-   **@squareetlabs/capacitor-subscriptions**: iOS StoreKit plugin.