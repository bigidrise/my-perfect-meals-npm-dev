# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available on the Apple App Store. It provides personalized dietary solutions, leveraging AI for meal generation and visual meal alignment, and integrates real-time clinical data for specific health conditions. The project aims to offer users efficient meal management and advanced nutritional insights, supporting a comprehensive full-stack experience.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.

**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.

## System Architecture
The application is a monorepo utilizing React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend. Data is managed with PostgreSQL and Drizzle ORM. OpenAI GPT-4 is central to AI meal generation, including DALL-E 3 for image creation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Fixed shell with `100dvh` and a single scroll container, handling iOS WKWebView scrolling.
- **Guided Tour System**: Page-specific tips available via `QuickTourModal`.
- **iOS Mobile Touch Fix**: Global CSS fixes in `client/src/index.css` for iOS button behavior.
- **Scientific Transparency**: `MedicalSourcesInfo` component provides citations for nutritional calculations.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located.
- **Server Configuration**: Express server on port 5000.
- **Database**: PostgreSQL with Drizzle ORM, schema in `/shared/schema.ts`.
- **AI Stability Architecture**: Route-aware health monitoring for AI-required routes.
- **Meal Visual Alignment System v1**: Matches AI-generated meals with DALL-E 3 images, uploaded to S3.
- **Copilot Re-Engagement Architecture**: Separates autoplay from manual invocation for the "Chef" feature.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface to include `starchyCarbs` and `fibrousCarbs`.
- **Carb Enforcement System v1.0**: `server/utils/carbClassifier.ts` derives carb information from ingredients.
- **Chicago Calendar Fix v1.0**: Date math anchored at UTC noon to prevent timezone-related errors.
- **Hub Coupling Framework v1.0**: Modular plugin architecture for health "hubs" to inject context into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Advisory intelligence for clinicians in the ProCare Dashboard.
- **Clinical Advisory User-Facing v1.0**: Provides users access to clinical advisory conditions in the Macro Calculator.
- **ProCare Workspace System v1.0**: Modal-based workspace selection for professionals.
- **Role-Based Access Control v1.0**: Three-tier access control (`admin`, `coach`, `client`).
- **Builder Transition Page v1.0**: Allows existing subscribers to change meal builders.
- **Starch Meal Strategy v1.0**: Behavioral coaching system for managing starchy vs. fibrous carbs.
- **Extended Onboarding System v1.0**: A multi-step wizard for builder selection during signup.
- **Meal Card Share + Translate System v1.0**: Replaced copy function with native Share and Translate, using GPT-4o-mini for translations.
- **Local Meal Reminders v1.0**: Device-local notification system for meal reminders.
- **iOS App Store Compliance v1.2**: Ensures compliance with App Store Guidelines 3.1.1 and 1.4.1, including StoreKit purchases and removal of external payment references.
- **Guest Suite Guided Unlock Flow v1.2**: Progressive feature unlocking for unauthenticated users with a 14-day trial and 4 "meal day" limit. Includes navigation enforcement and marketing-focused Copilot explanations.
- **Pro Tip Audio Card v1.0**: Global instructional audio feature on Meal Builder pages teaching macro accuracy.
- **Prepare with Chef System v1.0**: Global guided cooking mode, reusing Chef's Kitchen Phase Two UI, accessible from any meal card.
- **Profile Photo Upload**: Allows users to upload profile photos, storing URLs to user profiles.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions`.