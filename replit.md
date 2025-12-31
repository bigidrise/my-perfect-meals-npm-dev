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

## Meal Visual Alignment System v1 — Feature-Specific Behavior (LOCKED)

| Feature | Image System | Notes |
|---------|--------------|-------|
| **Create With Chef** | ✅ Meal Visual Alignment v1 | Full `ensureImage()` → `generateImage()` flow |
| **Snack Creator** | ✅ Meal Visual Alignment v1 | Full `ensureImage()` → `generateImage()` flow |
| **Fridge Rescue** | ✅ Meal Visual Alignment v1 | Full `ensureImage()` → `generateImage()` flow |
| **AI Premades** | ✅ When `useFallbackOnly=false` | Static placeholder when `useFallbackOnly=true` |
| **Craving Creator** | ⚠️ Static fallbacks | AI branch does NOT call `ensureImage()` — intentional |
| **Restaurant Guide** | ✅ Internal AI generation | Uses `generateImage()`, NOT external providers |
| **Find Your Meals** | ✅ Internal AI generation | Uses `generateImage()`, NOT external providers |

**Craving Creator Note**: Intentionally returns static fallback images for AI-generated meals. This prevents cache explosion and maintains visual consistency. May be revisited in a future visual upgrade phase.

**Restaurant Guide / Find Meals Note**: Rely on internal AI-based image generation via the shared Meal Visual Alignment System. No Google/Yelp/external image ingestion exists.

## Nutrition Schema v1.1 (Dec 2024) — Carb Subtype Identity

**Purpose**: Enable accurate starchy vs fibrous carbohydrate tracking across all AI-generated meals.

**Changes Made**:
1. **UnifiedMeal interface** updated to include `starchyCarbs` and `fibrousCarbs` fields (optional, for backward compat)
2. **AI prompts** (Create With Chef, Snack Creator) now request separate starchy/fibrous breakdown
3. **Response parsing** extracts these fields and populates them in meal objects
4. **Total carbs** calculated as `starchyCarbs + fibrousCarbs` for backward compatibility

**Carb Classification Guide**:
- **Starchy Carbs**: Rice, pasta, bread, potatoes, grains, beans, corn, oats, crackers, granola
- **Fibrous Carbs**: Vegetables, leafy greens, broccoli, peppers, onions, mushrooms, fruits, berries

**Data Flow**:
```
AI generates meal → starchyCarbs/fibrousCarbs in response → parsed into UnifiedMeal → 
passed to board → summed by WeeklyMealBoard → displayed in RemainingMacrosFooter
```

**Files Modified** (strictly limited scope):
- `server/services/unifiedMealPipeline.ts` - AI prompts and response parsing only
- No changes to: image generation, ensureImage, caching, or UI components

**Not Modified** (LOCKED):
- Meal Visual Alignment System v1
- Image generation logic
- Footer display logic (already supports breakdown)

## Chicago Calendar Fix v1.0 (Dec 2024) — Noon UTC Anchor Pattern

**Purpose**: Eliminate "one day off" bugs caused by UTC midnight boundary crossings during date conversions.

**Problem**: When converting dates like `Date → ISO → Date`, midnight UTC anchors (T00:00:00Z) cross timezone boundaries in Chicago (UTC-5/6), causing the calendar day to shift by exactly one day.

**Solution**: All date math is anchored at UTC noon (12:00:00Z), safely away from any timezone's midnight. Arithmetic is performed on the noon-anchored Date object, then formatted to the target timezone using Intl.DateTimeFormat.

**Core Helpers** (`client/src/utils/midnight.ts`):
- `isoToUtcNoonDate(iso)` - Converts ISO string to Date anchored at noon UTC
- `formatISOInTZ(date, timeZone)` - Formats Date to YYYY-MM-DD in target timezone
- `getTodayISOSafe(timeZone)` - Gets today's date safely in timezone
- `addDaysISOSafe(iso, days, timeZone)` - Adds days using noon anchor
- `getWeekStartISOInTZ(timeZone)` - Gets Monday of current week
- `weekDatesInTZ(weekStartISO, timeZone)` - Generates 7 consecutive day strings
- `nextWeekISO()` / `prevWeekISO()` - Week navigation helpers
- `formatWeekLabel()` / `formatDateDisplay()` - Display formatting

**Canonical Timezone**: `America/Chicago` for all date calculations.

**Migration Status**:
- [x] WeeklyMealBoard - Fully migrated
- [x] PerformanceCompetitionBuilder - Fully migrated (Dec 2024)
- [x] GeneralNutritionBuilder - Fully migrated (Dec 2024)
- [x] AntiInflammatoryMenuBuilder - Migrated (Dec 2024, known display issue: shows Monday)
- [x] DiabeticMenuBuilder - Fully migrated (Dec 2024)
- [x] GLP1MealBuilder - Fully migrated (Dec 2024)
- [x] BeachBodyMealBoard - Fully migrated (Dec 2024)

**CRITICAL RULE**: Never use "T00:00:00Z" midnight patterns. Always use the noon UTC helpers from midnight.ts.

## iOS Mobile Touch Fix v1.0 (Dec 2024) — Button State Stability

**Purpose**: Eliminate "double-tap" and "color fade" issues on iOS Safari/WKWebView where buttons lose background color on first tap and require a second tap to activate.

**Problem**: iOS Safari's touch-state chain (`touchstart` → `:active` → `:focus` → `touchend`) gets interrupted by:
- `:hover` styles leaking into mobile (Tailwind `hover:` classes stick on iOS)
- `backdrop-blur` and fixed positioning layers stealing focus
- Improper `:focus` handling (removes styles on tap)
- Safari tap highlight artifacts

**Solution**: Global CSS fixes applied in `client/src/index.css`:
1. Kill tap highlight completely (`-webkit-tap-highlight-color: transparent`)
2. Apply `touch-action: manipulation` to all buttons
3. Neutralize hover states on touch devices via `@media (hover: none)`
4. Add explicit `:active` states that preserve background color
5. Fix focus-visible for touch devices (prevent ghost focus)

**Component Updates**:
- `Button` (shadcn): Added `touch-manipulation select-none` + explicit `active:` states for all variants
- `GlassButton`: Added `touch-manipulation select-none` + explicit `active:` states with scale feedback

**Global CSS Rules** (`client/src/index.css`):
```css
/* Kill tap highlight */
* { -webkit-tap-highlight-color: transparent !important; }

/* Touch behavior for buttons */
button, [role="button"], .btn, a {
  touch-action: manipulation;
  -webkit-touch-callout: none;
}

/* Transform-only feedback for .btn classes */
.btn:active { transform: scale(0.98); }
```

**Key Design Decision**: Global CSS provides only transform feedback and tap highlight removal. Background color management is delegated to component-level Tailwind `active:` classes to avoid specificity conflicts.

**Expected Behavior After Fix**:
- One tap = one action
- Button never loses its base color
- No "half-pressed" ghost state
- No second tap required
- No visual flicker
- iOS feels native-like

## Scientific Transparency v1.0 (Dec 2024) — Apple Guideline 1.4.1 Compliance

**Purpose**: Satisfy Apple's Guideline 1.4.1 requirement for citations and sources for health-related calculations.

**Problem**: Apple rejected the app because nutritional calculations lacked visible citations. The existing disclaimer modal covers legal acknowledgment but not methodology disclosure.

**Solution**: Added a `MedicalSourcesInfo` component that provides:
- How nutritional values are calculated
- Primary sources (USDA FoodData Central, NIH DRIs, WHO guidelines, ADA guidance)
- Important disclaimer note about wellness-only purpose

**Accessibility Points** (Apple reviewers will check these):
1. **Profile Page**: "Medical Information & Sources" card in the Manage Your Account section
2. **Macro Footer**: ℹ️ icon next to "Remaining Today" text in RemainingMacrosFooter

**Files**:
- `client/src/components/MedicalSourcesInfo.tsx` - Reusable sources sheet component
- `client/src/pages/Profile.tsx` - Settings link
- `client/src/components/biometrics/RemainingMacrosFooter.tsx` - In-context info icon

**Key Design Decision**: This is separate from the legal disclaimer. The disclaimer covers liability acknowledgment (shown once during onboarding). The sources page covers methodology transparency (accessible anytime). Apple views these as two separate compliance layers.