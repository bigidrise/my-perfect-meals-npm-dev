# MyPerfectMeals (MPM)

## Overview
MyPerfectMeals is a full-stack TypeScript application for comprehensive meal planning and nutrition. It features AI-powered meal generation, diverse dietary tracking, biometrics monitoring, and specialized meal builders (e.g., craving, dessert, holiday). The project aims to provide a robust platform for personalized nutrition management with a significant market impact in health and wellness technology.

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
The application is a full-stack TypeScript project with a focus on personalized nutrition management.

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, shadcn/ui. Wouter for client-side routing.
- **Backend**: Express.js (Node.js 20) for API routes and serving the frontend.
- **Database**: PostgreSQL via Drizzle ORM.
- **AI Integration**: OpenAI API for meal generation and content translation.
- **Navigation**: Role and workspace-based navigation (client and clinician views), `BuilderHeader` for builders, `ProClientContext` for clinician-client interactions.
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

## External Dependencies
- **PostgreSQL**: Primary database (Neon-backed on Replit).
- **OpenAI API**: AI-powered features (meal generation, translation).
- **Stripe**: Payment processing.
- **Resend**: Email services.
- **Twilio**: SMS notifications.
- **VAPID**: Push notifications.
- **@squareetlabs/capacitor-subscriptions**: iOS StoreKit plugin for subscription management.