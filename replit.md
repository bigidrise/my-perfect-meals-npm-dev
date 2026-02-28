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

## Recent Changes
- 2026-02-28: ProCare Phase 4 — Pro Portal Restructure. ProClients "Open" → "Open Folder" modal, builder badge on cards, ProClientFolderModal with View Biometrics/Macro Calculator/Dashboard buttons.
- 2026-02-28: ProCare Phase 3 — Client Workspace UI Shell. Upgraded WorkspaceShell with structured layout: header (name/status), biometrics, macros, meal boards placeholder. Read-only display only.
- 2026-02-28: ProCare Phase 2 — Workspace Governance Wiring. Created requireWorkspaceAccess middleware (client_links only, hard 403), GET /api/pro/workspace/:clientId read-only endpoint, /pro/workspace/:clientId frontend route + WorkspaceShell component
- 2026-02-28: ProCare Phase 1 — Single Active Professional Relationship enforcement. Created clientLinkService.ts, POST /api/pro/end-relationship, wired createLink into /connect, endLink into /revoke, hardened requireBoardAccess
- 2026-02-28: Builder switch system overhauled — switches now tied to subscription anniversary (user.createdAt), not calendar year
- 2026-02-28: Created BASELINE_STATUS.md and CHANGE_LOG.md for change control discipline
- 2026-02-27: Forgot password FIXED (3 root causes)
- 2026-02-27: Fixed meal board blinking — hoisted withPageErrorBoundary calls to module-level constants
- 2026-02-27: Phase 1 Lifestyle Cleanup — Deleted Kids Hub, Toddler Hub, Alcohol Hub, Mocktails, Craving Presets pages + data + images
