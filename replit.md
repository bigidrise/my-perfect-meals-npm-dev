# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available in the Apple App Store. It provides personalized dietary solutions, leveraging AI for meal generation, visual meal alignment, and real-time clinical data integration. The project aims to offer efficient meal management and advanced nutritional insights, supporting a comprehensive health-conscious lifestyle. It is a real business with active subscriptions and payments.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.

**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.

## System Architecture
The application is a monorepo utilizing React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend. PostgreSQL with Drizzle ORM manages data persistence. OpenAI GPT-4 is central to AI meal generation, including DALL-E 3 for image creation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Fixed shell with `100dvh` and single scroll container to prevent iOS WKWebView issues; pages manage their own safe-area insets.
- **Guided Tour System**: Page-specific tips via `QuickTourModal`.
- **Scientific Transparency**: `MedicalSourcesInfo` component provides citations for nutritional calculations.
- **iOS App Store Compliance**: Adherence to guidelines 3.1.1 (no external payments on iOS) and 1.4.1 (medical citations).

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located for streamlined development.
- **Database**: PostgreSQL with Drizzle ORM for schema management and migrations.
- **AI Stability Architecture**: Route-aware health monitoring for AI-required functionalities.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals have accurately matched DALL-E 3 images, uploaded to S3.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface for precise carb tracking (`starchyCarbs`, `fibrousCarbs`).
- **Carb Enforcement System v1.0**: Ingredient-based carb derivation `server/utils/carbClassifier.ts` ensures data integrity before saving.
- **Hub Coupling Framework v1.0**: Modular architecture in `server/services/hubCoupling/` allows integration of different health "hubs" to inject context and validation into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Advisory layer for clinicians, offering macro adjustment suggestions based on conditions.
- **Role-Based Access Control v1.0**: Three-tier system (`admin`, `coach`, `client`) with server-side enforcement.
- **Starch Meal Strategy v1.0**: Behavioral coaching for managing starchy vs. fibrous carbs.
- **Extended Onboarding System v1.0**: Multi-step wizard for builder selection during signup.
- **Meal Card Share + Translate System v1.0**: Native sharing and GPT-4o-mini powered translation for meal cards.
- **Local Meal Reminders v1.0**: Device-local notification system for meal reminders.
- **Guest Suite Guided Unlock Flow v1.2**: Progressive feature unlocking for unauthenticated users with a 14-day trial and 4 "meal day" limit, emphasizing a "coach in your pocket" philosophy.
- **Pro Tip Audio Card v1.0**: Global instructional audio feature on Meal Builder pages teaching macro accuracy.
- **Prepare with Chef System v1.0**: Guided cooking mode accessible from any meal card, reusing existing Chef's Kitchen UI.
- **Deployment Safety System v1.0**: Automated safeguards including boot-time health logging, fallback usage tracking, and a comprehensive health endpoint (`/api/health`) to prevent production issues.
- **Profile Photo Upload**: Fully functional feature for users to upload profile photos to object storage.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions`.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.