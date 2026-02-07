# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available on the Apple App Store. It offers personalized dietary solutions, leveraging AI for meal generation, visual alignment, and real-time clinical data integration. The project aims to provide a seamless full-stack experience for efficient meal management and advanced nutritional insights, serving a real business with active subscriptions and payments.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.
**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.
**iOS Button Rule**: NEVER use `active:opacity-XX` classes on buttons - this causes "ghost transparency" on iOS tap. Use `active:scale-[0.98]` for tactile feedback instead. Global safeguard in `client/src/index.css` enforces `opacity: 1 !important` on all button active states.
**iOS No-Hover Rule**: NEVER use `hover:` classes on buttons or interactive elements - this causes flashing on iOS tap. The app is mobile-first; hover states are killed globally via CSS nuclear option in `client/src/index.css`. For feedback, use `active:scale-[0.98]` only.
**Hide-Don't-Remove Rule**: When disabling a feature from a page, prefer hiding it (conditional render, `hidden` class, or `{false && ...}`) over removing the code entirely. This is safer for stability — it avoids accidentally breaking other systems that may depend on the wiring. Only fully remove code when the component is completely self-contained with no shared state or callbacks.
**Deployment Workflow**: This is the maindev space. After every significant change, ask "Ready to push to production?" and provide the git command: `git push origin production`
**Session Tracking**: Track all changes between pushes. A session is only closed when user provides a push receipt. Push often to catch mistakes faster and make rollbacks easier. When session closes, move changelog to Release History.
**Push Protocol (MANDATORY — NO EXCEPTIONS)**: Every single push MUST update the What's New banner. When user says "let's push" or "we're pushing" — update `client/public/release-manifest.json` with the new version number and a `changes` array listing what was updated. Also bump the version in `client/src/lib/releaseNotes.ts`. This is NON-NEGOTIABLE. Never push without updating the banner. Users see honest, real-time release notes in the expandable What's New banner — skipping this breaks trust.

## System Architecture
The application is a monorepo built with React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend, utilizing PostgreSQL with Drizzle ORM for data persistence. OpenAI GPT-4 powers AI meal generation, including DALL-E 3 for image creation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Uses a fixed shell with `100dvh` and a single scroll container for optimal iOS WKWebView performance.
- **Scientific Transparency**: Nutritional calculations are supported by citations via the `MedicalSourcesInfo` component.
- **iOS App Store Compliance**: Adheres to Apple guidelines for payments (StoreKit 2) and medical citations.
- **Modal UI Patterns**: Consistent dark glassmorphic modals for various interactions (Coming Soon, Delete Confirmation, Allergy Alert).

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend code are co-located.
- **Database**: PostgreSQL with Drizzle ORM, automatic migrations, and shared schema.
- **AI Stability Architecture**: Route-aware health monitoring for AI-dependent routes.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals have accurately matched DALL-E 3 images, stored on S3.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface for detailed carb tracking.
- **Carb Enforcement System v1.0**: Derives ingredient-based carb information post-parsing.
- **Hub Coupling Framework v1.0**: Modular plugin architecture for health "hubs" to inject context into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Provides clinical macro adjustment suggestions.
- **Role-Based Access Control v1.0**: Three-tier access control (`admin`, `coach`, `client`) for Pro Care features.
- **ProCare Workspace Branding v1.0**: Two distinct professional workspaces: Physicians Clinic and Trainer Studio, with builder assignment.
- **Professional Intro Overlay v1.0**: Front-end only introductory overlay shown once per workspace on first entry, stored in localStorage.
- **Starch Meal Strategy v1.0**: Behavioral coaching system for carb management.
- **Extended Onboarding System v1.0**: Multi-step wizard for builder selection during signup.
- **Meal Card Share + Translate System v1.0**: Replaces copy function with native share and GPT-4o-mini powered translation.
- **Local Meal Reminders v1.0**: Device-local notification system.
- **Guest Suite Guided Unlock Flow v1.2**: Progressively unlocks features for unauthenticated users with trial limits.
- **Pro Tip Audio Card v1.0**: Global instructional audio feature on Meal Builder pages.
- **Prepare with Chef System v1.0**: Global guided cooking mode accessible from any meal card.
- **Profile Photo Upload**: Allows users to upload profile photos to object storage.
- **Builder Switch Limit System v1.2**: Infrastructure to limit builder switches, configurable by a feature flag.
- **Draft Persistence System v2.0**: Prevents data loss using content-based hashing and localStorage.
- **What's New System v3.0**: Enhanced release notification system with expandable changelog.
- **Guided Macro Calculator v1.0**: Step-by-step walkthrough for the Macro Calculator page with Chef voice narration.
- **StudioWizard System v1.0**: Shared component for guided "Powered by Emotion AI" experiences (Craving, Dessert, Fridge Rescue Studios).
- **Craving Studio v1.0, Dessert Studio v1.0, Fridge Rescue Studio v1.0**: Guided creation experiences with Chef voice narration.
- **Two-Feature Creator Pattern v1.0**: All creator pages offer "Create with Chef" (guided studio) and "Quick Create" (form-based) modes.
- **Create with Chef Branding v1.0**: Consistent amber/orange branding with "Powered by Emotion AI™" badges for guided creation entry points.
- **Profile Single Source of Truth (SSOT) Architecture**: Unified data flow for user profile information across onboarding, editing, and meal builders.
- **MPM SafetyGuard v1.2**: Two-layer food safety system with authenticated override capabilities, PIN protection for allergy editing, and audit logging.
- **SafetyGuard Unified Alert System v1.0**: Provides consistent preflight checking and yellow banner alerts across all meal generators.
- **GlucoseGuard™ System v1.0**: (Diabetic Hub ONLY) Real-time blood glucose monitoring and meal adjustment based on current glucose state.
- **Starch Guard v1.0**: (Weight Management System for EVERYONE) Limits high-glycemic carbs based on a science-based classification, offering user choices for substitutes.
- **Meal Generation Facade v1.0**: Architectural pivot to a precompiled recipe library (LibraryEngine) for live meal generation to solve cross-origin issues.
- **Palate Preferences System v1.0**: User flavor customization for meal seasoning without affecting macros, collected during onboarding and editable in profile.
- **Font Size Preference System v1.0**: Accessibility feature allowing users to choose text size (Standard/Large/XL) via CSS custom properties.
- **Nutrition Budget Engine v1.0 (Phase 1 + Phase 2)**: Global macro-aware system tracking daily nutrition limits, primarily focusing on Protein, Starchy Carbs, and Fibrous Carbs, with read-only awareness and soft coaching warnings.
- **Just Describe It v1.0**: AI-powered macro estimation for real-world eating, allowing users to describe food in plain language for macro logging.
- **Quick View Direct Add v1.0**: Streamlined macro logging flow, allowing direct logging from Quick View with a single tap.
- **Body Composition Tracking System v1.0**: Database-first body fat percentage tracking with scan method support (DEXA, BodPod, Calipers, Smart Scale, Other). Integrates with Macro Calculator and affects starch allocation in Beach Body and Performance/Competition builders. Formula: BF% ≥ goal+5% reduces starch slots by 1, within ±3% no change, below goal +1 slot (Performance only). Strict precedence: trainer override > physician > client entries regardless of recency.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Apple StoreKit 2**: For iOS in-app purchases.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.