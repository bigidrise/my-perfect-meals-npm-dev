# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available on the Apple App Store. It provides personalized dietary solutions, leveraging AI for meal generation, visual alignment, and real-time clinical data integration. The project aims to offer a seamless full-stack experience for efficient meal management and advanced nutritional insights, serving a real business with active subscriptions and payments.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.
**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.

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

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions`.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.