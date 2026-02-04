# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available on the Apple App Store. It offers personalized dietary solutions, leveraging AI for meal generation, visual alignment, and real-time clinical data integration. The project aims to provide a seamless full-stack experience for efficient meal management and advanced nutritional insights, serving a real business with active subscriptions and payments.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.
**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.
**iOS Button Rule**: NEVER use `active:opacity-XX` classes on buttons - this causes "ghost transparency" on iOS tap. Use `active:scale-[0.98]` for tactile feedback instead. Global safeguard in `client/src/index.css` enforces `opacity: 1 !important` on all button active states.
**Deployment Workflow**: This is the maindev space. After every significant change, ask "Ready to push to production?" and provide the git command: `git push origin production`
**Session Tracking**: Track all changes between pushes. A session is only closed when user provides a push receipt. Push often to catch mistakes faster and make rollbacks easier. When session closes, move changelog to Release History.
**Push Protocol**: When user says "let's push" or "we're pushing" — update `client/public/release-manifest.json` with the new version number and a `changes` array listing what was updated. Also bump the version in `client/src/lib/releaseNotes.ts`. This ensures users see honest, real-time release notes in the expandable What's New banner.

## System Architecture
The application is a monorepo built with React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend, utilizing PostgreSQL with Drizzle ORM for data persistence. OpenAI GPT-4 powers AI meal generation, including DALL-E 3 for image creation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Uses a fixed shell with `100dvh` and a single scroll container for optimal iOS WKWebView performance.
- **Scientific Transparency**: Nutritional calculations are supported by citations via the `MedicalSourcesInfo` component.
- **iOS App Store Compliance**: Adheres to Apple guidelines for payments (StoreKit 2) and medical citations.
- **Modal UI Patterns (Preferred)**: Always use consistent modal patterns for user interactions:
  - **Coming Soon Modal**: Use `GatedRoute` component with black glass button styling for gated features. Button text should be "Go Back" and navigate to previous page (not home).
  - **Delete Confirmation Modal**: Use consistent delete confirmation dialogs before destructive actions.
  - **Allergy Alert Modal**: Use for safety-critical allergen warnings with clear, prominent styling.
  - All modals should use: dark glassmorphic backgrounds, white text, black glass buttons with white text and border-white/20 borders.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend code are co-located.
- **Database**: PostgreSQL with Drizzle ORM, employing automatic migrations and a shared schema.
- **AI Stability Architecture**: Includes route-aware health monitoring for AI-dependent routes.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals have accurately matched DALL-E 3 images, stored on S3.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface for detailed carb tracking (`starchyCarbs`, `fibrousCarbs`).
- **Carb Enforcement System v1.0**: `server/utils/carbClassifier.ts` derives ingredient-based carb information post-parsing.
- **Hub Coupling Framework v1.0**: A modular plugin architecture (`server/services/hubCoupling/`) for health "hubs" to inject context into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Provides clinical macro adjustment suggestions.
- **Role-Based Access Control v1.0**: Three-tier access control (`admin`, `coach`, `client`) for Pro Care features.
- **ProCare Workspace Branding v1.0**: Two distinct professional workspaces: **Physicians Clinic** (medical oversight, guardrails, clinical nutrition) and **Trainer Studio** (coaching, personalization, performance meal planning). Pro builders (General Nutrition, Performance/Competition) require trainer assignment via `/api/pro/assign-builder` endpoint.
- **Professional Intro Overlay v1.0**: Front-end only intro overlay (like Chef's Kitchen) shown once per workspace on first entry. Uses `ProfessionalIntroOverlay` component with role-specific content (trainer/physician). Stored in localStorage (`mpm_hide_trainer_studio_intro`, `mpm_hide_physician_clinic_intro`). Includes: welcome hero, purpose explanation, "What This Is NOT" disclaimers (HIPAA-safe), quick start guide, tools list, and "Never show again" toggle. No backend, no routes, purely instructional.
- **Starch Meal Strategy v1.0**: A behavioral coaching system for carb management.
- **Extended Onboarding System v1.0**: A multi-step wizard for builder selection during signup.
- **Meal Card Share + Translate System v1.0**: Replaces copy function with native share and GPT-4o-mini powered translation.
- **Local Meal Reminders v1.0**: Device-local notification system using `@capacitor/local-notifications`.
- **Guest Suite Guided Unlock Flow v1.2**: Progressively unlocks features for unauthenticated users with trial limits.
- **Pro Tip Audio Card v1.0**: Global instructional audio feature on Meal Builder pages.
- **Prepare with Chef System v1.0**: Global guided cooking mode accessible from any meal card, reusing existing UI.
- **Profile Photo Upload**: Allows users to upload profile photos to object storage.
- **Builder Switch Limit System v1.1**: Infrastructure to limit builder switches. Feature flag `ENFORCE_SWITCH_LIMITS` in `server/services/builderSwitchService.ts` (currently `false` = unlimited). At launch: set to `true` to enforce 3 switches/year limit. Future monetization: $29.99 "Unlimited Builder Switching" add-on to bypass limit.
- **Draft Persistence System v2.0**: Prevents data loss using content-based hashing, localStorage persistence, and dirty flag protection across multiple meal builders.
- **What's New System v3.0**: An enhanced release notification system with expandable changelog. Uses `release-manifest.json` (with `changes[]` array), `WhatsNewBanner.tsx` component, and `useReleaseNotice` hook. Users can tap to see actual update details before refreshing.
- **Guided Macro Calculator v1.0**: A step-by-step walkthrough for the Macro Calculator page with Chef voice narration, supporting 13 guided steps.
- **StudioWizard System v1.0**: A shared component (`client/src/components/studio-wizard/StudioWizard.tsx`) for creating guided "Powered by Emotion AI" experiences, used by Craving, Dessert, and Fridge Rescue Studios.
- **Craving Studio v1.0, Dessert Studio v1.0, Fridge Rescue Studio v1.0**: Guided step-by-step creation experiences with Chef voice narration for cravings, desserts, and ingredient-based meals.
- **Two-Feature Creator Pattern v1.0**: All creator pages offer both "Create with Chef" (guided studio) and "Quick Create" (form-based) modes.
- **Create with Chef Branding v1.0**: Consistent amber/orange branding with "Powered by Emotion AI™" badges for guided creation entry points.
- **Profile Single Source of Truth (SSOT) Architecture**: Onboarding, Edit Profile, and Meal Builders all read/write from the same `users` table for unified data flow.
- **MPM SafetyGuard v1.2**: A two-layer food safety system with authenticated override capabilities, compliant with Apple App Store guidelines. Features include a Safety PIN system, multiple safety modes (STRICT, CUSTOM, CUSTOM_AUTHENTICATED), one-time override tokens, audit logging, pre-generation blocking, post-generation validation, and extensive allergen taxonomy. Now includes **PIN-protected allergy editing** in Edit Profile - users must verify their Safety PIN before modifying allergies to prevent accidental changes to critical safety data.
- **SafetyGuard Unified Alert System v1.0**: Provides consistent preflight checking and yellow banner alerts across all meal generators, utilizing a dedicated preflight API and a reusable `SafetyGuardBanner` component.
- **GlucoseGuard™ System v1.0**: Diabetic meal protection that automatically adjusts meal generation based on real-time glucose state. Uses `GlucoseGuardToggle.tsx` (amber pill button) and `GlucoseGuardBanner.tsx` (status alerts). Integrates with Diabetic Hub Coupling (`server/services/hubCoupling/hubModules/diabetic.ts`) to inject glucose-based guidance into AI prompts. Color scheme: amber (elevated/high), rose (low), teal (in-range). **Deployed to creative features** (Craving Creator, Dessert Creator, Fridge Rescue, Studios, Create with Chef, Snack Creator) + Diabetic Meal Builder. Other meal builders (Weekly, GLP-1, Anti-Inflammatory, Beach Body) show SafetyGuard only since diabetics use the Diabetic Builder.
- **Meal Generation Facade v1.0**: Architectural pivot from live AI generation to precompiled recipe library (LibraryEngine) to solve cross-origin/CORS issues in production iOS environments. Uses 3 database tables (`meal_library_items`, `meal_library_usage`, `meal_generation_jobs`), feature flag engine selection (`STUDIO_ENGINE_CRAVING|FRIDGE|DESSERT`), and multi-layer scoring (craving tags, emotion tags, novelty penalty, quality score). Endpoint: `POST /api/studio/generate`. Seed script: `server/scripts/seedMealLibrary.ts`.
- **Palate Preferences System v1.0**: User flavor customization for meal seasoning without affecting macros. Three preferences: `palateSpiceTolerance` (none/mild/medium/hot), `palateSeasoningIntensity` (light/balanced/bold), `palateFlavorStyle` (classic/herb/savory/bright). Collected in onboarding Step 3, editable in Edit Profile Step 3, injected into AI meal generation prompts via `buildPalateSection()` in `server/services/promptBuilder.ts`.
- **Font Size Preference System v1.0**: Accessibility feature allowing users to choose text size (Standard/Large/XL). Uses CSS custom property `--font-scale` with root classes (`font-size-standard`, `font-size-large`, `font-size-xl`) applied to `<html>`. Stored in `users.fontSizePreference` column + localStorage fallback. UI selector in ProfileSheet with "A", "A+", "A++" buttons. Provider: `FontSizeContext.tsx`, API: `PUT /api/users/profile`.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions`.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.