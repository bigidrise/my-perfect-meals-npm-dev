# MyPerfectMeals (MPM)

## Overview
MyPerfectMeals is a full-stack TypeScript application for comprehensive meal planning and nutrition. It features AI-powered meal generation, detailed dietary tracking, biometrics monitoring, and specialized meal builders. The project aims to provide a robust platform for personalized nutrition management, addressing a significant market need in health and wellness technology.

## User Preferences

### UI Component Rules (MANDATORY)
- **NEVER use radio buttons.** The app uses a pill button system for all selection inputs. Always use pill buttons instead of radio buttons, no exceptions.
- **Page color theme**: All pages use the black/orange gradient (`from-black/60 via-orange-600 to-black/80`). Accent colors are orange (e.g., `text-orange-400`, `bg-orange-600`). NEVER use purple gradients or purple accents on any page.
- **NEVER use hover-dependent UI.** No hover states that reveal text, change meaning, or make content readable. Mobile has no hover. All buttons must be fully visible and readable without any interaction. No `variant="outline"` white/invisible ghost buttons — use solid backgrounds (`bg-orange-600`, `bg-white/10`, etc.) with visible text at all times.
- Dismissible UI must follow the `mpm.dismiss.<featureName>` localStorage pattern (see Dismissible UI Pattern below).

### Agent Safety Rules
- See `docs/agent-rules.md` for the full mandatory ruleset covering routing, security, UI, and change discipline.
- Routes must only be mounted in `server/routes.ts` via `registerRoutes()`. Never in `index.ts` or `prod.ts`.
- Never expose external API keys to the client. All third-party calls must be server-proxied.
- A route audit log runs on every server startup — check for "MISSING" entries in logs.

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
-   **Navigation**: Role and workspace-based navigation (client and clinician views) with `BuilderHeader` and `ProClientContext`. Desktop layout for larger screens, mobile for smaller. Specific routes bypass desktop layout (e.g., auth, onboarding). `MobileHeaderGuard` hides mobile fixed headers on desktop.
-   **Routing & Gating**: Implements a free-first model with subscription state managed by `hasActivePaidSubscription(user)`. Onboarding is gated for paid users. `WelcomeGate` manages initial user experience, and `mpm_active_space` localStorage key tracks personal vs. workspace views.
-   **Access Tier System**: `shared/planFeatures.ts` defines tiers and entitlements, enforced by backend middleware (`requireAuth`, `requireActiveAccess`).
-   **Feature Flags**: `PhaseGate` component enables phased rollouts.
-   **Versioned Storage**: `APP_STORAGE_VERSION` for schema versioning.
-   **Deployment**: Designed for autoscale with separate build/start scripts.
-   **iOS/Capacitor Integration**: Supports iOS via Capacitor, including StoreKit for in-app purchases, with global error handling.
-   **ProCare Architecture**: Enforces a single active professional per client via unique partial indexes. `clientLinkService` manages links, and `requireBoardAccess` middleware ensures proper access. Pro-scoped API endpoints (`/api/pro/week-boards/:clientId/...`) with `requireBoardAccess`. `useWeeklyBoard` hook supports `proClientId`.
-   **Clinical Mode Architecture**: Supports clinical modes (e.g., Anti-Inflammatory, Liver Support) via `board.meta.clinicalMode`. `shared/clinical/guardrails.ts` provides functions for applying dietary guardrails to prompts and filtering premade meals. Server-side guardrails are implemented.
-   **Macro Sync Architecture**: `macro_logs` table stores daily macro summaries. `useTodayMacros(userId)` fetches data from `daily-with-source` API, with localStorage as an offline fallback. `macros:updated` window event triggers refetches.
-   **Reactivity & Refresh Architecture**: Selective per-query opt-in for refresh. `useVisibilityRefresh` invalidates critical queries on visibility change. Push notifications implemented via `pushToUser()` and `pushToCoachOfClient()`.
-   **iOS Purchase Flow**: Uses `@squareetlabs/capacitor-subscriptions`. `verifyAndActivate()` merges server response with existing user data after purchase, dispatching `mpm:user-updated` event to sync React state.
-   **Compliance Engine Architecture**: `server/services/complianceEngine.ts` calculates a rolling compliance score based on calories, protein, and logging consistency. It uses the `macro_logs` table and provides an API endpoint `/api/users/:userId/compliance`.
-   **Studio Metrics Architecture**: Studio reads directly from the database for macro targets, logged macros, and body composition. `ProClientWeightSnapshot` displays weight trends.
-   **Vegetable System Architecture**: Fibrous carbs scale inversely with starchy carbs using a tier table in `applyStrategyLayer()` (in `dailyLimits.ts`). `mealsPerDay` (3/4/5) drives `vegetableCupsPerMeal` and `vegetableCupsPerDay`. All 4 macro save paths persist `mealsPerDay`, `vegetableCupsPerMeal`, and `vegetableCupsPerDay` to `MacroTargets`. DB column: `macro_meals_per_day` on `users` table. The macro-targets GET/POST endpoints (`server/routes/manualMacros.ts`) persist and return `mealsPerDay`. Results display in `MacroCalculator.tsx` shows vegetable prescription below "Carbs - Fibrous (Vegetables)". `buildVegetableStrategyPrompt()` in `server/services/promptBuilder.ts` generates starch-day-aware guardrails (zero-starch, low-starch, moderate, standard). `server/routes.ts` auto-enriches `nutritionStrategy` from the user's saved macro profile on every `create-with-chef` generation request. `unifiedMealPipeline.ts` injects vegetable guardrails into the chef prompt via the `nutritionStrategy` parameter.
-   **Professional Builder Map Architecture**: `client/src/lib/professionalBuilderMap.ts` is the single source of truth for all professional meal builders. Each entry has a `role` (`trainer` | `physician` | `both`), `label`, `proRoute`, and `description`. `getBuilderKeys('trainer')` and `getBuilderKeys('physician')` filter by role. `client/src/lib/assignBuilderToClient.ts` is the shared assignment helper used by both `TrainerClientDashboard` and `ClinicianClientDashboard`. Both call `PATCH /api/studios/{studioId}/clients/{uid}/assign` + `POST /api/pro/assign-builder` and inject `localStorage.setItem("pro-client-id", resolvedClientUserId)` before navigating to any builder. `builderMap.ts` is preserved as-is for `assignedBuilder.ts` client-side routing. `physicianBuilderMap.ts` is superseded by `professionalBuilderMap.ts`.
-   **Program Adjustment History**: `macro_program_history` table stores historical macro target changes. Every macro target save inserts a history row. An API endpoint `/api/pro/clients/:clientId/program-history` provides this data.
-   **Auth Hardening**: All core user-data routes use `requireAuth` + `getAuthUserId(req)` from `server/utils/getAuthUserId.ts`. Hardened subsystems include biometrics, manualMacros, shoppingList, mealPlans, meals, userMealPrefs, alcohol-log. Delegated endpoints (macro-targets, daily-with-source, compliance) use `:userId` param with `assertSelfOrProAccess` for coach/client flows.
-   **Board Access**: `requireBoardAccess` checks for self-access, care team membership, client links, and studio memberships.
-   **Tablet Communication Layer**: Full coach-client messaging system via `client_notes` table with `proTabletRoutes.ts` (pro side) and `clientTabletRoutes.ts` (client side). Includes `tabletModerationService.ts` for server-side moderation, `tabletNotificationService.ts` for notifications, and audit logging for all tablet operations. Unread indicators are poll-driven via localStorage.
-   **Push Route Security**: All `/api/push/*` routes require `requireAuth`. User ID derived from session. Push subscriptions are persisted to both in-memory store and `users.pushTokens` DB column.
-   **Legal Document Acceptance System**: DB-backed legal acceptance with version enforcement. `shared/legalDocuments.ts` is the single source of truth. `user_document_acceptance` table stores acceptance records. API endpoints for acceptance and status (`POST /api/legal/accept`, `GET /api/legal/status`). Server enforcement checks during procare upgrade and client connection flows. Version bumping forces reacceptance.
-   **AI Quota System**: Per-feature daily usage limits for free tier users tracked in `ai_usage` table. `server/services/aiQuotaService.ts` provides `checkAndIncrementQuota()` and `checkDailyQuota()`. Enforces 1/day Fridge Rescue for free users; paid users bypass. Frontend handles 429 responses with upgrade nudge UI.
-   **Freemium "Show but Lock" System**: Free users see all features but only Fridge Rescue + macro tools are functional. Other features are visible but locked with icons and trigger an upgrade modal. `UpgradeLockModal` is a reusable modal. `useFreeLock` hook guards actions.
-   **Tester Program Architecture**: `TESTER_PROGRAM_ACTIVE = true` flag controls tester bypass. Set in 3 files: `client/src/lib/subscriptionCheck.ts`, `server/lib/accessTier.ts`, `server/routes/auth.session.ts`. When `true`, users with `is_tester = true` in DB get full paid access, and all new signups auto-get `is_tester = true`. At launch, flip all 3 to `false` — testers become normal users subject to subscription checks. `freetest@myperfectmeals.com` is the only account with `is_tester = false` for testing the free-tier experience. The `is_tester` flag is permanent and remains useful post-launch for QA, demo, and Apple review accounts.

## Coaching System Architecture

The coaching system is built as a scalable, slug-based platform — not hardcoded per coach.

### Adding a New Coach (3 steps, zero code rewrites)

1. **Add to both config files:**

   `client/src/config/coaches.ts` — for frontend UI (cards, forms, display names)
   `server/config/coaches.ts` — for backend resolution (env var mapping, message templates)

   ```ts
   jen: {
     slug: "jen",
     displayName: "Coach Jen",
     title: "Nutrition Coach",
     isFounder: false,
     userIdEnv: "COACH_JEN_USER_ID",
     studioIdEnv: "COACH_JEN_STUDIO_ID",
     image: "/assets/coach-jen.jpg",
   }
   ```

2. **Set two env vars** in Replit Secrets:
   - `COACH_JEN_USER_ID` — their database user ID
   - `COACH_JEN_STUDIO_ID` — their studio ID

3. **Done.** No routing changes, no new endpoints, no hardcoded logic.

### Four Official Entry Flows (Architect-Approved)

**Flow A — Client via MPM Platform (client pays directly):**
Client fills form on ApplyGuidance → pays via Stripe → notify-coach creates "invited" membership → appears in Pro Portal Pending Activation queue → coach activates → program live.

**Flow B — Coach sees MPM client (coach perspective for Flow A):**
Coach opens Pro Portal → sees Pending Activation queue → taps Activate → system sends activation email → client moves to active roster.

**Flow C — Coach invites external client (Care Team → Pro Portal):**
Coach sends coaching invite via Pro Portal "Invited Awaiting Payment" section → invite email with token link → client installs app, pays → notify-coach links via invite token, marks invite accepted → client appears in queue → coach activates.

**Flow D — External client gets invited (client perspective for Flow C):**
Client receives email → taps "Accept Invitation" → creates account / logs in → purchases ProCare via Stripe → notify-coach uses inviteToken to link correct coach → enters activation queue → coach activates.

**RULE: No one enters the Pro Portal queue without completed payment. Period.**

### How notify-coach Works

- Accepts `{ coachSlug, stripeSessionId, inviteToken? }` (inviteToken optional for Flow C/D)
- Verifies Stripe payment server-side (never trust client)
- If `inviteToken` present: looks up `coaching_invites` table, uses that studioId, marks invite accepted
- If no inviteToken: resolves coach from `coachSlug` env vars
- Creates `studioMemberships` record with `status="invited"` (pending activation)
- Drops assignment message in coach inbox with source tag

### Pro Portal (Coach Dashboard) — /pro/clients

- **PendingActivationQueue** — clients who have paid, awaiting coach activation. Shows overdue badges (24h+), orange "Activate Client" button. Only renders for registered coaches.
- **PendingCoachInvites** — clients the coach personally invited who haven't paid yet. Shows "Invited Awaiting Payment" section with email input to send new coaching invites. Only renders for registered coaches.
- **Client activation** — `POST /api/coaching/activate-client/:clientId` sets status=active, scoped by studioId, sends activation email to client.
- **Retired**: `/coach/queue` standalone route → `CoachQueue.tsx` now redirects to `/pro/clients`.

### Coaching Invite System (coaching_invites table)

- Coach calls `POST /api/coaching/send-invite` with client email → creates `coaching_invites` record (studioId, coachSlug, email, token UUID, 30-day expiry)
- Email sent via `sendCoachingInviteEmail()` with link to `/apply-guidance?token=<uuid>`
- Client visits link → `GET /api/coaching/invite/:token` returns coach info → ApplyGuidance pre-populates coach name and stores token in sessionStorage
- After Stripe payment → CheckoutSuccess passes inviteToken to notify-coach → invite marked accepted
- Coach sees pending invites via `GET /api/coaching/pending-invites`

### Dev-Only Test Bypass

- `POST /api/coaching/test-enroll` — **only available when `NODE_ENV=development`**, server-enforced (throws 404 in prod)
- Creates "invited" membership + assignment note tagged with `source:dev_bypass`
- "Test Mode — Skip Payment" button (violet pill) shown on ApplyGuidance only when `import.meta.env.DEV` is true

### Key Files

- `client/src/config/coaches.ts` — frontend coach registry
- `server/config/coaches.ts` — server coach registry + `resolveCoach()` helper
- `server/routes/coaching.ts` — notify-coach, activate-client, queue, send-invite, pending-invites, invite token, test-enroll endpoints
- `server/db/schema/studio.ts` — includes `coachingInvites` table definition
- `server/services/emailService.ts` — `sendCoachActivationEmail()`, `sendCoachingInviteEmail()`
- `client/src/components/pro/PendingActivationQueue.tsx` — paid clients awaiting activation
- `client/src/components/pro/PendingCoachInvites.tsx` — invited clients awaiting payment + send invite UI
- `client/src/pages/pro/ProClients.tsx` — Pro Portal; renders both queue components
- `client/src/pages/ApplyGuidance.tsx` — onboarding form → Stripe (reads ?token= for invite flow, test bypass button in dev)
- `client/src/pages/CheckoutSuccess.tsx` — post-payment coach notification (passes inviteToken if present)
- `client/src/pages/CoachesComingSoon.tsx` — coach selection grid

### Current Coaches

| Slug | Name | Role | Env Vars |
|------|------|------|----------|
| `idrise` | Coach Idrise | Founder & Head Coach | `COACH_IDRISE_USER_ID`, `COACH_IDRISE_STUDIO_ID` |

### Rule: Never store coach user IDs on the frontend. Always use slug only.

## External Dependencies
-   **PostgreSQL**: Primary database.
-   **OpenAI API**: AI-powered features.
-   **Stripe**: Payment processing.
-   **Resend**: Email services.
-   **Twilio**: SMS notifications.
-   **VAPID**: Push notifications.
-   **@squareetlabs/capacitor-subscriptions**: iOS StoreKit plugin.