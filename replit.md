# My Perfect Meals - Full-Stack Application

## Overview
My Perfect Meals is a comprehensive meal planning and nutrition tracking application. Its core purpose is to provide AI-powered meal generation, offering users personalized dietary solutions. The project aims to deliver a seamless full-stack experience for health-conscious individuals seeking efficient meal management.

## User Preferences
I prefer iterative development and expect the agent to ask before making major architectural changes. Do not modify the "Meal Visual Alignment System v1" without explicit approval. Specifically, do not change AI Prompts, Image Prompts, `ensureImage` Logic, Fallback Images, Cache Key Generation, or S3 Upload Logic within this system.

## System Architecture
The application is built as a monorepo using React + Vite (TypeScript) for the frontend and Express.js (TypeScript) for the backend, with PostgreSQL and Drizzle ORM for data persistence. OpenAI GPT-4 powers AI meal generation.

**Technical Implementations:**
- **Monorepo Structure**: Frontend and backend are co-located.
- **Server Configuration**: The Express server runs on port 5000, serving both API endpoints and the client. Vite middleware handles client serving in development, while static files from `client/dist` are served in production.
- **Database**: PostgreSQL with Drizzle ORM, schema defined in `/shared/schema.ts`. Automatic migrations are handled via `db:push` during prestart/predev hooks.
- **AI Stability Architecture**: Implements route-aware health monitoring, categorizing routes as AI-required or deterministic. It tracks generation sources (AI, cache, template, catalog/fallback, error) and reports health status via `/api/health/ai`, including release gates for schema, errors, and fallback rates (max 5%).
- **Meal Visual Alignment System v1**: A critical, production-locked system ensuring AI-generated meals have accurately matched images. It integrates DALL-E 3 for image generation using full meal context (name, description, ingredients, type, style), uploads images to permanent S3 storage, and includes a robust `ensureImage()` logic with static fallbacks on DALL-E failure. This system guarantees images align with meal content through sequential generation, context-aware prompting, and specific fallback strategies.
- **iOS Viewport Architecture**: Designed to prevent iOS WKWebView scrolling bugs. It uses a fixed shell with `100dvh` and a single scroll container, where pages handle their own safe-area insets. Key settings include `ios.contentInset: 'never'` and `ios.scrollEnabled: false` in Capacitor, and `overflow: hidden` on `html/body`.
- **Guided Tour System**: Provides page-specific tips via `QuickTourModal`, managed by `useQuickTour.ts`. It tracks "seen" status per page in `localStorage`, offers a global disable option, and allows manual re-opening.
- **Copilot Re-Engagement Architecture**: Separates autoplay from manual invocation. An autoplay toggle controls auto-opening on page navigation, while a dedicated Chef button always opens Copilot with the current page context, regardless of the toggle. Session tracking prevents re-opening on the same page within a session.

## External Dependencies
- **OpenAI API**: For AI-powered meal generation (requires `OPENAI_API_KEY`).
- **Stripe**: Optional for payment features (requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Twilio**: Optional for SMS notifications (requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
- **SendGrid**: Optional for email services (requires `SENDGRID_API_KEY`).
- **DALL-E 3**: Integrated via OpenAI for generating meal images.
- **Amazon S3**: For permanent storage of generated meal images.