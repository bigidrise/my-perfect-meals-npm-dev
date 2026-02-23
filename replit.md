# MyPerfectMeals (MPM) - Replit Project

## Overview
MyPerfectMeals is a comprehensive meal planning and nutrition application built as a full-stack TypeScript project. It features AI-powered meal generation, dietary tracking, biometrics monitoring, and various specialized meal builders (craving creator, dessert creator, holiday feast, etc.).

## Architecture
- **Frontend**: React 18 + Vite + TypeScript, using Tailwind CSS, Radix UI, shadcn/ui components, Wouter for routing
- **Backend**: Express.js (Node.js 20) serving both API routes and the Vite dev server on port 5000
- **Database**: PostgreSQL (Neon-backed via Replit) with Drizzle ORM
- **AI**: OpenAI API integration for meal generation, translation, and various AI features

## Project Structure
```
/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components (routes)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities and helpers
│   │   └── services/    # API service layers
│   └── index.html       # Entry HTML
├── server/              # Express backend
│   ├── index.ts         # Dev entry point
│   ├── prod.ts          # Production entry point
│   ├── routes/          # API route handlers
│   ├── routes.ts        # Main route registration
│   ├── vite.ts          # Vite dev middleware setup
│   ├── db.ts            # Database connection
│   ├── db/              # Database schemas and queries
│   ├── services/        # Business logic services
│   └── middleware/       # Express middleware
├── shared/              # Shared code (schema, types)
│   └── schema.ts        # Drizzle database schema
├── drizzle.config.ts    # Drizzle ORM configuration
├── vite.config.ts       # Root Vite config (used by server)
└── package.json         # Dependencies and scripts
```

## Key Scripts
- `npm run dev` - Start development server (Express + Vite on port 5000)
- `npm run build` - Build client and server for production
- `npm run start` - Run production server
- `npm run db:push` - Push Drizzle schema to database

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `OPENAI_API_KEY` - OpenAI API key (optional, AI features disabled without it)
- `STRIPE_SECRET_KEY` - Stripe payments (optional)
- `RESEND_API_KEY` - Email service (optional)
- `TWILIO_*` - SMS notifications (optional)
- `VAPID_*` - Push notifications (optional)

## Development Notes
- The server binds to 0.0.0.0:5000, serving both API and frontend
- HMR is disabled; full page refresh is used for updates
- All hosts are allowed for Replit proxy compatibility
- OpenAI client is lazily initialized to prevent crashes when API key is missing

## Deployment
- Build: `npm run build` (compiles client with Vite, server with esbuild)
- Run: `npm run start` (runs compiled production server)
- Target: Autoscale deployment

## iOS / Capacitor Notes
- Capacitor config uses bundled mode (`webDir: "client/dist"`, NO `server.url`)
- iOS loads from `capacitor://localhost` using bundled assets
- StoreKit uses `@squareetlabs/capacitor-subscriptions` plugin (lazy dynamic import)
- Product IDs: `mpm_basic_plan_999`, `mpm_premium_plan_1999`, `mpm_ultimate_plan_2999`
- After build: run `npx cap sync ios` before opening in Xcode
- Global error handling (`setupGlobalErrorHandling`) deferred to useEffect to avoid swallowing module evaluation errors

## Navigation Architecture
- **Bottom Nav**: Role + workspace based (not route-only)
  - Clients always see Regular BottomNav
  - Clinicians (coach/trainer/physician) see StudioBottomNav only inside clinic workspace routes (/care-team, /pro/clients, /pro/physician-clients, /pro/physician, /pro-portal)
  - Personal builder routes (/pro/general-nutrition-builder, /performance-competition-builder) always show Regular BottomNav
- **Builder Headers**: Shared `BuilderHeader` component (`client/src/components/pro/BuilderHeader.tsx`)
  - Row 1: Title + Info (MedicalSourcesInfo) + Guide (QuickTourButton)
  - Row 2 (conditional): "Working with [Client Name] + Exit Client" — only shows for clinicians in studio client context
  - No back button in any builder (bottom nav handles navigation)
  - Applies to: GeneralNutritionBuilder, PerformanceCompetitionBuilder, DiabeticMenuBuilder, GLP1MealBuilder, AntiInflammatoryMenuBuilder
  - Excluded: WeeklyMealBoard, BeachBodyBuilder (unchanged)
- **ProClientContext**: Detects studio client context from route params for all builder types including medical builders

## Recent Changes
- 2026-02-23: Implemented ProCare navigation + header spec — created shared BuilderHeader component, role-based bottom nav logic, removed back/dashboard buttons from all 5 eligible builders, standardized "Working with + Exit Client" UX
- 2026-02-22: Fixed iOS Capacitor runtime crash - removed `server.url` from both `capacitor.config.ts` and `ios/App/App/capacitor.config.json` (was forcing remote URL loading instead of bundled mode); deferred `setupGlobalErrorHandling()` to useEffect to stop swallowing boot errors; added detailed error logging in main.tsx dynamic import catch handler
- 2026-02-22: Fixed shopping aggregate bar z-index in Diabetic Menu Builder (removed overflow-x-hidden)
- 2026-02-21: Added ProCare account upgrade feature - existing users can upgrade to coach/ProCare role without creating a new account (POST /api/auth/upgrade-to-procare endpoint + updated ProCareAttestation page)
- 2026-02-17: Initial Replit setup - configured workflow, database, and deployment
- Fixed translate.ts to lazily initialize OpenAI client (prevents crash without API key)
