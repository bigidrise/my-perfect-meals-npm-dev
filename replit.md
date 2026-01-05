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
- **Hub Coupling Framework v1.0**: Modular plugin architecture in `server/services/hubCoupling/` that allows different health "hubs" to inject context, guardrails, and validation into AI meal generation. Each hub module implements `getContext()`, `getGuardrails()`, `buildPrompt()`, `validate()`, and optional `getFixHint()`. Hub system prompt takes priority over legacy diet system prompts. Supports: Diabetic (refactored), Competition Pro (protein floor/carb ceiling), GLP-1 (portion control + symptom awareness), Anti-Inflammatory (ingredient bans + cooking method validation). Hard violations trigger ONE automatic regeneration with fixHint; soft warnings log only.
- **ProCare Clinical Advisory System v1.0**: Advisory-only intelligence layer for clinicians in ProCare Dashboard. ClinicalAdvisoryDrawer component provides toggle-based suggestions (menopause/hormone therapy, suspected insulin resistance, high stress/poor sleep) that compute macro adjustment deltas. Advisory pattern: toggles → aggregated suggestions → staged confirmation → apply to targets. Clinicians maintain full control with explicit "Apply" action required. Advisory state persists in ClinicalContext.advisory via proStore. Deferred conditions: dyslipidemia, post-hysterectomy (require more nuanced adjustments).
- **Clinical Advisory User-Facing v1.0**: MetabolicConsiderations component in Macro Calculator provides user access to the same 3 V1 conditions (menopause, insulin resistance, high stress). Uses shared clinicalAdvisory.ts utility for consistent delta calculations. Explicit confirm flow: toggle → preview → apply. Advisory state persists in localStorage. No auto-application. Documentation in `/docs/ProductEvolutionLedger.md` and `/docs/FeatureWiringChecklist.md`.
- **ProCare Workspace System v1.0**: Modal-based workspace selection for professionals managing clients. Routes: `/pro/clients/:id` shows workspace selection modal, redirects to `/pro/clients/:id/trainer` or `/pro/clients/:id/clinician`. TrainerClientDashboard includes macro targets, performance flags, coaching notes, and builder assignment (General Nutrition or Performance & Competition). ClinicianClientDashboard is placeholder with hub buttons (Diabetic, GLP-1, Anti-Inflammatory). Workspace persists in `ClientProfile.workspace` via proStore. No RBAC/permissions system - explicit human choice only. Components: `WorkspaceSelectionModal.tsx`, `TrainerClientDashboard.tsx`, `ClinicianClientDashboard.tsx`.
- **Role-Based Access Control v1.0**: Three-tier access control for Pro Care: `admin` (platform owner, full access), `coach` (future, Pro Care tools only), `client` (assigned board only when isProCare=true). User schema fields: `role` (admin|coach|client, default: client), `isProCare` (boolean), `activeBoard` (assigned meal builder or null for locked state). Server-side enforcement in `/api/user/select-meal-builder` - Pro Care clients can ONLY select their `activeBoard`, admin bypasses all restrictions. Frontend: `MealBuilderSelection.tsx` filters available builders, shows "Awaiting Assignment" locked state when no board assigned, displays "Assigned by Coach" badge for assigned clients. Visibility is determined by user role in database, not environment (dev vs deployed).

## External Dependencies
- **OpenAI API**: For AI-powered meal generation (`OPENAI_API_KEY`).
- **DALL-E 3**: Integrated via OpenAI for generating meal images.
- **Amazon S3**: For permanent storage of generated meal images.
- **Stripe**: Optional for payment features (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Twilio**: Optional for SMS notifications (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
- **SendGrid**: Optional for email services (`SENDGRID_API_KEY`).
- **Apple StoreKit 2**: For iOS in-app purchases via `@squareetlabs/capacitor-subscriptions` plugin.