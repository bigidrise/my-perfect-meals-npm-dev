# My Perfect Meals - Full-Stack Application

## Overview
A comprehensive meal planning and nutrition tracking application with AI-powered meal generation.

## Tech Stack
- **Frontend**: React + Vite (TypeScript)
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4 for meal generation

## Architecture
- Monorepo structure with combined frontend/backend
- Server runs on port 5000 and serves both API and client
- In development, Vite middleware serves the client
- In production, static files are served from `client/dist`

## Key Directories
- `/server` - Express backend with API routes
- `/client/src` - React frontend application
- `/shared` - Shared types and database schema
- `/migrations` - Drizzle database migrations

## Running the Application
```bash
npm run dev          # Development mode
npm run build        # Build for production
npm run start        # Production mode
npm run db:push      # Push database schema
```

## Required Secrets
- `OPENAI_API_KEY` - Required for AI meal generation
- `STRIPE_SECRET_KEY` - Optional, for payment features
- `STRIPE_WEBHOOK_SECRET` - Optional, for payment webhooks
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` - Optional, for SMS
- `SENDGRID_API_KEY` - Optional, for email

## Database
PostgreSQL database using Drizzle ORM. Schema defined in `/shared/schema.ts`.

## Recent Changes
- Made Stripe integration optional (graceful degradation)
- Made OpenAI initialization lazy to prevent startup crashes
- Configured Vite to allow all hosts for Replit proxy
- Added iOS viewport wobble fix with RootViewport component (fixed positioning, 100dvh height)
- Added CSS utilities for iOS scroll handling (.ios-scroll, .pb-safe-nav, .pb-safe-both, .pt-safe-top)
- Updated SafePageContainer and PageShell with safe-area utilities

## iOS Viewport Architecture (CRITICAL)
RootViewport implements a three-layer scroll containment to prevent iOS WKWebView bugs:

1. **Outer Shell**: FIXED, non-scrollable, fills viewport with `overflow: hidden`
2. **Safe-Area Wrapper**: NON-SCROLLABLE div with `paddingTop: env(safe-area-inset-top)`, sits ABOVE scroll container
3. **Scroll Container**: ONLY element that scrolls, uses `-webkit-overflow-scrolling: touch` and `overscroll-behavior: contain`

This architecture prevents the "pull down and stays down" iOS bug where the safe area moves with scroll.

## iOS Safe-Area Configuration (IMPORTANT)
- **Capacitor**: `ios.contentInset: 'never'` in capacitor.config.ts - disables native safe-area handling
- **CSS**: Safe-area top padding applied ONLY in RootViewport's non-scrollable wrapper
- **DO NOT** add `-webkit-overflow-scrolling: touch` to html, body, #root, or any root elements
- **DO NOT** add `pt-safe-top` to SafePageContainer, PageShell, or any page components
- Bottom safe-area padding is handled via `pb-safe-nav` and `pb-safe-both` utilities in page containers
