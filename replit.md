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
- **iOS Scroll Fix (Dec 2024)**: Replaced components/RootViewport with layouts/RootViewport
  - Fixed shell: position: fixed, 100dvh, overflow: hidden
  - Pages now handle their own scroll containers
  - Deleted old components/RootViewport.tsx
- Added CSS utilities for iOS scroll handling (.ios-scroll, .pb-safe-nav, .pb-safe-both, .pt-safe-top)
- Updated SafePageContainer and PageShell with safe-area utilities

## iOS Viewport Architecture (CRITICAL)
RootViewport implements scroll containment to prevent iOS WKWebView bugs:

- **Fixed shell**: `position: fixed`, `100dvh`, contains the ONLY scroll container
- **Single scroll container**: `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior: none`
- **Pages handle safe-area**: Each page applies `env(safe-area-inset-top)` for its own headers

This prevents the "pull down and stays down" iOS bug.

## iOS Safe-Area Configuration (IMPORTANT)
- **Capacitor**: `ios.contentInset: 'never'` and `ios.scrollEnabled: false` in capacitor.config.ts
- **RootViewport**: Does NOT apply safe-area padding (pages handle their own)
- **DO NOT** add `-webkit-overflow-scrolling: touch` to html, body, #root
- **DO NOT** add duplicate safe-area padding in RootViewport - causes double-inset
- **DO NOT** use `100vh` - always use `100dvh` for dynamic viewport height
- **html/body**: Must have `overflow: hidden` and `overscroll-behavior: none` (defined at bottom of index.css)

## Copilot Behavior Model (PERSISTENT ASSISTANT)
The Copilot follows a "persistent assistant" pattern - always available, never intrusive:

**Core Principle**: "Copilot is always available, never intrusive, and always under the user's control."

**Behavior Rules**:
1. **Guide Mode ON** → Copilot auto-opens on EVERY page (unless user turned off that specific page)
2. **Never auto-talks** → User must tap "Listen" to hear audio
3. **Copilot Button** → Always shows current page explanation when pressed (on-demand)
4. **Guide toggle = global control** → Only way to fully disable auto-open behavior
5. **"Turn Off for This Page"** → Disables auto-open for THAT page only (other pages still work)

**Two ways to close Copilot:**
- **X button / backdrop tap** → Temporary dismiss (will auto-open again on next visit)
- **"Turn Off for This Page" button** → Permanently disables auto-open for that page only

**Key Files**:
- `client/src/components/copilot/useCopilotPageExplanation.ts` - Auto-open logic
- `client/src/components/copilot/CopilotButton.tsx` - On-demand page explanation
- `client/src/components/copilot/CopilotSheet.tsx` - "Turn Off for This Page" button
- `client/src/components/copilot/CopilotRespectGuard.ts` - Guards for user preferences
- `client/src/components/copilot/CopilotGuidedModeContext.tsx` - Guide toggle state
- `client/src/components/copilot/CopilotExplanationStore.ts` - Tracks per-page disable state (localStorage)
