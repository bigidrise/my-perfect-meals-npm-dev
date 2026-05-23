# My Perfect Meals — Technical Architecture Overview
**Version:** May 2026 | **Classification:** Internal / Enterprise Technical Documentation

*This document describes the implemented architecture and operational design of the My Perfect Meals platform as deployed. It is generated from the actual codebase and is intended for technical review, enterprise due diligence, and integration planning.*

---

## 1. Platform Architecture Overview

### Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, shadcn/ui |
| Routing | Wouter (client-side), Express.js (server-side) |
| State Management | React Query (TanStack), React Context |
| Backend | Express.js on Node.js 20, TypeScript via tsx |
| Database | PostgreSQL (Drizzle ORM) |
| AI | OpenAI API (GPT-4 generation, Whisper transcription) |
| Payments | Stripe (web), Apple IAP (iOS), RevenueCat (mobile) |
| Object Storage | Replit Object Storage (presigned URL upload flow) |
| Email | Resend |
| SMS | Twilio |
| Push Notifications | VAPID (web), APNs (iOS via Capacitor) |
| Mobile | Capacitor (iOS native shell, Android roadmap) |
| Monitoring | Sentry (client + server) |
| Affiliate | Rewardful |

### Environment Separation

**Development** (`server/index.ts`): tsx runtime, dotenv config, Vite dev server integration (HMR), full middleware stack, development-only QA routes gated by `NODE_ENV === "development"`.

**Production** (`server/prod.ts`): Health-first boot architecture — the HTTP server starts and answers health checks within milliseconds of process start, before any application initialization completes. Background initialization (`initializeApp()`) runs asynchronously after the server is listening. Cloud Run proxy trust (`trust proxy 1`) is set for accurate IP handling.

```
[Process start]
  → HTTP server binds immediately (port 5000, 0.0.0.0)
  → /healthz, /api/health respond: OK (no middleware, no delays)
  → initializeApp() runs in background
  → isInitialized flag set on completion
  → Full middleware stack activates
```

**Health endpoint** `/api/health` returns: `ok`, `initialized`, `initError`, `timestamp`, `env`, `hasDatabase`, `hasOpenAI`, `isDeployment` — sufficient for automated health check infrastructure to determine readiness.

### Shared Architecture Philosophy

- `shared/` directory contains types, schemas, utilities, and constants shared between frontend and backend. This eliminates type duplication and ensures client-server contract consistency at compile time.
- All user-facing strings for legal documents, plan features, and entitlement definitions live in `shared/` — both sides read from the same source.
- The Drizzle schema is split between `shared/schema.ts` (primary tables referenced by both client and server) and `server/db/schema/*` (server-only domain schemas).

---

## 2. Frontend Systems

### React Application Architecture

The application root (`client/src/App.tsx`) is a deeply nested context provider tree. Providers are ordered by dependency:

```
QueryClientProvider (TanStack React Query)
  UpdateProvider
  AuthProvider
  OrgProvider
  FontSizeProvider
  HouseholdProvider
  ProClientProvider
  AudioProvider
  VoiceProvider
  PageTitleProvider
  TooltipProvider
  RootViewport
    CopilotSystem
    AppRouter / Router
    ChefVoiceAssistant
    VoiceConcierge
    AvatarSelector
```

**AuthContext:** Holds the authenticated user, access tier, subscription state, and household profile. All protected route decisions derive from this context.

**OrgContext:** Holds the resolved `OrgContext` for white-label deployments — app name, branding colors, feature flags, custom domain, and `isWhiteLabel` flag. Loaded at startup by slug or default.

**HouseholdContext:** Manages active household profile selection and profile list. Profile switches are immediate; all generation calls use the active profile's constraint set.

**ProClientContext:** Manages the active client context for ProCare coaches — which client they are currently viewing in the ProCare workspace.

**CopilotSystem:** The voice command and natural language navigation system. Registers navigation and modal handlers at startup; processes Copilot commands into platform actions.

### TypeScript

All application code is fully typed TypeScript. Types flow from the database schema (Drizzle `$inferSelect` / `$inferInsert`) through shared types to frontend component props. No `any` in critical paths; where present, it is isolated and annotated.

### Client-Side Routing

Wouter is the routing library. Route definitions are in `AppRouter.tsx` and `Router.tsx`. Routes are organized by feature domain:
- Consumer features: dashboard, generation tools, biometrics, shopping, meal logs
- ProCare workspace: studio management, client boards, compliance, communication
- Clinical: care team, lab metrics, patient assignment
- Creator: Signature Kitchen management
- Admin: admin dashboard, moderation tools, SQL console (development-gated)

### State Management

- **Server state:** TanStack React Query for all API data. Custom `apiRequest` wrapper handles auth headers, error normalization, and retry logic. `queryClient` is configured with appropriate stale times per data category.
- **UI state:** React `useState`/`useReducer` within components. No global UI state library.
- **Persistent UI dismissals:** `mpm.dismiss.<featureName>` localStorage pattern for dismissible banners, cards, and onboarding prompts.

### UI System

- **Radix UI** for accessible, unstyled component primitives (dialogs, tooltips, dropdowns, sliders)
- **shadcn/ui** for styled component implementations built on Radix
- **Tailwind CSS** for all styling; no CSS modules or separate stylesheets
- **PillButton** (`@/components/ui/pill-button`) is the canonical button for all info triggers, selection chips, and action labels throughout the application
- All selection inputs use pill button groups; radio buttons are prohibited by design convention

### Mobile Support and Responsive Design

- Tailwind responsive breakpoints (`sm`, `md`, `lg`) govern all layout changes
- Mobile-first layouts; desktop receives progressive enhancement
- `md:hidden` / `hidden md:block` pattern for mobile-specific vs. desktop-specific content blocks

### Capacitor / iOS Architecture

The application ships as a native iOS app via Capacitor. Key integration points:

- **Platform detection:** `Capacitor.isNativePlatform()` and `Capacitor.getPlatform() === "ios"` govern native-specific behavior branches
- **Safe area handling:** iOS safe areas are managed via CSS custom properties (`--safe-top`, `--safe-bottom`). On iOS native, these are set to `0px` to prevent double-padding with Capacitor's native handling
- **Native demo mode:** `initNativeDemoMode()` runs before React render for iOS preview recording workflows
- **Push notifications:** APNs integration via Capacitor for meal reminders and coaching alerts
- **In-app purchases:** `@squareetlabs/capacitor-subscriptions` for App Store subscription management
- **Notification listeners:** `setupNotificationListeners()` initialized in app root for meal reminder handling

### Update Management

`UpdateContext` and `UpdateBanner` provide over-the-air update notification for the web app layer. When a new version is detected (`hasUpdate`), a non-blocking banner prompts users to refresh.

---

## 3. Backend Systems

### Express Architecture

The backend is a monolithic Express application on Node.js 20, running TypeScript via `tsx` in development and compiled for production. Route registration follows a two-phase pattern:

**Phase 1 — Lightweight routers** (registered in `server/index.ts` before heavy initialization): health checks, keepalive, legal pages.

**Phase 2 — Application routes** (registered via `registerRoutes(app)` in `server/routes.ts`): all API routes, grouped by domain.

### Route Organization

`server/routes.ts` is the central route registry — it imports and mounts all domain routers. As of current implementation, there are 100+ route files in `server/routes/`, organized by feature domain:

| Domain | Route files |
|---|---|
| Authentication | `auth.session.ts`, `password-reset.ts` |
| Meal generation | `meals.ts`, `craving-creator.ts`, `dessert-creator.ts`, `beverage-creator.ts`, `fridge-rescue.ts`, `gatherings.ts`, `holiday-feast.ts`, `breakfast.ts`, `lunch.ts`, `dinner.ts`, `snacks.ts` |
| Meal engine | `meal-engine.ts`, `mealEngine.routes.ts`, `weeklyPlan.routes.ts` |
| Shopping | `shoppingList.ts`, `shoppingListV2.ts` |
| Tracking | `mealLogs.ts`, `macroLogs.ts`, `biometricsRoutes.ts`, `glucose-logs.ts`, `alcohol-log.ts`, `vitals-bp.ts`, `waterLogs.ts`, `foodLogs.ts` |
| Clinical | `glp1.ts`, `glp1Shots.ts`, `diabetes.ts`, `bodyComposition.ts`, `clinicalLabs.ts`, `cycleProtocolRoutes.ts` |
| ProCare | `procareRoutes.ts`, `studioRoutes.ts`, `proTabletRoutes.ts`, `clientTabletRoutes.ts`, `proBiometricsRoutes.ts`, `proBoardRoutes.ts`, `proWeekBoard.ts` |
| Coaching | `coaching.ts`, `careTeamRoutes.ts`, `patientAssignment.ts`, `physicianReports.ts` |
| Billing | `stripeCheckout.ts`, `stripe.ts`, `stripeWebhook.ts`, `iosVerify.ts`, `product-codes.ts` |
| Storage | `uploads.ts`, object storage routes |
| Notifications | `notify.ts`, `notify.register.ts`, `notifyAck.ts`, `pushNotifications.ts`, `sms.ts` |
| Creator | `creator.ts`, `kitchens.ts`, `kitchenLibrary.ts`, `adminKitchenImports.ts` |
| Admin | `admin.ts`, `adminChefKitchens.ts`, `adminSignatureLibrary.ts`, admin SQL console |

### Middleware Stack

| Middleware | Purpose |
|---|---|
| `requestId` | Attaches unique request ID to every request |
| `logger` | Structured request logging |
| `createApiRateLimit` | Per-IP rate limiting on API routes |
| `requireAuth` | Session/token auth; attaches `AuthenticatedUser` to request |
| `requireActiveAccess` | Enforces paid tier for premium-gated routes |
| `requirePremiumAccess` | Enforces premium-specific entitlements |
| `requireMacroProfile` | Validates macro targets are set before macro-dependent features |
| `errorHandler` | Global error handler; normalizes error responses |
| `sentryErrorHandler` | Sentry error capture on uncaught exceptions |

### Service-Layer Philosophy

Route handlers are thin. Business logic lives in `server/services/`. Services are:
- Single-responsibility: one service per domain concern
- Independently testable: no implicit dependencies on request/response objects
- Composable: route handlers compose multiple services; services do not call route handlers

### Enforcement Systems

The enforcement stack (Protocol Envelope, Enforcement Gateway, Safety Profile, Macro Truth Contract) is covered in detail in Section 6. All generators call into this stack; it is not optional or route-configurable.

### Worker Systems

`server/services/voiceJobWorker.ts`: polling-based worker for async voice note transcription and moderation. Runs as a background process alongside the main Express app.

`server/workers/smsWorker.ts`: BullMQ-based SMS delivery worker using Twilio. Redis connection is currently disabled (logged); Twilio client is initialized but queue is inactive pending Redis availability.

---

## 4. Database Architecture

### PostgreSQL and Drizzle ORM

The platform uses PostgreSQL as its sole database. Drizzle ORM provides type-safe query building with direct SQL access for complex queries (`db.execute(sql\`...\``). The ORM layer never generates N+1 queries in hot paths; multi-entity reads use joins or `inArray` set queries.

**Schema organization:**

| Location | Contents |
|---|---|
| `shared/schema.ts` | Core tables: users, meals, mealPlans, mealLog, savedMeals, creators, shoppingListItems, userMealPrefs, barcodes, mealLogsEnhanced, mealInstances, userRecipes, aiMealPlanArchive |
| `server/db/schema/` | Domain schemas: 30+ files |

### Domain Schema Files

| Schema file | Domain |
|---|---|
| `studio.ts` | Studios, studio memberships, client notes, activity log |
| `procare.ts` | Pro accounts, client links, subscriptions, payouts |
| `clinicalLabs.ts` | Clinical lab values (full metabolic, cardiac, thyroid, oncology panels) |
| `auditLog.ts` | PHI-boundary audit trail |
| `legal.ts` | User document acceptance records |
| `organizations.ts` | Multi-tenant organization definitions |
| `householdProfiles.ts` | Household member profiles |
| `mealBoards.ts` | Weekly meal board slot assignments |
| `generatedMeals.ts` | AI-generated meal records |
| `biometrics` (via shared) | Weight, glucose, body composition, blood pressure, sleep |
| `bodyComposition.ts` | Body fat percentage, lean mass, measurements |
| `aiUsage.ts` | Per-feature daily AI usage tracking for quota enforcement |
| `creatorSystemConfigs.ts` | Signature Kitchen configuration (versioned JSON) |
| `creatorMeals.ts` | Creator-attributed generated meals |
| `mealImageCache.ts` | Cached meal image object storage paths |
| `userBehaviorSummary.ts` | Behavioral pattern summary (most common cuisine, compliance tags) |
| `careTeam.ts` | Care team membership (coach + physician on one patient) |
| `patientAssignment.ts` | Physician patient assignments |
| `restaurantGuideSessions.ts` | Restaurant guide session records |
| `founders.ts` | Founder account records |
| `sms.ts` | SMS log and meal reminder records |
| `mindset.ts` | Mindset and behavioral content records |
| `trivia.ts` | Nutrition trivia game records |
| `chefSignatureLibrary.ts`, `chefSignatureImports.ts` | Chef signature meal library |

### Clinical Data Structures

`clinicalLabs.ts` is the most structured clinical schema. It stores 25+ individual biomarker columns with typed numeric precision:

| Panel | Markers |
|---|---|
| Metabolic | A1C, fasting glucose, fasting insulin, triglycerides |
| Lipid | LDL, HDL |
| Cardiac | Blood pressure (systolic/diastolic), ejection fraction |
| Renal | Creatinine, BUN |
| Coagulation | INR |
| Liver | ALT, AST, bilirubin, albumin |
| Thyroid | TSH, free T4, free T3, TPO antibodies, thyroglobulin antibodies |
| Inflammation | CRP (C-reactive protein) |
| Hormonal | Cortisol |
| Oncology/Nutrition | Prealbumin (transthyretin — short-term nutrition status) |

Each marker drives protocol resolution in `resolveProtocolFromLabs.ts`. Lab values are stored with `userId`, `recordedById`, `labDate`, and `notes`. `recordedById` distinguishes patient self-reported values from clinician-entered values.

### Shopping Systems

The shopping list V2 schema stores consolidated items with:
- `userId` / `profileId` scoping
- Ingredient name, normalized quantities, retail unit conversions
- Source meal references for transparency
- Allergen and dietary compliance tags
- Retail intelligence metadata (package type, typical retail unit)

### ProCare Schema

**`studios` table:** One studio per professional account. Carries studio identity (name, logo, theme color, contact), `orgId` for multi-tenant isolation, `type` (`studio` | `clinic`), `verificationStatus` (`pending` | `verified` | `rejected`).

**`studioMemberships` table:** Client-studio enrollment records. Includes plan, status, and billing reference.

**`clientLinks` table:** Active coach-client relationship. `mealBoardControl` field (`"client"` | `"coach"`) governs board-lock state.

**`client_notes` table** (via studio schema): Unified store for text messages, voice notes, session notes, and progress notes. Fields: `entry_type`, `note_type`, `visibility`, `audio_object_key`, `transcript`, `moderation_status`, `audio_duration_sec`.

**Activity log:** `activityActionEnum` has 20+ defined action types covering every state change in the coach-client relationship lifecycle, from `membership_created` through `board_access_changed` and `message_blocked`.

### Household Systems

Each `householdProfile` is a full constraint-bearing user persona:
- `cuisinePreference`, `cuisineIntensity`
- Complete allergen, avoidance, and dietary identity profile
- Health conditions, macro targets, goals
- Independent generation history

A family plan subscriber can have up to 4 household profiles. `getMaxHouseholdProfiles()` enforces this limit based on the plan lookup key.

---

## 5. AI System Architecture

### OpenAI Integrations

| Use | Model / API |
|---|---|
| Meal generation (all builders) | GPT-4 series via `openai.chat.completions.create` |
| Voice note transcription | Whisper via `openai.audio.transcriptions.create` |
| Ingredient intelligence analysis | GPT-4 with structured output |
| Behavioral pattern extraction | GPT-4 with structured JSON schema |
| Voice journal | Whisper + GPT-4 synthesis |
| Restaurant / pairing recommendations | GPT-4 |

### Protocol Envelope

`protocolEnvelope.ts` is the mandatory pre-generation assembly layer. Before any OpenAI call is made:

**`loadUserProtocolEnvelope(userId)`** assembles:
- Dietary identity (outermost constraint)
- Allergy and avoidance profile (full expansion)
- Medical conditions and clinical protocols (physician-assigned and self-reported)
- Cuisine preference and intensity
- Behavioral preferences (meal size, heat, convenience)
- Macro targets
- Household profile override (if active profile differs from account owner)

**`enforceBeforeGenerate(envelope, request)`** validates the generation request against the assembled envelope before any AI call. Returns PASS or BLOCK with reason.

**`buildComplianceSection(envelope)`** generates the compliance instruction block injected into every prompt — the explicit constraint list the AI receives.

**`scanGeneratedOutput(envelope, output)`** validates every AI response against the same envelope before the response is returned to the user.

**`buildMealComplianceBundle(envelope, meal)`** attaches compliance metadata to every generated meal object — what constraints were active and how the meal satisfies them.

**`filterMealsByProtocol(meals, envelope)`** bulk-filters pre-generated meal sets against a protocol envelope for meal library operations.

### Prompt Assembly Architecture

Generation prompts have a fixed structural hierarchy:

```
[System identity + chef/studio persona if Signature Kitchen active]
[Compliance section — constraint list from Protocol Envelope]
[Behavioral memory hints — soft preferences from evidence record]
[Clinical modifier block — condition-specific guidance overlays]
[User request / craving / ingredients / context]
[Output schema — JSON structure specification]
```

The compliance section always appears before user input. Constraint instructions cannot be overridden by user prompt content. This is an architectural property of prompt assembly, not a prompt instruction.

### Post-Generation Validation

Every AI response passes through three sequential validation passes before being returned:

1. **Protocol scan** (`scanGeneratedOutput`) — allergens, dietary identity violations, medical hard limits
2. **Macro truth validation** (`macroTruthContract`) — no invented macro values, null preservation
3. **Output scan** (`scanTextForHighRiskIngredients`, `scanForHiddenDietaryViolations`) — ingredient-level text analysis

If any pass fails, the response is discarded. The route handler does not return a partial result.

### Behavioral Memory Service

`behavioralMemoryService.ts` derives a `PreferenceProfile` from the user's existing meal interaction history. It is read-only and write-never — it derives preferences from evidence, never from AI inference.

**Evidence sources** (descending signal strength):
1. `saved_meals` — explicit save ("I want this again")
2. `user_recipes` — user-saved recipe (strong intent)
3. `meal_instances` (status=`logged`) — logged as eaten (acceptance)

**Scoring:**
- Base score: +1.0 per evidence event
- Recency decay: `score × e^(-0.025 × daysSince)` (half-life ≈ 28 days)
- Minimum threshold to surface as preference: 0.4
- Maximum preferences per category: 3

Derived preferences are injected as soft hints after enforcement passes, and enforcement runs again post-generation. The behavioral memory system cannot override safety constraints.

### Macro Truth Contract

`macroTruthContract.ts` is the canonical semantic standard for macro values:
- `null` = unknown; do not substitute or invent
- `0` = confirmed zero; treat as accurate
- No layer may mutate a macro value
- Validation layers may reject or trigger regeneration; they may not change values
- Macro injection is blocked for clinical contexts: keto, diabetic, GLP-1, carnivore, anti-inflammatory, liver support, and others

### AI Quota Service

`aiQuotaService.ts` enforces per-feature daily usage limits by plan tier:

| Feature | Free tier daily limit | Paid tier |
|---|---|---|
| Fridge Rescue | 1 | Unlimited |
| Craving Creator | 0 (blocked) | Unlimited |
| Dessert Creator | 0 (blocked) | Unlimited |
| Beverage Creator | 0 (blocked) | Unlimited |
| Meal Builder | 0 (blocked) | Unlimited |

Limits reset at UTC midnight. Usage is tracked in `aiUsage` table per user, per feature, per day. Quota checks are synchronous and fail-fast before any AI call is made.

### AI Cost Guard

`costGuard.ts` implements a circuit-breaker pattern for runaway AI spending. Tracks token consumption and can block generation calls that would exceed configured spend thresholds. Operates independently of the quota system (quota = per-user limits; cost guard = platform-level spend protection).

---

## 6. Clinical Enforcement Architecture

### Enforcement Gateway

`enforcementGateway.ts` implements the five-tier constraint hierarchy with explicit priority ordering. Higher tiers always win conflicts with lower tiers.

| Tier | Name | Content | Wins against |
|---|---|---|---|
| 0 | Dietary Identity | Kosher, Halal, Vegan, Vegetarian, Gluten-Free, Paleo, etc. | All lower tiers |
| 1 | Allergy / Life-Safety | Declared allergens with expansion vocabulary | Tiers 2–4 |
| 2 | Medical Hard Limits | Carb ceiling (diabetic), sodium limit (heart failure), etc. | Tiers 3–4 |
| 3 | Medical Optimization | Protein minimum, fiber targets, clinical positive goals | Tier 4 |
| 4 | User Avoidances | Preference-level ingredient avoidances | N/A (lowest) |

**Fail-closed contract:** Unknown provenance or certification for a strict-protocol ingredient = BLOCK. The system treats uncertainty as unsafe.

### Allergy Systems

**Allergen expansion:** Raw allergen names are expanded to full ingredient vocabulary before enforcement. "Tree nuts" expands to walnut, pecan, almond, cashew, pistachio, macadamia, hazelnut, and all variant spellings. Enforcement scans against the full expanded list, not just the declared name.

**Allergen guardrails (`allergyGuardrails.ts`):**
- `ALLERGEN_EXPANSION`: Tier 1 clinical allergen expansion map
- `RESTRICTION_EXPANSION`: Dietary restriction expansion map
- `AVOIDANCE_EXPANSION`: User preference avoidance expansion map (distinct from allergens)
- `maskPlantMilks()`: Replaces dairy milk references with safe plant-based alternatives for dairy-free profiles
- `maskNutButters()`: Replaces peanut butter and tree nut butter references for nut-free profiles
- `scanForHiddenDietaryViolations()`: Post-generation text scan for violations that passed prompt-level enforcement

**Safety Profile Service:** Pre-generation deterministic blocker. Resolves `SAFE | AMBIGUOUS | BLOCKED | DIET_ADAPT` before any AI call. Ambiguous dish detection identifies dishes with hidden allergen risk (jambalaya, paella, Thai, stir fry, etc.) and warns before proceeding.

### Protocol Systems

Each clinical protocol is a named constraint set implemented as a prompt builder and enforced at both generation and output scan layers:

| Protocol | Builders | Hard limits |
|---|---|---|
| GLP-1 Support | `glp1MealBuilder` | Low-fat, anti-nausea density, portion calibration |
| Diabetic Support | `diabeticMealBuilder` | Carbohydrate ceiling, glycemic index consideration |
| Anti-Inflammatory | `antiInflammatoryBuilder` | Blocks pro-inflammatory ingredients |
| Oncology Support | `oncologyBuilder` | Physician-assigned only; hard-blocked ingredient list; no treatment claims |
| Kidney Support | `kidneyBuilder` | Phosphorus, potassium, sodium limits |
| Heart Failure | `heartFailureBuilder` | Sodium and fluid restriction |
| Liver Support | `liverSupportBuilder` | Low-fat, branched-chain amino acid optimization |
| Thyroid Support | `thyroidSupportBuilder` | Goitrogen management |

### Lab-Aware Protocol Resolution

`resolveProtocolFromLabs.ts` maps lab values to protocol recommendations:
- A1C > threshold → diabetic protocol consideration
- TSH + free T4 pattern → thyroid protocol activation
- Prealbumin level → oncology nutrition status modifier
- CRP elevation → anti-inflammatory protocol escalation
- Liver panel values → liver support protocol activation

Protocol recommendations from labs are physician-reviewed before activation. The system suggests; the physician assigns.

### Fail-Closed Logic

Fail-closed applies at three layers:
1. **Ingredient Intelligence Store:** Unknown certification for a strict-protocol ingredient = BLOCK
2. **Allergen scan:** Any scan returning ambiguous = surfaces warning; blocked = hard stop
3. **Post-generation scan:** Any violation detected = discard response, do not return to user

There is no fallback behavior that returns a questionable result with a disclaimer. Uncertain = blocked.

---

## 7. Shopping and Retail Infrastructure

### Shopping List Pipeline (V2)

The V2 shopping list pipeline is a multi-stage consolidation and intelligence layer:

**Stage 1 — Collection:** All meals on the active weekly board (or a specified meal set) contribute their raw ingredient lists.

**Stage 2 — Consolidation** (`shoppingConsolidation.ts`): Duplicate ingredients across meals are identified and merged. Quantities are accumulated using unit-aware arithmetic (grams + grams, cups + cups). Incompatible unit types trigger normalization before accumulation.

**Stage 3 — Retail Intelligence** (`retailIntelligence.ts`): Accumulated quantities are converted to human-readable retail units — "1 bunch asparagus," "3.5 lb ground turkey," "2 bags spinach" — using per-ingredient retail packaging profiles.

**Stage 4 — Allergy annotation:** Each consolidated item is tagged with allergen and dietary protocol annotations for at-a-glance safety review.

**Stage 5 — Display rendering:** `ShoppingListMasterView.tsx` renders the final list. Raw gram/mL values are never displayed to users — the pipeline is designed to always produce a retail-intelligible display string or return `null` (item omitted from display).

### Retail Intelligence

`retailIntelligence.ts` maintains a per-ingredient retail profile database:
- Typical retail unit (bunch, bag, carton, can, lb, oz, piece)
- Conversion factor from gram/mL accumulation to retail unit
- Package size normalization (how many grams in a standard retail unit)
- Special handling for items typically sold by count (eggs, lemons, avocados)

`formatQuantity()` is the canonical display formatter. Its contract: return a human-readable retail string or `null`. It never returns a raw numeric gram/mL value. The fallback for unrecognized ingredients is `null`, not the raw accumulated value.

### Grocery Delivery Integrations

On tablet (768px+) and desktop, the shopping list view exposes direct grocery delivery links (Instacart, Walmart). On mobile, a simplified nudge card directs users to the desktop experience. Integration is external-link based; cart pre-fill is handled by partner affiliate parameters.

### Ingredient Intelligence Store

`ingredientIntelligence.ts` is a curated provenance database. Each entry includes:
- Source classification: animal / plant / synthetic / derived / unknown
- Processing metadata relevant to dietary protocols
- Certification status: kosher-certified / halal-certified / both / none / unknown
- Per-protocol risk level and stated reason
- Fail-closed protocol list (protocols for which certification-unknown = blocked)

Used by the Enforcement Gateway for Tier 0 and Tier 1 checks on ingredients whose compliance depends on source provenance, not just ingredient name.

### Smart Scan / MacroScan Architecture

Barcode scanning: the barcode service queries a nutritional database with the scanned UPC and returns macro values, ingredient list, and dietary compliance tags. Results are stored in the `barcodes` table for caching. MacroScan provides on-device label scanning for manual nutrition fact entry when barcodes are unavailable.

---

## 8. ProCare and Multi-User Infrastructure

### Professional Account System

A professional account is a user account with:
- A linked `pro_accounts` record (Stripe account ID for payouts)
- An owned `studios` record (one studio per professional)
- Completed attestation (verified by attestation flow)
- Active ProCare subscription

The studio is the organizational unit of professional practice. All coaching activities are studio-scoped.

### Coach Relationship Architecture

```
Studio
  └── StudioMemberships (N clients enrolled)
  └── ClientLinks (active coach-client pairs)
        └── BoardControl (client | coach)
        └── MealBoard (weekly slot assignments)
        └── ClientNotes (messages + voice notes)
        └── ActivityLog (all relationship events)
```

`clientLinks.mealBoardControl` is the board-lock state. When set to `"coach"`, the client sees an assigned program; when `"client"`, the client manages their own board.

### Physician System

Physicians have a separate role path:
- `physician_professional_agreement` + `physician_scope_of_practice` documents
- Access to `clinicalLabs` for assigned patients
- `patientAssignment` table for physician-patient relationships
- `labProtocolOwnership.ts` governs which physician can modify which patient's protocols
- `physicianReports.ts` provides report generation from patient data

### Care Team Architecture

`careTeam.ts` supports a multi-role care team model — a patient can have both a nutrition coach and a physician simultaneously, each with role-appropriate access:
- Coach: meal board, compliance, behavioral monitoring, messaging
- Physician: lab values, clinical protocol assignment, report generation
- Neither role can access the other's designated domain

### Organization System

`orgContext.ts` provides the full organizational context for multi-tenant deployments. The `OrgContext` type includes:

| Field | Purpose |
|---|---|
| `id`, `slug` | Organization identity |
| `organizationType` | `public` / `enterprise` / `educational` / `healthcare` |
| `dataAccessMode` | `standalone` / `shared` — governs cross-org data visibility |
| `appName`, `appShortName` | White-label display names |
| `primaryColor`, `secondaryColor`, `accentColor` | Branded color scheme |
| `logoUrl`, `logoDarkUrl` | Branded logo assets |
| `customDomain` | Custom domain for white-label deployments |
| `poweredByVisible` | Whether "Powered by My Perfect Meals" appears |
| `featureFlags` | Per-org feature flag overrides |
| `isWhiteLabel` | White-label deployment flag |

The default org (`MPM_PUBLIC_ORG_ID`, slug `mpm-public`) applies to all non-enterprise users. Org context is resolved at request time and available to all routes via `loadOrgContext()`.

### Coach Registry

The coach registry (`server/config/coaches.ts`, `client/src/config/coaches.ts`) is the canonical list of platform coaches. Each coach is identified by a slug only — user IDs are resolved from environment variables at runtime (`COACH_IDRISE_USER_ID`, `COACH_JEN_USER_ID`). Coach user IDs are never exposed to the frontend. Adding a new coach requires only a registry entry and environment variable — no code changes to routing, generation, or billing systems.

---

## 9. Voice and AI Processing Systems

### Voice Note Transcription Pipeline

Voice notes in the ProCare communication system follow an async multi-stage pipeline entirely separate from the HTTP request cycle:

```
[Client records audio]
  → Audio uploaded to Object Storage (presigned URL)
  → audio_object_key stored in client_notes record
  → tablet_voice_jobs record created (status: pending)

[VoiceJobWorker — background polling every 8 seconds]
  → SELECT FOR UPDATE SKIP LOCKED (concurrency-safe, no double-processing)
  → Max 3 processing attempts per job
  → Download audio from Object Storage
  → OpenAI Whisper transcription
  → tabletModerationService.moderateContent(transcript)
  → If approved: UPDATE client_notes (transcript, body, moderation_status='approved')
  → If blocked: UPDATE client_notes (body='[Voice note removed]', moderation_status='blocked')
  → logClientActivity (activity trail for audit)
```

**Concurrency safety:** `FOR UPDATE SKIP LOCKED` prevents multiple worker instances from processing the same job. The worker is designed to run multiple instances in parallel safely.

**Failure handling:** Jobs that fail all 3 attempts remain in `failed` state — they are not silently discarded. A failed job is an auditable event available for administrative review.

### Voice Command / Copilot System

The Copilot system (`CopilotSystem.tsx`, `CopilotCommandRegistry.ts`) provides natural language navigation and platform action execution via voice input:

- Voice input captured via browser Web Speech API or native iOS microphone
- Commands parsed by `VoiceCommandParser` (server-side) or the Copilot client
- Resolved commands dispatched via `CopilotCommandRegistry` handlers
- Navigation commands use the registered Wouter navigation handler
- Modal commands use the registered modal handler

### AI Voice Journal

`ai-voice-journal.ts` route handles the voice journal feature: audio upload → Whisper transcription → GPT-4 synthesis → structured journal entry output. The synthesis layer extracts behavioral signals, mood indicators, and nutrition-relevant content from free-form voice journal entries.

### Moderation Pipeline

The tablet moderation service (`tabletModerationService.ts`) runs on both text messages and voice note transcripts. The same rule set applies to both channels:
- High severity (block + flag): death threats, slurs, grooming, assault threats, professional misconduct
- Medium severity (block): personal contact info (email, phone, social handles), off-platform solicitation
- Low severity (warn): mild unprofessional language

All moderation decisions are logged in the activity log (`message_blocked`, `message_flagged` actions).

### Push Notification System

- VAPID-based web push via `pushNotifications.ts`
- Device token registration: `notify.register.ts`
- Meal reminders: `reminderService.ts` with scheduled delivery via `mealReminder` table
- Notification acknowledgment tracking: `notifyAck.ts`
- SMS fallback for users without push registration via Twilio

---

## 10. Billing and Subscription Infrastructure

### Access Tier System

`accessTier.ts` defines the platform's three access states:

| Tier | Condition |
|---|---|
| `PAID_FULL` | Active paid subscription (any plan key in `PAID_PLAN_KEYS`) OR founder OR pre-launch mode |
| `TRIAL_FULL` | Active trial window (`trialEndsAt` in future) |
| `FREE` | No active subscription, no active trial |

**`BILLING_ENFORCED` environment variable:** When `false` or unset, all users receive `PAID_FULL` regardless of subscription state (pre-launch mode). When `true`, real entitlement enforcement activates. This is the master launch switch — no code deployment required.

Access tier is resolved server-side on every authenticated request in `requireAuth` middleware. The frontend receives the resolved tier; it cannot provide or modify its own tier.

### Stripe Integration

**Checkout flow** (`stripeCheckout.ts`): Server-side Stripe checkout session creation. Price IDs are loaded from environment variables (`STRIPE_PRICE_SIGNATURE_KITCHEN_PARTNER`, etc.) — never hardcoded.

**Subscription management** (`stripe.ts`): Customer portal access, subscription status queries, plan upgrade/downgrade handling.

**Webhook processing** (`stripeWebhook.ts`): All Stripe event processing. Webhook signature verification (`stripe.webhooks.constructEvent`) is the first operation — no state changes occur without a verified signature. Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.

### Apple In-App Purchase Verification

`iosVerify.ts` handles all App Store purchase flows:
- Receipt data submitted from the iOS client is verified against Apple's receipt validation API
- Server verifies with Apple before granting any entitlement
- Both sandbox and production Apple endpoints are supported
- Verification results are stored; duplicate receipt claims are rejected

### ProCare Billing Schema

`procare.ts` schema includes:
- `subscriptions`: client-coach subscription record with Stripe subscription ID and plan code
- `payouts`: professional payout records with Stripe transfer IDs and status
- `pro_accounts`: professional Stripe Connect account for payout disbursement

### Entitlement Architecture

All entitlement decisions follow a consistent pattern:
1. `requireAuth` middleware resolves `accessTier` and `entitlements` from the database
2. Route-level middleware (`requireActiveAccess`, `requirePremiumAccess`) blocks the request if tier is insufficient
3. Feature-level quota check (`aiQuotaService`) enforces daily limits for tier-specific quotas
4. No client-provided plan or entitlement data is trusted

### Family Plans

Family plan lookup keys (`mpm_family_*`) are recognized by `isHouseholdPlan()` and unlock:
- Up to 4 household profiles
- Independent dietary identity, allergen profile, and constraint set per profile
- Consolidated shopping list across all active profiles
- Single billing account for the household

---

## 11. Deployment and Operational Infrastructure

### Deployment Architecture

The platform targets Google Cloud Run for production deployment. Key configurations:
- `trust proxy 1` — single proxy hop from Cloud Run load balancer
- Health-first boot (server responds to health checks before initialization completes)
- Zero-downtime rolling deploys via Cloud Run revision management
- Google Site Verification HTML response served at static path

### Environment Configuration

Environment variables are the sole configuration mechanism. No configuration files are committed. Critical variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API access |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `APPLE_SHARED_SECRET` | Apple receipt verification |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS |
| `RESEND_API_KEY` | Email delivery |
| `VITE_SENTRY_DSN`, `SENTRY_DSN` | Error monitoring (client + server) |
| `BILLING_ENFORCED` | Master launch switch |
| `MPM_TESTER_EMAILS` | Tester account allowlist |
| `COACH_IDRISE_USER_ID`, `COACH_IDRISE_STUDIO_ID` | Coach registry IDs |
| `ONCOLOGY_SUPPORT_V1` | Oncology feature flag |
| `MACRO_AUDIT` | Macro debug logging toggle |

### Health Monitoring

- `/healthz` — fast health check (pre-initialization, always responds)
- `/api/health` — detailed health JSON (initialization state, service connectivity)
- Sentry error capture on both client (React ErrorBoundary) and server (Express error handler + `sentryErrorHandler`)
- `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers log to stderr without crashing the process

### Logging Systems

- **Request logging:** `requestId` middleware attaches UUID per request; `logger` middleware logs method, path, status, duration
- **Audit logging:** `auditLog.ts` fire-and-forget PHI-boundary-aware audit trail
- **AI telemetry:** `aiTelemetry.ts` tracks generation latency, token usage, and feature-level call volume
- **Activity logging:** `activityLog.ts` records all coach-client relationship events
- **Error logging:** `errorLog.ts` for structured application error storage
- **Boot logging:** `console.log` instrumented boot sequence with timestamps for startup performance analysis

### Validation and Pre-Deploy Checks

`scripts/validate.sh` runs as a pre-push git hook (installed via `scripts/install-hooks.sh`):
- Verifies critical server files are present
- Checks that no raw `fetch()` calls are hitting auth-protected routes
- Confirms the server boots cleanly
- Takes ~15–20 seconds; must exit PASS before pushing

### Operational Flags

All operational state changes can be made without code deployment via environment variables:
- `BILLING_ENFORCED`: activate real paywalls
- `MPM_TESTER_EMAILS`: add/remove tester accounts
- `ONCOLOGY_SUPPORT_V1`: enable/disable oncology features
- `MACRO_AUDIT`: enable macro debug logging

---

## 12. Enterprise and Scaling Direction

### White-Label Architecture (Implemented Foundation)

The `organizations` table and `OrgContext` system provide the complete data model for white-label deployments. Per-organization configuration includes: custom app name, short name, branding colors, logo assets, custom domain, `poweredByVisible` toggle, and per-organization feature flags.

The `isWhiteLabel` flag on the `OrgContext` type allows downstream systems to adjust behavior for white-label instances. All studio memberships and client links carry `orgId` for cross-org isolation.

**Current state:** The data model, API layer, and context infrastructure are fully implemented. Full white-label front-end theming (dynamic CSS variable injection from `OrgContext` color values) and custom domain routing are roadmap items built on the existing foundation.

### Multi-Tenant Direction

The current multi-tenancy model is studio-scoped: each professional studio is an isolated data tenant. Scaling to institution-level tenancy (an educational organization as a parent tenant over multiple studios) requires:
- Organization-to-studio hierarchy enforcement (data model addition)
- Institutional admin role with cross-studio read access
- Institutional billing relationship (separate from per-studio ProCare billing)
- Aggregate reporting across studio members within the institution

The `orgId` foreign key is already present on studios, memberships, and client links. The schema extension point is defined; the enforcement and reporting layers need implementation.

### Future Scaling Architecture

**Horizontal scaling:** The Express application is stateless at the application layer. Session state is stored in PostgreSQL (`connect-pg-simple`). Multiple application instances can run in parallel without shared memory requirements.

**Database scaling:** PostgreSQL read replicas can be introduced for analytics and reporting queries without modifying application logic, as Drizzle ORM allows explicit replica routing. High-volume tables (`aiUsage`, `auditLog`, `mealLog`) are candidates for partitioning by date.

**AI cost scaling:** `costGuard.ts` and `aiQuotaService.ts` provide the control layer for AI spend management at scale. Rate limits, daily quotas, and feature-level cost thresholds can be adjusted via configuration without code changes.

**Voice processing scaling:** The `VoiceJobWorker` polling architecture is designed for multiple parallel instances with `FOR UPDATE SKIP LOCKED` concurrency safety. As voice note volume grows, additional worker instances can be deployed without coordination infrastructure.

**Message queue:** The SMS worker uses BullMQ (Redis-backed). Redis availability would enable full async job queue infrastructure for email, SMS, push, and AI generation jobs — decoupling request handling from async processing.

### Enterprise Deployment Goals

- **SSO / SAML:** Enterprise identity provider integration for institutional user provisioning
- **Bulk provisioning:** Product code API for institutional enrollment at scale (foundation implemented in `product-codes.ts`)
- **Compliance reporting:** Aggregate, non-PHI institutional reporting (compliance rates, engagement metrics) for enterprise wellness program management
- **Data residency:** Regional database deployment for EU and other jurisdiction requirements
- **SLA infrastructure:** Dedicated infrastructure pools for enterprise accounts requiring uptime guarantees

### Healthcare Integration Goals

**EHR integration (HL7 FHIR):**
- The `clinicalLabs` schema maps directly to FHIR `Observation` resource types
- The `patientAssignment` and care team structures map to FHIR `CareTeam` and `Practitioner` models
- The PHI-boundary audit log is HIPAA audit trail compatible
- FHIR resource adapters (import/export) are the integration layer to build

**Telehealth integration:**
- The physician portal, patient-physician legal agreements, and clinical protocol assignment system provide the authorization and consent infrastructure
- Telehealth platform integration (e.g., Teladoc, MDLive) would use the existing care team and physician portal as the nutrition coordination layer within a telehealth visit context

**Formal HIPAA compliance:**
- Current PHI-boundary discipline, audit logging, and role separation provide the technical safeguards foundation
- Formal HIPAA compliance requires: Business Associate Agreement framework, risk assessment documentation, workforce training policy, incident response procedures, and a covered entity relationship
- SOC 2 Type II audit is the pre-requisite milestone for enterprise healthcare contracting

---

*Document generated from implemented codebase and operational infrastructure — May 2026.*

*Primary source files: server/prod.ts, server/index.ts, server/routes.ts, server/services/protocolEnvelope.ts, server/services/enforcementGateway.ts, server/services/behavioralMemoryService.ts, server/services/complianceEngine.ts, server/services/aiQuotaService.ts, server/services/voiceJobWorker.ts, server/services/safetyProfileService.ts, server/lib/accessTier.ts, server/lib/orgContext.ts, server/db/schema/*, shared/schema.ts, shared/planFeatures.ts, client/src/App.tsx*
