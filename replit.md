# My Perfect Meals - Replit Environment

## Overview
Full-stack nutrition/meal-planning app with Express backend and React + Vite frontend.

## Architecture
- **Backend**: Express.js server (`server/index.ts`) running on port 5000
- **Frontend**: React + Vite (`client/src/`) served via Vite middleware in dev, static files in production
- **Database**: PostgreSQL via Drizzle ORM (Replit-provisioned DB)
- **Package Manager**: npm

## Running the App
- **Dev**: `npm run dev` — starts `server/index.ts` with tsx, serves Vite dev middleware on port 5000
- **Build**: `npm run build` — builds client to `client/dist/`, bundles server to `dist/`
- **Production**: `npm run start` — runs `dist/prod.js`
- **Replit Start**: `npm run replit:start` — runs `server/prod.ts` with tsx (runs db:push first)

## Workflow
- Workflow name: **Start application**
- Command: `npm run dev`
- Port: 5000 (webview)

## Key Environment Variables / Secrets Required
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `OPENAI_API_KEY` — Required for AI meal generation features
- `SESSION_SECRET` — Session encryption (present)
- `STRIPE_SECRET_KEY` — Payment features (optional, payments disabled without it)
- `SENDGRID_API_KEY` — Email notifications (optional)
- `RESEND_API_KEY` — Care team invite emails (optional)
- `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` — Web push notifications (optional)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — SMS (optional)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET_NAME` / `AWS_REGION` — File/image storage (optional)
- `STRIPE_PRICE_*` — Various Stripe price IDs for subscription plans (optional)

## Project Structure
- `server/` — Express backend (routes, middleware, services)
- `client/` — React frontend (Vite config, src/, public/)
- `shared/` — Shared TypeScript schemas (Drizzle/Zod)
- `migrations/` — Drizzle database migrations
- `vite.config.ts` — Root Vite config (used by server in dev mode)
- `drizzle.config.ts` — Drizzle ORM config
