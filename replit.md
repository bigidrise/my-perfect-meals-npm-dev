# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals (MPM) is a live, AI-powered meal planning and nutrition tracking application available in the Apple App Store. It provides personalized dietary solutions, leveraging AI for meal generation, visual meal alignment, and real-time clinical data integration. The project aims to offer efficient meal management and advanced nutritional insights to health-conscious individuals, operating as a subscription-based business.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.

**Product Doctrine**: See `/docs/STARCH_STRATEGY_AND_MEAL_BOARD_DOCTRINE.md` for authoritative decisions about starch strategy, meal board behavior, and intentionally hidden features. Do not violate without discussion.

## System Architecture
The application is a monorepo utilizing React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend. PostgreSQL with Drizzle ORM manages data persistence. OpenAI GPT-4 is integrated for AI meal generation and DALL-E 3 for image creation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Fixed shell with `100dvh` and a single scroll container to manage iOS WKWebView scrolling.
- **Guided Tour System**: Page-specific tips are delivered via `QuickTourModal`.
- **Scientific Transparency**: `MedicalSourcesInfo` component provides citations for nutritional calculations.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located within the same repository.
- **Server Configuration**: Express server handles API requests and serves the client application.
- **Database**: PostgreSQL with Drizzle ORM, including automatic migrations.
- **AI Stability Architecture**: Route-aware health monitoring for AI-dependent functionalities.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals are accurately matched with DALL-E 3 images and uploaded to S3.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface to accurately track `starchyCarbs` and `fibrousCarbs`.
- **Carb Enforcement System v1.0**: Ingredient-based carb derivation post-parsing ensures UI accuracy.
- **Chicago Calendar Fix v1.0**: Date calculations are anchored at UTC noon to prevent common date-related bugs.
- **Hub Coupling Framework v1.0**: Modular plugin architecture allows different health "hubs" to inject context and validation into AI meal generation.
- **ProCare Clinical Advisory System v1.0**: Provides clinicians with macro adjustment suggestions based on patient conditions.
- **ProCare Workspace System v1.0**: Facilitates professional management of clients via modal-based workspace selection.
- **Role-Based Access Control v1.0**: Implements a three-tier access control system (`admin`, `coach`, `client`) for Pro Care features.
- **Builder Transition Page v1.0**: Allows existing subscribers to change their meal builder strategy.
- **Starch Meal Strategy v1.0**: Behavioral coaching system for managing starchy vs. fibrous carbs.
- **Extended Onboarding System v1.0**: A multi-step wizard for builder selection during signup, with a specialized path for ProCare users.
- **Meal Card Share + Translate System v1.0**: Replaced copy function with native Share and GPT-4o-mini powered Translate features.
- **Local Meal Reminders v1.0**: Device-local notification system for meal reminders.
- **iOS App Store Compliance v1.2**: Ensures adherence to Apple App Store Guidelines 3.1.1 (no external payments on iOS) and 1.4.1 (medical citations).
- **Guest Suite Guided Unlock Flow v1.2**: Progressive feature unlocking for unauthenticated users with a 14-day trial and a 4 "meal day" limit. Includes navigation enforcement and specific messaging.
- **Pro Tip Audio Card v1.0**: Global instructional audio feature on all Meal Builder pages providing tips on macro accuracy.
- **Prepare with Chef System v1.0**: Global guided cooking mode accessible from any meal card, reusing existing Chef's Kitchen functionality.
- **Profile Photo Upload**: Fully functional on web and iOS, allowing users to upload and save profile photos to object storage.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation and DALL-E 3 image creation.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: For web payment processing.
- **Twilio**: For SMS notifications.
- **SendGrid**: For email services.
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions`.