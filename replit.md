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

## Copilot Re-Engagement Architecture (Dec 2024)
The Copilot system separates autoplay from manual invocation:

**Key Components:**
- `CopilotGuidedModeContext.tsx` - Manages autoplay toggle state (persisted to localStorage)
- `CopilotRespectGuard.ts` - Guards auto-open behavior only, not manual invocation
- `CopilotButton.tsx` - Chef button, always opens Copilot with current page context
- `CopilotSheet.tsx` - The Copilot UI panel

**Behavior Rules:**
1. **Autoplay toggle** (labeled "Auto") controls ONLY auto-open on page navigation (global setting)
2. **Chef button** ALWAYS opens Copilot with current page explanation, regardless of toggle
3. **Autoplay** happens EVERY time you navigate to a page (not just first visit)
4. **Manual invocation** always works - toggle doesn't block Chef button
5. **Skip button** - Appears when audio is playing. Stops audio and closes sheet WITHOUT affecting autoplay preference. Future pages still auto-open.
6. **Auto toggle OFF** - Stops audio AND disables all future autoplay globally
7. **Session tracking** - Once opened on a page, won't re-open until you navigate AWAY and back

**Session Tracking (in-memory, not persisted):**
- When Copilot opens on a page, that path is marked "opened this session"
- Skipping or closing does NOT re-trigger auto-open while still on that page
- Navigating to a different page clears the session, so returning will auto-open again

**Storage Keys (backward compatible):**
- `copilot_autoplay_enabled` - New key for autoplay preference
- `copilot_guided_mode` - Legacy key (migrated and kept in sync)

**Events (backward compatible):**
- `copilot-autoplay-changed` - New event name
- `copilot-guided-mode-changed` - Legacy event (still emitted for compatibility)
