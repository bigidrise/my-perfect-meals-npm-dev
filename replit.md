# MyPerfectMeals

MyPerfectMeals is a full-stack TypeScript application providing AI-powered meal generation, dietary tracking, and biometric monitoring for personalized nutrition management.

## Run & Operate

**Required Environment Variables**:
- `COACH_JEN_USER_ID`, `COACH_JEN_STUDIO_ID` (for each coach)
- `ONCOLOGY_SUPPORT_V1` (default: active, set to "off" to disable)
- `MACRO_AUDIT` (set to `true` for macro debug logging)
- `BILLING_ENFORCED` — set to `"true"` to activate real paywalls. While unset/false, everyone gets PAID_FULL (pre-launch mode). This is the master launch switch — no code deploy needed.
- `MPM_TESTER_EMAILS` — comma-separated list of emails that get `isTester=true` on signup. Empty = no testers (post-launch default).
- ~~`TESTER_PROGRAM_ACTIVE`~~ — **REPLACED** by `BILLING_ENFORCED` + `MPM_TESTER_EMAILS`. Do not use.

**Commands**:
- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run typecheck`: Runs TypeScript type checking.
- `drizzle-kit push:pg`: Pushes Drizzle schema changes to PostgreSQL.

## Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, shadcn/ui, Wouter
- **Backend**: Express.js (Node.js 20)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **AI**: OpenAI API
- **Payments**: Stripe
- **Email**: Resend
- **SMS**: Twilio
- **Push Notifications**: VAPID
- **iOS Purchases**: `@squareetlabs/capacitor-subscriptions`

## Where things live

- **DB Schema**: `server/db/schema/*` & `shared/schema.ts`
- **API Routes**: `server/routes.ts`, `server/routes/*`
- **UI Components**: `client/src/components/*`
- **Pages**: `client/src/pages/*`
- **Client Config**: `client/src/config/*`
- **Server Config**: `server/config/*`
- **Shared Utilities/Types**: `shared/*`
- **Coach Registry (Frontend)**: `client/src/config/coaches.ts`
- **Coach Registry (Backend)**: `server/config/coaches.ts`
- **Legal Documents**: `shared/legalDocuments.ts`
- **Plan Features/Access Tiers**: `shared/planFeatures.ts`
- **Professional Builder Map**: `client/src/lib/professionalBuilderMap.ts`

## Architecture decisions

- **Free-first model**: Users can access basic features, with a `hasActivePaidSubscription(user)` check gating advanced functionality.
- **Protocol Envelope & 4-Layer Constraint Hierarchy**: All AI generation flows use `server/services/protocolEnvelope.ts` to assemble a `UserProtocolEnvelope` and enforce a strict hierarchy: (1) Medical, (2) Dietary Identity, (3) Cultural/Cuisine Preference, (4) Behavioral Preference.
- **Macro Truth Contract**: `server/services/guardrails/macroTruthContract.ts` ensures that macro values are never invented (null=unknown, 0=known zero) and are only rejected or regenerated, never mutated.
- **Slug-based Coaching System**: New coaches are added by updating config files and environment variables; no code changes required for coach onboarding.
- **Creator System Layer (Branded Kitchens)**: Allows chefs/coaches to customize meal generation output styling (name, description, instructions) via `creator_system_configs` in the DB, without affecting core medical/dietary guardrails.

## Product

- AI-powered meal generation (Create a Dish, Chef's Kitchen, Snack Creator, Beverage Creator, Craving Creator, Fridge Rescue, Meal Planner, Holiday Feast).
- Detailed dietary and biometric tracking.
- Personalized meal plans with clinical mode support (e.g., Anti-Inflammatory, Oncology Support).
- Professional coaching platform with client management and communication tools.
- Multi-course meal generator for ultimate experiences (e.g., Holiday meals).
- Freemium model with "show but lock" for paid features.

## User preferences

- **NEVER use radio buttons.** The app uses a pill button system for all selection inputs. Always use pill buttons instead of radio buttons, no exceptions.
- **Info/action trigger buttons: always use `PillButton`.** Import from `@/components/ui/pill-button`. This is the standard button style for ALL info triggers, labels, small action buttons, and selection chips across the entire app. NEVER substitute a circular icon button, ghost button, or custom inline button where a pill is appropriate.
- **Page color theme**: All pages use the black/orange gradient (`from-black/60 via-orange-600 to-black/80`). Accent colors are orange (e.g., `text-orange-400`, `bg-orange-600`). NEVER use purple gradients or purple accents on any page.
- **NEVER use hover-dependent UI.** No hover states that reveal text, change meaning, or make content readable. Mobile has no hover. All buttons must be fully visible and readable without any interaction. No `variant="outline"` white/invisible ghost buttons — use solid backgrounds (`bg-orange-600`, `bg-white/10`, etc.) with visible text at all times.
- Dismissible UI must follow the `mpm.dismiss.<featureName>` localStorage pattern (see Dismissible UI Pattern below).
- **NEVER use `client/src/pages/onboarding-standalone.tsx`** for onboarding changes. The ONLY active onboarding is `client/src/pages/OnboardingV3.tsx`.
- When mentioning "Chef's Kitchen," confirm if `CreateDishPage` (creation) or `ChefsKitchenPage` (walkthrough) is intended.
- Never store coach user IDs on the frontend. Always use slug only.

## Gotchas

- **DEAD CODE**: `client/src/pages/onboarding-standalone.tsx` is dead code; do not use or modify.
- **Onboarding**: All onboarding changes must target `client/src/pages/OnboardingV3.tsx`.
- **UI Element Confusion**: Carefully distinguish between "Create a Dish" (`CreateDishPage`), "Chef's Kitchen" (`ChefsKitchenPage`), "Create With Chef" (modal `CreateWithChefModal.tsx`), "Snack Creator" (modal `SnackCreatorModal.tsx`), and "Beverage Creator" (`BeverageCreator.tsx`).
- **Clinical Safety Overrides**: User preferences (e.g., heat preference) are automatically capped or overridden by clinical safety rules for users with specific medical conditions.
- **Macro Truth Enforcement**: The `Macro Truth Contract` (v1.0) explicitly prevents AI from inventing macro values and blocks macro injection for specific diet types.
- **Oncology Support**: `oncology_support_context` is physician-assigned and not public-facing; the separate `oncology_support_intent` captures user onboarding intent only. Hard-blocked ingredients are enforced at prompt and post-generation. No treatment claims are allowed.
- **Coach Enrollment**: No one enters the Pro Portal queue without completed payment.
- **"Bold & Flavorful" Slug**: The internal slug `bold-spicy` remains unchanged despite display name updates.

## Pointers

- **Agent Rules**: `docs/agent-rules.md`
- **Baseline Status**: `BASELINE_STATUS.md`
- **Change Log**: `CHANGE_LOG.md`
- **Dismissible UI Pattern**: _Populate as you build_
- **Golden Path Checklist**: _Populate as you build_