# My Perfect Meals - Full-Stack Application

## Overview
A comprehensive meal planning and nutrition tracking application with AI-powered meal generation.

## Tech Stack
- **Frontend**: React + Vite (TypeScript)
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4 for meal generation

## Architecture
- Monorepo structure with combined frontend/backend
- Server runs on port 5000 and serves both API and client
- In development, Vite middleware serves the client
- In production, static files are served from `client/dist`

## Key Directories
- `/server` - Express backend with API routes
- `/client/src` - React frontend application
- `/shared` - Shared types and database schema
- `/migrations` - Drizzle database migrations

## Running the Application
```bash
npm run dev          # Development mode
npm run build        # Build for production
npm run start        # Production mode
npm run db:push      # Push database schema
```

## Required Secrets
- `OPENAI_API_KEY` - Required for AI meal generation
- `STRIPE_SECRET_KEY` - Optional, for payment features
- `STRIPE_WEBHOOK_SECRET` - Optional, for payment webhooks
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` - Optional, for SMS
- `SENDGRID_API_KEY` - Optional, for email

## Database
PostgreSQL database using Drizzle ORM. Schema defined in `/shared/schema.ts`.

## Recent Changes
- Made Stripe integration optional (graceful degradation)
- Made OpenAI initialization lazy to prevent startup crashes
- Configured Vite to allow all hosts for Replit proxy
- **iOS Scroll Fix (Dec 2024)**: Replaced components/RootViewport with layouts/RootViewport
  - Fixed shell: position: fixed, 100dvh, overflow: hidden
  - Pages now handle their own scroll containers
  - Deleted old components/RootViewport.tsx
- Added CSS utilities for iOS scroll handling (.ios-scroll, .pb-safe-nav, .pb-safe-both, .pt-safe-top)
- Updated SafePageContainer and PageShell with safe-area utilities
- **Route Migration (Dec 2024)**: Migrated broken routes from `stableMealGenerator` to working pipelines
  - `/api/meals/ai-creator` → uses `unifiedMealPipeline.generateCravingMealUnified`
  - `/api/meals/one/regenerate` → uses `unifiedMealPipeline.generateCravingMealUnified`
  - `/api/meals/kids` → uses `kidsLunchboxV1Generate` (dedicated kid-friendly catalog)
  - All routes now return consistent `nutrition` object format
  - `stableMealGenerator.ts` is deprecated (DO NOT USE - has 69 broken definitions)
- **U.S. Ingredient Contract (Dec 2024)**: Unified ingredient format across all meal generators
  - Defined `Ingredient` interface in `shared/types.ts` with U.S.-only measurements
  - Created `server/services/ingredientNormalizer.ts` to convert metric→U.S. and strip macros
  - Updated AI prompts (promptBuilder.ts, dessert-creator.ts) to enforce oz/lb/cup/tbsp/tsp
  - Integrated normalizer into unifiedMealPipeline and dessert-creator
  - MealIngredientPicker defaults to "oz" (not "g")
  - Restaurant generator uses string[] (ingredient names only) - different use case
- **Ingredient Macro Display Removal (Dec 2024)**: Removed inaccurate ingredient-level macros
  - Modified `formatIngredientWithGrams` in `client/src/utils/unitConversions.ts`
  - Ingredients now show only: amount, unit, name (no macro suffix like "(28g protein)")
  - Meal-level and day-level macro totals remain (accurate, validated)
  - Rationale: Ingredient macros were inconsistent/inaccurate, undermining app credibility
- **Feature Simplification (Dec 2024)**: Hidden "Create with AI" for launch
  - `showCreateWithAI: false` in `client/src/featureFlags.ts` and `client/src/utils/features.ts`
  - "Create with Chef" is now the only visible AI meal creation path
  - Code preserved for future reactivation via feature flag
  - Updated tour steps, Copilot explanations, and knowledge base to reference Chef only
- **Starchy/Fibrous Carb Breakdown (Dec 2024)**: Display in Quick Add footer for ALL meal builders
  - MacroCounter now saves starchyCarbs_g/fibrousCarbs_g when setting targets (not just displaying them)
  - Extended `macroResolver.ts` to expose starchyCarbs_g/fibrousCarbs_g from BOTH pro AND self-set targets
  - `RemainingMacrosFooter` conditionally shows 5-column layout (Cal, Protein*, Starchy*, Fibrous*, Fat)
  - **Gating logic**: Requires BOTH targets with starchy/fibrous values AND consumedOverride with starchy/fibrous fields
  - Legacy callers (Biometrics, Macro Calculator) continue using 4-column layout (total carbs)
  - **All 7 meal builders now pass breakdown data**: WeeklyMealBoard, BeachBodyMealBoard, GeneralNutritionBuilder, PerformanceCompetitionBuilder, AntiInflammatoryMenuBuilder, GLP1MealBuilder, DiabeticMenuBuilder
  - **Note**: Existing users must re-save their macros in Macro Calculator to populate starchy/fibrous fields

## iOS Viewport Architecture (CRITICAL)
RootViewport implements scroll containment to prevent iOS WKWebView bugs:

- **Fixed shell**: `position: fixed`, `100dvh`, contains the ONLY scroll container
- **Single scroll container**: `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior: none`
- **Pages handle safe-area**: Each page applies `env(safe-area-inset-top)` for its own headers

This prevents the "pull down and stays down" iOS bug.

## iOS Safe-Area Configuration (IMPORTANT)
- **Capacitor**: `ios.contentInset: 'never'` and `ios.scrollEnabled: false` in capacitor.config.ts
- **RootViewport**: Does NOT apply safe-area padding (pages handle their own)
- **DO NOT** add `-webkit-overflow-scrolling: touch` to html, body, #root
- **DO NOT** add duplicate safe-area padding in RootViewport - causes double-inset
- **DO NOT** use `100vh` - always use `100dvh` for dynamic viewport height
- **html/body**: Must have `overflow: hidden` and `overscroll-behavior: none` (defined at bottom of index.css)

## Copilot Re-Engagement Architecture (Dec 2024)
The Copilot system separates autoplay from manual invocation:

**Key Components:**
- `CopilotGuidedModeContext.tsx` - Manages autoplay toggle state (persisted to localStorage)
- `CopilotRespectGuard.ts` - Guards auto-open behavior only, not manual invocation
- `CopilotButton.tsx` - Chef button, always opens Copilot with current page context
- `CopilotSheet.tsx` - The Copilot UI panel

**Behavior Rules:**
1. **Autoplay toggle** (labeled "Auto") controls ONLY auto-open on page navigation (global setting)
2. **Chef button** ALWAYS opens Copilot with current page explanation, regardless of toggle
3. **Autoplay** happens EVERY time you navigate to a page (not just first visit)
4. **Manual invocation** always works - toggle doesn't block Chef button
5. **Skip button** - Appears when audio is playing. Stops audio and closes sheet WITHOUT affecting autoplay preference. Future pages still auto-open.
6. **Auto toggle OFF** - Stops audio AND disables all future autoplay globally
7. **Session tracking** - Once opened on a page, won't re-open until you navigate AWAY and back

**Session Tracking (in-memory, not persisted):**
- When Copilot opens on a page, that path is marked "opened this session"
- Skipping or closing does NOT re-trigger auto-open while still on that page
- Navigating to a different page clears the session, so returning will auto-open again

**Storage Keys (backward compatible):**
- `copilot_autoplay_enabled` - New key for autoplay preference
- `copilot_guided_mode` - Legacy key (migrated and kept in sync)

**Events (backward compatible):**
- `copilot-autoplay-changed` - New event name
- `copilot-guided-mode-changed` - Legacy event (still emitted for compatibility)

## AI Stability Architecture (Dec 2024) - Facebook-Level Stability

The system uses route-aware health monitoring that distinguishes between AI-required and deterministic routes.

**Key Components:**
- `server/services/schemaValidator.ts` - Validates required tables exist at startup
- `server/services/aiHealthMetrics.ts` - Tracks generation source metrics with route classification
- `/api/health/ai` endpoint - Reports health status with release gates

**Route Classification:**
- **AI-Required Routes** (count toward health gate):
  - `/api/meals/generate` - Unified endpoint (create-with-chef, snack-creator)
  - `/api/meals/fridge-rescue` - Fridge rescue (uses OpenAI)
- **Deterministic Routes** (excluded from health gate):
  - `/api/meals/craving-creator` - Uses stableMealGenerator (by design)
  - `/api/meals/ai-creator` - Uses stableMealGenerator
  - `/api/meals/kids` - Uses stableMealGenerator with kidFriendly scope

**Generation Sources (truthful tagging):**
- `ai` - Real AI generation via OpenAI (primary success)
- `cache` - Cached AI-generated meal reused (primary success)
- `template` - Template-based generation (degraded, allowed)
- `catalog` / `fallback` - Deterministic fallback (failure for AI routes)
- `error` - Generation failed

**Health Endpoint Response:**
```json
{
  "status": "ok|degraded|down",
  "schema": { "allTablesExist": true, "missingTables": [] },
  "metrics": {
    "aiRoutes": { "fallbackRate": 0, "totalRequests": 2, "hasErrors": false },
    "routes": { "/api/meals/generate": { "routeType": "ai-required", "fallbackRate": 0 } }
  },
  "releaseGates": {
    "schemaPassing": true,
    "noErrors": true,
    "fallbackRateOk": true  // fails if > 5%
  }
}
```

**Release Gates (for TestFlight):**
1. `schemaPassing` - All required tables exist
2. `noErrors` - No generation errors in recent window
3. `fallbackRateOk` - Fallback rate ≤ 5%

**Automatic Migrations:**
- `prestart` and `predev` hooks in package.json run `db:push` automatically
- Schema changes propagate on every deployment

**Required Tables:**
- `generated_meals_cache` - AI meal cache (must be in shared/schema.ts exports)
