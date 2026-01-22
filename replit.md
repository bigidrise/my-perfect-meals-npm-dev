# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available on the Apple App Store. It provides personalized dietary solutions, leveraging AI for meal generation, visual alignment, and real-time clinical data integration. The project aims to offer a seamless full-stack experience for efficient meal management and advanced nutritional insights, serving a real business with active subscriptions and payments.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.
**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.
**Deployment Workflow**: This is the maindev space. After every significant change, ask "Ready to push to production?" and provide the git command: `git push origin production`
**Session Tracking**: Track all changes between pushes. A session is only closed when user provides a push receipt. Push often to catch mistakes faster and make rollbacks easier. When session closes, move changelog to Release History.

## Pending Changelog (Current Session)
*Changes since last push — clear this section when push receipt received*

**Bug Fixes:**
- Fixed screen flashing issues
- Fixed meals incorrectly appearing across different meal boards
- Fixed meal cards disappearing unexpectedly
- Fixed update banner refresh button not responding to taps
- Fixed update banner appearing repeatedly due to failed refresh attempts
- Fixed update banner appearing behind iOS notch/safe area
- Fixed password eyeball toggle being twitchy — now uses press-and-hold behavior

**UI/Design Updates:**
- Removed orange glow/shadow from Chef button — now clean icon on solid black background
- Update banner now works on ALL platforms (iOS, Android, Web) — same black/orange design everywhere
- Redesigned update notification banner:
  - Moved to bottom of screen (above nav) to avoid iOS safe area conflicts
  - Changed from purple to black/orange theme matching app design
  - Added rounded corners and floating card design
  - Simplified refresh to immediate hard reload for guaranteed reliability
  - Added "What's New" pill button showing release notes before updating

## Release History
*Completed releases with push receipts*

(No releases logged yet)

## System Architecture
The application is a monorepo utilizing React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend. PostgreSQL with Drizzle ORM manages data persistence. OpenAI GPT-4 is integrated for AI meal generation, including DALL-E 3 for image creation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Fixed shell with `100dvh` and a single scroll container to prevent iOS WKWebView scrolling issues, with pages managing their own safe-area insets.
- **Scientific Transparency**: `MedicalSourcesInfo` component provides citations for nutritional calculations.
- **iOS App Store Compliance**: Adheres to Apple App Store Guidelines 3.1.1 (no external payment references on iOS) and 1.4.1 (medical citations required) including StoreKit purchase buttons on iOS pricing pages and removal of web billing references.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located.
- **Database**: PostgreSQL with Drizzle ORM, schema in `/shared/schema.ts`, with automatic migrations.
- **AI Stability Architecture**: Route-aware health monitoring for AI-required routes.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals have accurately matched DALL-E 3 images, uploaded to S3.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface to include `starchyCarbs` and `fibrousCarbs` for accurate carb tracking, influencing AI prompts and response parsing.
- **Carb Enforcement System v1.0**: `server/utils/carbClassifier.ts` provides ingredient-based carb derivation post-parsing, before saving.
- **Hub Coupling Framework v1.0**: Modular plugin architecture in `server/services/hubCoupling/` allowing different health "hubs" to inject context and validation into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Advisory layer for clinicians providing macro adjustment suggestions based on conditions.
- **Role-Based Access Control v1.0**: Three-tier access control (`admin`, `coach`, `client`) for Pro Care features.
- **Starch Meal Strategy v1.0**: Behavioral coaching system for managing starchy vs. fibrous carbs.
- **Extended Onboarding System v1.0**: A multi-step wizard for builder selection during signup.
- **Meal Card Share + Translate System v1.0**: Replaced copy function with native Share and Translate toggle using GPT-4o-mini for cached translation.
- **Local Meal Reminders v1.0**: Device-local notification system using `@capacitor/local-notifications`.
- **Guest Suite Guided Unlock Flow v1.2**: Progressive feature unlocking for unauthenticated users with a 14-day trial and a 4 "meal day" limit, encouraging complete meal day building.
- **Pro Tip Audio Card v1.0**: Global instructional audio feature on all Meal Builder pages teaching macro accuracy.
- **Prepare with Chef System v1.0**: Global guided cooking mode accessible from any meal card, reusing the Chef's Kitchen Phase Two UI for step-by-step navigation and audio guidance.
- **Profile Photo Upload**: Fully functional feature for users to upload profile photos to object storage.
- **Builder Switch Limit System v1.0 (DISABLED)**: Infrastructure to limit users to 3 meal builder switches per rolling 12 months. Database table `builder_switch_history` tracks all switches. Feature flag `ENFORCE_SWITCH_LIMITS` in `server/services/builderSwitchService.ts` controls enforcement (currently `false`). UI components in `MealBuilderSelection.tsx` are commented out. To enable: set `ENFORCE_SWITCH_LIMITS = true` and uncomment UI code.
- **Draft Persistence System v2.0**: Prevents data loss from page refresh/reload and background refetch overwrites. Key files: `client/src/hooks/useMealBoardDraft.ts`. Features:
  - **Content-Based Hashing**: djb2 hash algorithm over normalized meal content (id, title, servings, nutrition, ingredients, instructions) to detect meaningful changes
  - **localStorage Persistence**: Drafts saved to localStorage with userId+builderId+weekStartISO key, 24-hour TTL
  - **Auto-save on visibility change/beforeunload**: Drafts automatically saved when user switches tabs or closes browser
  - **Dirty Flag Protection**: `dirtyRef` tracks in-session edits, `draftRestoredRef` tracks restored drafts - both block server sync
  - **skipServerSync()**: Returns true when draft restored OR board modified, preventing background refetch from overwriting local edits
  - **Clean Coordination**: `markClean()` + `clearDraft()` called in all 6 builder saveBoard callbacks after successful server save
  - **Builders Integrated**: WeeklyMealBoard, GLP1MealBuilder, DiabeticMenuBuilder, AntiInflammatoryMenuBuilder, GeneralNutritionBuilder, PerformanceCompetitionBuilder
- **Update Manager System v1.0**: Non-blocking app update flow following "Big App" standard (never auto-reload during normal use). Key files: `client/src/contexts/UpdateManagerContext.tsx`, `client/src/components/GlobalUpdateBanner.tsx`, `client/src/hooks/useVersionCheck.ts`, `client/src/lib/updateApp.ts`, `client/src/lib/pushClient.ts`. Features:
  - **Event-Driven Updates**: Version checks and service worker updates dispatch `mpm:updateAvailable` event instead of auto-reloading
  - **GlobalUpdateBanner**: Dismissible banner "Update Available — Refresh when ready" with manual refresh button
  - **User-Controlled Timing**: Users decide when to refresh, preventing interruption during active work
- **Guided Macro Calculator v1.0**: Step-by-step walkthrough experience for the Macro Calculator page with "Talk to Chef" entry point. Features 13 guided steps (Goal, Body Type, Units, Sex, Age, Height, Weight, Activity, Sync Weight, Metabolic Considerations, Results Reveal, Starch Strategy, Final Save) using dropdowns for selections and input fields for numeric values. Users with existing saved settings bypass the guided flow. Includes Chef voice narration via TTS at each step using scripts from `macroCalculatorScripts.ts`.
- **StudioWizard System v1.0**: Shared component (`client/src/components/studio-wizard/StudioWizard.tsx`) for creating guided "Powered by Emotion AI" experiences. Configurable via StudioConfig with branding (title, emoji, colors, icon), steps (title, question, voiceScript, inputType), scripts (ready, generating, complete), apiEndpoint, servingsStepIndex (explicit step for servings buttons), and buildPrompt function. Used by Craving Studio, Dessert Studio, and Fridge Rescue Studio.
- **Craving Studio v1.0**: Guided step-by-step craving creation at `/craving-studio` with Chef voice narration. Steps: Craving Description, Meal Type, Servings, Dietary Preferences.
- **Dessert Studio v1.0**: Guided step-by-step dessert creation at `/dessert-studio` with Chef voice narration. Steps: Dessert Category, Flavor Family, Servings, Dietary Preferences.
- **Fridge Rescue Studio v1.0**: Guided ingredient-based meal creation at `/fridge-rescue-studio` with Chef voice narration. Steps: Available Ingredients, Preferred Meal Style, Servings, Dietary Restrictions.
- **Two-Feature Creator Pattern v1.0**: All creator pages (Craving Creator, Dessert Creator, Fridge Rescue) offer two distinct creation modes: "Create with Chef" (guided studio with voice) and "Quick Create" (fast form-based interface). Each page displays both options clearly with visual separation.
- **Create with Chef Branding v1.0**: All "Create with Chef" entry points use amber/orange Chef's Kitchen illumination (`rgba(251,146,60,0.75), rgba(239,68,68,0.35)`) with black-to-orange gradient card backgrounds (`from-black via-orange-950/40 to-black`) and "Powered by Emotion AI™" badges.
- **Profile Single Source of Truth (SSOT) Architecture**: Both Onboarding and Edit Profile read/write the same `users` table. Meal builders read user data from the same source. No separate onboarding or profile tables - unified data flow.
  - **Onboarding**: Saves via `/api/onboarding/step/standalone-profile` → `mergeStepIntoPreferences` → `users` table
  - **Edit Profile**: Saves via `/api/users/profile` → `users` table directly
  - **Meal Builders**: Read from `users` table via `loadSafetyProfile()` and `user.allergies`
- **MPM SafetyGuard v1.1**: Two-layer food safety system with authenticated override capability. Apple App Store compliant language. Features:
  - **Single Source of Truth**: `users.allergies` column in database - both onboarding and Edit Profile read/write same field
  - **Safety PIN System**: 4-6 digit PIN for authenticated allergy overrides (bcrypt hashed, never stored plaintext)
    - Set during onboarding (optional, can skip)
    - Manageable via SafetyPinSettings component
    - Required for CUSTOM_AUTHENTICATED mode overrides
    - Rate-limited: 5 attempts max, 15-minute lockout
  - **Safety Modes**: STRICT (default, full enforcement), CUSTOM (allow preference substitutions), CUSTOM_AUTHENTICATED (allows allergy override after PIN verification)
  - **One-Time Override Tokens**: Issued after successful PIN verification, valid for 5 minutes, consumed on use
  - **Audit Logging**: All overrides logged to `safety_override_audit_logs` table with userId, mealRequest, allergen, builderId
  - **Pre-Generation Blocking**: Two complementary systems:
    - `enforceSafetyProfile()` in `safetyProfileService.ts` - Returns SAFE/AMBIGUOUS/BLOCKED with suggestions, accepts SafetyOptions for override tokens
    - `preCheckRequest()` in `allergyGuardrails.ts` - Returns blocked/violations for immediate termination
  - **Protected Endpoints**: All meal generators enforce safety at request boundary:
    - Main routes.ts: /api/meals/generate, /api/meals/craving-creator, /api/meals/kids, /api/meals/ai-creator, /api/meals/holiday-feast, /api/meals/fridge-rescue, /api/ai/generate-meal-plan, /api/generate-craving-meal
    - Separate routers: dessert-creator.ts, craving-creator.ts, fridge-rescue.ts, mealEngine.routes.ts
  - **Post-Generation Validation**: `validateGeneratedMeal()` scans output (name, description, ingredients, instructions) and blocks meals containing allergens
  - **Allergen Taxonomy**: Category → Family → TermBank expansion covering Shellfish (crustaceans, mollusks), Fish, Peanuts, Tree Nuts, Dairy, Eggs, Soy, Gluten, Sesame, plus 100+ variants, dishes (paella, pad thai, satay), and misspellings
  - **Ambiguous Dish Detection**: Warns users when requesting dishes that commonly contain allergens (jambalaya, pad thai, curry, etc.)
  - **Audit Logging**: All safety blocks logged with userId, builderId, matchedTerms, and timestamp
  - Key files: `server/services/safetyProfileService.ts`, `server/services/allergyGuardrails.ts`

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions`.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.