# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals is a comprehensive meal planning and nutrition tracking application focused on providing AI-powered, personalized dietary solutions. The project aims to deliver a seamless full-stack experience for health-conscious individuals seeking efficient meal management, leveraging AI for meal generation and incorporating advanced features like visual meal alignment and real-time clinical data integration for diabetics.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.

## System Architecture
The application is a monorepo utilizing React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend. Data persistence is handled by PostgreSQL and Drizzle ORM. OpenAI GPT-4 powers AI meal generation, including DALL-E 3 for image generation.

**UI/UX Decisions:**
- **iOS Viewport Architecture**: Fixed shell with `100dvh` and a single scroll container to prevent iOS WKWebView scrolling bugs. Pages manage their own safe-area insets.
- **Guided Tour System**: Page-specific tips via `QuickTourModal`, tracking "seen" status in `localStorage` and allowing manual re-opening.
- **iOS Mobile Touch Fix**: Global CSS fixes in `client/src/index.css` to eliminate "double-tap" and "color fade" issues on iOS buttons, applying `touch-action: manipulation`, neutralizing hover states on touch devices, and adding explicit `:active` states.
- **Scientific Transparency**: `MedicalSourcesInfo` component provides citations for nutritional calculations (USDA, NIH, WHO, ADA) accessible from the Profile page and Macro Footer.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located.
- **Server Configuration**: Express server on port 5000, serving APIs and client. Vite middleware for development, static `client/dist` for production.
- **Database**: PostgreSQL with Drizzle ORM, schema in `/shared/schema.ts`. Automatic migrations via `db:push`.
- **AI Stability Architecture**: Route-aware health monitoring for AI-required routes, tracking generation sources and reporting status via `/api/health/ai`.
- **Meal Visual Alignment System v1**: Ensures AI-generated meals have accurately matched images using DALL-E 3, uploading to S3, and robust `ensureImage()` logic with static fallbacks.
- **Copilot Re-Engagement Architecture**: Separates autoplay from manual invocation for the "Chef" feature, with session tracking to prevent re-opening on the same page.
- **Nutrition Schema v1.1**: Updated `UnifiedMeal` interface to include `starchyCarbs` and `fibrousCarbs`, enabling accurate carb tracking by updating AI prompts and response parsing.
- **Chicago Calendar Fix v1.0**: All date math is anchored at UTC noon (12:00:00Z) using helper functions in `client/src/utils/midnight.ts` to prevent "one day off" bugs from UTC midnight boundary crossings, with `America/Chicago` as the canonical timezone.
- **Diabetic Coupling Architecture v1.0**: Integrates real-time diabetic clinical data (glucose readings, guardrails) directly into AI meal generation prompts. This involves server-side glucose classification, fetching doctor-defined guardrails, injecting this context into AI prompts, and post-generation validation.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation (`OPENAI_API_KEY`).
- **DALL-E 3**: Integrated via OpenAI for generating meal images.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: Optional for payment features (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Twilio**: Optional for SMS notifications (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
- **SendGrid**: Optional for email services (`SENDGRID_API_KEY`).
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions` plugin.