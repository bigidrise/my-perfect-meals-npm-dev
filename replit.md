# MyPerfectMeals (MPM) - Replit Project

## Overview
MyPerfectMeals is a comprehensive meal planning and nutrition application built as a full-stack TypeScript project. It features AI-powered meal generation, dietary tracking, biometrics monitoring, and various specialized meal builders (craving creator, dessert creator, holiday feast, etc.).

## Architecture
- **Frontend**: React 18 + Vite + TypeScript, using Tailwind CSS, Radix UI, shadcn/ui components, Wouter for routing
- **Backend**: Express.js (Node.js 20) serving both API routes and the Vite dev server on port 5000
- **Database**: PostgreSQL (Neon-backed via Replit) with Drizzle ORM
- **AI**: OpenAI API integration for meal generation, translation, and various AI features

## Project Structure
```
/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components (routes)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities and helpers
│   │   └── services/    # API service layers
│   └── index.html       # Entry HTML
├── server/              # Express backend
│   ├── index.ts         # Dev entry point
│   ├── prod.ts          # Production entry point
│   ├── routes/          # API route handlers
│   ├── routes.ts        # Main route registration
│   ├── vite.ts          # Vite dev middleware setup
│   ├── db.ts            # Database connection
│   ├── db/              # Database schemas and queries
│   ├── services/        # Business logic services
│   └── middleware/       # Express middleware
├── shared/              # Shared code (schema, types)
│   └── schema.ts        # Drizzle database schema
├── drizzle.config.ts    # Drizzle ORM configuration
├── vite.config.ts       # Root Vite config (used by server)
└── package.json         # Dependencies and scripts
```

## Key Scripts
- `npm run dev` - Start development server (Express + Vite on port 5000)
- `npm run build` - Build client and server for production
- `npm run start` - Run production server
- `npm run db:push` - Push Drizzle schema to database

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `OPENAI_API_KEY` - OpenAI API key (optional, AI features disabled without it)
- `STRIPE_SECRET_KEY` - Stripe payments (optional)
- `RESEND_API_KEY` - Email service (optional)
- `TWILIO_*` - SMS notifications (optional)
- `VAPID_*` - Push notifications (optional)

## Development Notes
- The server binds to 0.0.0.0:5000, serving both API and frontend
- HMR is disabled; full page refresh is used for updates
- All hosts are allowed for Replit proxy compatibility
- OpenAI client is lazily initialized to prevent crashes when API key is missing

## Deployment
- Build: `npm run build` (compiles client with Vite, server with esbuild)
- Run: `npm run start` (runs compiled production server)
- Target: Autoscale deployment

## iOS / Capacitor Notes
- Capacitor config uses bundled mode (`webDir: "client/dist"`, NO `server.url`)
- iOS loads from `capacitor://localhost` using bundled assets
- StoreKit uses `@squareetlabs/capacitor-subscriptions` plugin (lazy dynamic import)
- Product IDs: `mpm_basic_plan_999`, `mpm_premium_plan_1999`, `mpm_ultimate_plan_2999`
- After build: run `npx cap sync ios` before opening in Xcode
- Global error handling (`setupGlobalErrorHandling`) deferred to useEffect to avoid swallowing module evaluation errors

## Navigation Architecture
- **Bottom Nav**: Role + workspace based (not route-only)
  - Clients always see Regular BottomNav
  - Clinicians (coach/trainer/physician) see StudioBottomNav only inside clinic workspace routes (/care-team, /pro/clients, /pro/physician-clients, /pro/physician, /pro-portal)
  - Personal builder routes (/pro/general-nutrition-builder, /performance-competition-builder) always show Regular BottomNav
- **Builder Headers**: Shared `BuilderHeader` component (`client/src/components/pro/BuilderHeader.tsx`)
  - Row 1: Title + Info (MedicalSourcesInfo) + Guide (QuickTourButton)
  - Row 2 (conditional): "Working with [Client Name] + Exit Client" — only shows for clinicians in studio client context
  - No back button in any builder (bottom nav handles navigation)
  - Applies to: GeneralNutritionBuilder, PerformanceCompetitionBuilder, DiabeticMenuBuilder, GLP1MealBuilder, AntiInflammatoryMenuBuilder
  - Excluded: WeeklyMealBoard, BeachBodyBuilder (unchanged)
- **ProClientContext**: Detects studio client context from route params for all builder types including medical builders

## Plan Features & Access Tier System
- **Single source of truth**: `shared/planFeatures.ts` defines all plan tiers (free/basic/premium/ultimate), their display features (shown on PricingPage), and their entitlements (used for gating)
- **How to update features**: Edit ONLY `shared/planFeatures.ts` — PricingPage, FeatureGate, PageGuard, and backend entitlements all read from it
- **Plan lookup key → tier mapping**: `LOOKUP_KEY_TO_TIER` maps Stripe/iOS lookup keys to tiers (handles legacy `mpm_upgrade_monthly` = premium)
- **Trial unlocks**: `TRIAL_UNLOCKS_TIER = "ultimate"` — trial users get full ultimate-tier access
- **PRE_LAUNCH_FULL_ACCESS**: `server/lib/accessTier.ts` flag (currently `true`) grants everyone PAID_FULL — flip to `false` at App Store launch
- **accessTier** computed at runtime by `server/lib/accessTier.ts` → `resolveAccessTier(user)` returns `PAID_FULL | TRIAL_FULL | FREE`
- **requireAuth** middleware attaches `accessTier`, `trialDaysRemaining`, `hasHadTrial` to `req.authUser`
- **requireActiveAccess** (`server/middleware/requireActiveAccess.ts`) gates all `/api/ai/*` routes + `/api/generate-*` routes — returns 403 `AI_REQUIRES_SUBSCRIPTION` for FREE tier
- **requirePremiumAccess** (`server/middleware/requirePremiumAccess.ts`) gates ProCare routes (`/api/pro/*`, `/api/studios`, `/api/care-team`, `/api/physician-reports`) — returns 403 `PREMIUM_REQUIRED` for FREE tier
- **requireMacroProfile** (`server/middleware/requireMacroProfile.ts`) gates AI meal generation routes — returns 412 `MACRO_PROFILE_REQUIRED` if age/height/weight/activityLevel/fitnessGoal missing
- **Trial trigger**: 7-day trial starts on first onboarding completion (`POST /api/user/complete-onboarding`), never overwrites existing trial
- **Frontend**: `TrialBanner` (non-dismissible, shows days remaining) + `TrialExpiredModal` (one-time, localStorage flag) on Dashboard
- **Client helpers**: `hasFeature(user, entitlement)` / `hasPlanFeature(user, entitlement)` in `client/src/lib/entitlements.ts` — checks accessTier + tier entitlements
- **Components**: `<FeatureGate feature="...">` for inline gating, `<PageGuard feature="...">` for route-level gating
- **Profile endpoint** (`/api/user/profile`) returns `accessTier`, `trialDaysRemaining`, `hasHadTrial`
- **Frontend User type** includes `AccessTier` type + trial fields in `client/src/lib/auth.ts`

## Recent Changes
- 2026-02-24: Created `shared/planFeatures.ts` as single source of truth for plan tiers, display features, and entitlements. PricingPage, FeatureGate, PageGuard, and server entitlements all read from it. No more hardcoded feature arrays in PricingPage.
- 2026-02-24: Phase A trial system — added requirePremiumAccess middleware for ProCare routes, requireMacroProfile 412 guard for AI generation, completed accessTier integration across backend and frontend
- 2026-02-23: Implemented ProCare navigation + header spec — created shared BuilderHeader component, role-based bottom nav logic, removed back/dashboard buttons from all 5 eligible builders, standardized "Working with + Exit Client" UX
- 2026-02-27: Phase 1 Lifestyle Cleanup — Deleted Craving Presets, Kids Meals Hub, Toddler Meals Hub, Alcohol Hub (landing, lean-and-social, smart-sips), Mocktails, and Alcohol Log pages + all static data files (cravingsPresetsData, kidsMealsData, kidsHealthyMealsData, kidsDrinksData, toddlersMealsData, mocktailsData, alcoholDrinksData) + all feature images (cravings/, kids-meals/, toddlers/, mocktails/, alcohol/ folders). Cleaned Router.tsx routes, LifestyleLandingPage nav cards, copilot references, DevNavigator, AvatarSelector, TapToRecordButton, ReplacePicker, featureRegistry. Craving Creator engine (CravingStudio, CravingCreatorLanding) preserved intact. Beer/Wine/Bourbon pairing, Meal Pairing AI, and Weaning Off Tool routes still active. Phase 2 (Healthy Kids Hub + Beverage Hub as Craving Creator wrappers) pending.
- 2026-02-22: Fixed iOS Capacitor runtime crash - removed `server.url` from both `capacitor.config.ts` and `ios/App/App/capacitor.config.json` (was forcing remote URL loading instead of bundled mode); deferred `setupGlobalErrorHandling()` to useEffect to stop swallowing boot errors; added detailed error logging in main.tsx dynamic import catch handler
- 2026-02-22: Fixed shopping aggregate bar z-index in Diabetic Menu Builder (removed overflow-x-hidden)
- 2026-02-21: Added ProCare account upgrade feature - existing users can upgrade to coach/ProCare role without creating a new account (POST /api/auth/upgrade-to-procare endpoint + updated ProCareAttestation page)
- 2026-02-17: Initial Replit setup - configured workflow, database, and deployment
- Fixed translate.ts to lazily initialize OpenAI client (prevents crash without API key)
