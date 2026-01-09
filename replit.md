# My Perfect Meals - Full-Stack Application

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

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For payment processing.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions` plugin.