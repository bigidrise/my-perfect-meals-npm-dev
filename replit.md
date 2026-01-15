# My Perfect Meals - Full-Stack Application

## 🚨 AGENT ONBOARDING — READ THIS FIRST (Jan 2026)

**What This Project Is:**
My Perfect Meals (MPM) is a **LIVE production app in the Apple App Store**. It's a comprehensive AI-powered meal planning and nutrition tracking application. Users pay for subscriptions, this is a real business.

**Current Status:**
- ✅ **App Store LIVE** — iOS app approved and available for download
- ✅ **Production deployed** — Replit Autoscale deployment
- ✅ **Stripe payments active** — Web billing works
- ✅ **StoreKit 2 active** — iOS in-app purchases work
- ✅ **AI meal generation working** — OpenAI GPT-4 + DALL-E 3

**How Development Works:**
1. **This is the DEVELOPMENT environment** — Make changes here, test, then deploy to production
2. **Production is separate** — There's a production Replit space that gets deployed
3. **iOS builds** — Changes that affect iOS require Xcode builds and TestFlight/App Store submission
4. **Database** — PostgreSQL via Replit's built-in database. Dev and prod have separate databases.

**Critical Rules:**
1. **ASK before major changes** — User prefers iterative development with approval
2. **DO NOT modify Meal Visual Alignment System v1** without explicit approval (AI prompts, image prompts, ensureImage logic, S3 upload logic)
3. **Read `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md`** for product decisions about starch strategy and intentionally hidden features
4. **iOS compliance is critical** — App Store Guidelines 3.1.1 (no external payment references on iOS) and 1.4.1 (medical citations required)

**Key External Services:**
- OpenAI API — AI meal generation + DALL-E 3 images
- Amazon S3 — Meal image storage
- Stripe — Web payment processing
- Apple StoreKit 2 — iOS in-app purchases
- Twilio — SMS (optional)
- SendGrid/Resend — Email

**When Starting Fresh (New Replit Space):**
If you're in a new/remixed environment and see database errors about missing columns, you may need to sync the database schema. Common missing columns include: `profile_photo_url`, `role`, `is_pro_care`, `active_board`, `onboarding_completed_at`, `macros_defined`, `starch_plan_defined`, `onboarding_mode`. Add them with `ALTER TABLE users ADD COLUMN IF NOT EXISTS...`.

**Quick Health Check:**
- Run `npm run dev` to start the server
- Check `/api/health` endpoint for AI and S3 status
- If meal generation is instant (<2 seconds), AI is NOT working (should take 15-30 seconds)

---

## Overview
My Perfect Meals is a comprehensive meal planning and nutrition tracking application that provides AI-powered, personalized dietary solutions. It offers a seamless full-stack experience for health-conscious individuals, leveraging AI for meal generation, visual meal alignment, and real-time clinical data integration for specific health conditions like diabetes. The project aims to empower users with efficient meal management and advanced nutritional insights.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.

**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.

## System Architecture
The application is a monorepo built with React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend. PostgreSQL with Drizzle ORM handles data persistence. OpenAI GPT-4 provides AI meal generation, including DALL-E 3 for image generation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Fixed shell with `100dvh` and a single scroll container to prevent iOS WKWebView scrolling issues. Pages manage their own safe-area insets.
- **Guided Tour System**: Page-specific tips via `QuickTourModal`.
- **iOS Mobile Touch Fix**: Global CSS fixes in `client/src/index.css` for iOS button behavior.
- **Scientific Transparency**: `MedicalSourcesInfo` component provides citations for nutritional calculations.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located.
- **Server Configuration**: Express server on port 5000, serving APIs and client.
- **Database**: PostgreSQL with Drizzle ORM, schema in `/shared/schema.ts`, with automatic migrations.
- **AI Stability Architecture**: Route-aware health monitoring for AI-required routes.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals have accurately matched DALL-E 3 images, uploaded to S3.
- **Copilot Re-Engagement Architecture**: Separates autoplay from manual invocation for the "Chef" feature with session tracking.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface to include `starchyCarbs` and `fibrousCarbs` for accurate carb tracking, influencing AI prompts and response parsing.
- **Carb Enforcement System v1.0**: `server/utils/carbClassifier.ts` provides ingredient-based carb derivation post-parsing, before saving, ensuring UI never invents macros.
- **Chicago Calendar Fix v1.0**: All date math is anchored at UTC noon using helper functions to prevent "one day off" bugs.
- **Hub Coupling Framework v1.0**: Modular plugin architecture in `server/services/hubCoupling/` allows different health "hubs" (Diabetic, Competition Pro, GLP-1, Anti-Inflammatory) to inject context, guardrails, and validation into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Advisory-only intelligence layer for clinicians in ProCare Dashboard, providing macro adjustment suggestions based on toggled conditions (e.g., menopause, insulin resistance).
- **Clinical Advisory User-Facing v1.0**: Provides user access to the same clinical advisory conditions in the Macro Calculator for consistent delta calculations.
- **ProCare Workspace System v1.0**: Modal-based workspace selection for professionals managing clients, routing to Trainer or Clinician dashboards.
- **Role-Based Access Control v1.0**: Three-tier access control (`admin`, `coach`, `client`) for Pro Care features, with server-side enforcement and frontend filtering.
- **Builder Transition Page v1.0**: A control panel at `/select-builder` for existing subscribers to change their meal builder based on life changes, not an acquisition funnel.
- **Starch Meal Strategy v1.0**: Behavioral coaching system for managing starchy vs. fibrous carbs, allowing users to choose "One Starch Meal" or "Flex Split" strategies.
- **Extended Onboarding System v1.0**: A 5-step wizard at `/onboarding/extended` for builder selection during signup, with a specialized 3-step path for ProCare users.
- **Meal Card Share + Translate System v1.0**: Replaced copy function with native Share and Translate toggle on meal cards, using GPT-4o-mini for content-hash cached translation.
- **Local Meal Reminders v1.0**: Device-local notification system using `@capacitor/local-notifications` for up to 3 daily meal reminders.
- **iOS Build Workflow**: Supports building with a remote server URL (for TestFlight/App Store) or locally served `dist` folder.
- **iOS App Store Compliance v1.2** (Jan 2026): Full compliance with Guidelines 3.1.1 and 1.4.1:
  - Updated `isIosNativeShell()` to use Capacitor's `isNativePlatform()` and `getPlatform()` for reliable iOS detection during Apple App Review.
  - Added inline citations with NIH/USDA links directly under macro calculation results in `MacroCounter.tsx` to satisfy Guideline 1.4.1.
  - Completely rewrote iOS PricingPage to show StoreKit purchase buttons (Basic $9.99, Premium $19.99, Ultimate $29.99) instead of redirecting to website.
  - Implemented Apple subscription deep-link using `@capacitor/app-launcher` with `openAppleSubscriptions()` function.
  - Removed ALL references to web billing/external payments on iOS to satisfy Guideline 3.1.1.
- **Guest Suite Guided Unlock Flow v1.2** (Jan 2026): Progressive feature unlocking for unauthenticated users with 14-day trial, 4 "meal day" limit:
  - Phase 1 (Initial): Macro Calculator + Weekly Meal Builder available
  - Phase 2 (After first meal + shopping viewed): Biometrics, Shopping List, Fridge Rescue, Craving Creator unlocked
  - **Meal Day = 24-Hour Session**: Entering Weekly Meal Board WITHOUT an active session consumes 1 of 4 meal days. Session lasts 24 hours, allowing guests to freely explore Fridge Rescue, Craving Creator, and return to the meal board without burning additional days.
  - **Fridge Rescue & Craving Creator are FREE**: These are "idea generators" — guests can explore freely. Adding to meal plan routes to Weekly Meal Board but only consumes a day if no active session exists.
  - Functions: `startMealBoardVisit()` checks/starts 24h session, `hasActiveMealDaySession()`, `getActiveMealDaySessionRemaining()` for session awareness
  - Soft nudge at 3 meal days, hard gate at 4 meal days redirecting to pricing
  - Key files: `client/src/lib/guestMode.ts`, `client/src/lib/guestSuiteBranding.ts`, `client/src/lib/guestSuiteNavigator.ts`, `client/src/hooks/useGuestProgress.ts`, `client/src/hooks/useGuestNavigationGuard.ts`, `client/src/pages/GuestBuilder.tsx`, `client/src/pages/WeeklyMealBoard.tsx`
  - **Navigation Enforcement v1.0**: Linear flow enforcement on Shopping List and Biometrics pages:
    - Bottom navigation hidden on these pages in guest mode
    - `useGuestNavigationGuard` hook intercepts browser back button attempts
    - Session marker (`mpm_guest_from_shopping`) tracks Shopping → Biometrics transition
    - First loop marked complete ONLY when biometrics confirms session marker presence
  - **Coaching Philosophy**: MPM is "coach in your pocket" - supportive but serious. The app talks to users, not just provides tools. Guest Suite messaging encourages building COMPLETE meal days (breakfast, lunch, dinner, snacks), actually cooking them, and using passes wisely. Tone is cheerleader + drill sergeant.
  - **Guest Copilot Marketing Scripts v1.0**: Guest-specific Copilot explanations delivered via `getGuestPageExplanation(pathname, isGuestMode())` with `guestSpokenText` and `guestDescription` fields in `CopilotPageExplanations.ts`. Marketing-focused copy per page:
    - Macro Calculator: "We personalize, not guess"
    - Weekly Meal Board: "Structure beats willpower — this pass counts, build the full day"
    - Shopping List: "Planning turns into action — real-world execution"
    - Biometrics: "Food → numbers → feedback — progress lens"
    - Fridge Rescue: "Life happens, we adapt — use what you have"
    - Craving Creator: "We redesign cravings — stay satisfied, stay on plan"
- **Pro Tip Audio Card v1.0** (Jan 2026): Global instructional audio feature on all Meal Builder pages teaching macro accuracy:
  - Positioned between Snack section and Daily Targets card on all builders
  - Uses existing Copilot TTS system (`ttsService.speak`) for audio playback
  - Button matches Copilot toggle style with amber (idle) / green (playing) states
  - Single canonical script stored in `client/src/components/copilot/scripts/proTipScript.ts`
  - Teaches: specificity in meal requests, how to use Quick Add, macro accuracy tips
  - Tone: Neutral, system-focused, instructional (~30 seconds)
  - Key files: `client/src/components/ProTipCard.tsx`, all Meal Builder pages
- **Prepare with Chef System v1.0** (Jan 2026): Global guided cooking mode reusing Chef's Kitchen Phase Two:
  - Any meal card with instructions shows "Prepare with Chef" button (lime-600 color)
  - Button stores meal in `mpm_chefs_kitchen_meal` + sets `mpm_chefs_kitchen_external_prepare` flag
  - Routes to `/chefs-kitchen` which enters `mode: "prepare"` directly
  - Reuses existing Phase Two UI in `ChefsKitchenPage.tsx` (no separate page needed)
  - Features: step-by-step navigation, auto-detected timers, "Listen to Chef" voice, session persistence
  - Key files: `client/src/pages/lifestyle/ChefsKitchenPage.tsx`, `client/src/components/ui/meal-card.tsx`, `client/src/components/MealCardActions.tsx`
  - Architecture rule: One system, two entry points (internal from Chef's Kitchen, external from any meal card)

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For payment processing.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions` plugin.

## Deployment Safety System v1.0 (Jan 2026)
Automated safeguards to prevent production issues and catch regressions early.

**Boot-Time Health Logging**:
- Production server logs critical service status at startup
- Shows OpenAI key presence, S3 bucket, database connection
- Look for `[BOOT]` entries in logs to verify configuration

**Fallback Usage Tracking**:
- `server/services/fallbackMealService.ts` logs 🚨 FALLBACK ALERT when fallback meals are used
- Fallback usage indicates OpenAI is not working
- Stats available via `/api/health` endpoint

**Health Endpoint** (`/api/health`):
- `hasOpenAI: true/false` - Is OpenAI connected?
- `openAIKeyLength: number` - Key length (non-zero = configured)
- `hasS3: true/false` - Is S3 image storage configured?
- `aiHealth.fallbacksUsed` - Number of times fallback meals were served
- `aiHealth.healthy` - Overall AI health status

**Release Checklist**: See `/docs/RELEASE_CHECKLIST.md` for pre-deployment verification steps.

**Production Handoff Document**: See `/docs/PRODUCTION_HANDOFF.md` for complete context on deployment safety systems, the Jan 2026 incident, and how to diagnose issues.

**Critical Files That Must Stay In Sync**:
- `server/prod.ts` and `server/index.ts` - Both must have VITE_OPENAI_API_KEY aliasing
- Drift between these files caused the Jan 2026 production fallback bug

**Quick Sanity Check**:
- If meal generation is INSTANT (< 2 seconds), AI is not working
- Real AI generation takes 15-30 seconds

## Re-Enabled Features

### Profile Photo Upload (Jan 2026)
**Status**: ACTIVE — fully functional on web and iOS.

**Context**: Profile photo upload was previously deferred during iOS builds due to camera permission instability. Now that MacroScan camera and Capacitor permissions are stable, the feature is re-enabled.

**How it works**:
- Users tap their profile avatar on the Profile page to select a photo
- Uses standard file input (photo library by default, camera as option)
- Uploads to object storage via `/api/uploads/request-url`
- Saves URL to user profile via `/api/users/profile-photo`
- Database column `profile_photo_url` stores the URL

**Key files**:
- `client/src/pages/Profile.tsx` - Upload UI with camera icon overlay
- `server/routes.ts` - `/api/users/profile-photo` endpoint