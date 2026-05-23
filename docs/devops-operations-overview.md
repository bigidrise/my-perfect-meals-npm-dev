# My Perfect Meals — Development & Operations Overview
**Version:** May 2026 | **Classification:** Internal Engineering Documentation

*This document describes the engineering workflow, deployment operations, infrastructure patterns, and operational practices used in the My Perfect Meals platform. It is generated from the actual codebase, scripts, and operational artifacts.*

---

## 1. Development Environment Structure

### Replit as the Development Platform

The project runs on Replit with two live environments operating simultaneously:

**Development environment** (`Start application` workflow):
```
rm -rf node_modules/.vite 2>/dev/null; NODE_ENV=development tsx server/index.ts
```
- Vite cache cleared on every start to prevent HMR stale state
- `tsx` provides TypeScript-native execution without a compile step
- Vite dev server integrated with Express for frontend HMR
- Full middleware stack active, including development-only routes (QA console, admin SQL)
- `dotenv` loads `.env` file before any module initialization

**Component preview server** (`artifacts/mockup-sandbox: Component Preview Server` workflow):
- Isolated Vite server for UI component prototyping on the canvas
- Runs independently of the main application
- Does not share session state or database context with the main app

### Dev vs. Production Environment Separation

Dev and production share the same PostgreSQL database in the current configuration. This is an intentional operational decision that allows testing against real data — with the tradeoff that it requires discipline around auth token stability and data mutation safety.

**Auth token design consequence:** The login route reuses the existing `authToken` if one exists for the user, rather than regenerating on every login. This prevents logging in on the dev environment from invalidating production sessions (and vice versa). This was fixed explicitly after the March 2026 cross-environment session invalidation incident.

**Environment bootstrap module** (`server/bootstrap/envSetup.ts`): A shared module imported by both `server/index.ts` (dev) and `server/prod.ts` (production) as the first operation. This module:
- Aliases `VITE_OPENAI_API_KEY` → `OPENAI_API_KEY` if the latter is absent (handles Replit secret naming)
- Validates critical environment variables at boot
- Logs boot status (OpenAI key length, database presence, S3 configuration)

The bootstrap module was introduced after a January 2026 fallback bug caused by environment variable drift between dev and production entry points — different variable handling in each entry file caused the AI generation fallback to activate in production without an obvious error.

### Boot Status Logging

Both entry points emit a structured boot sequence log:
```
[BOOT] My Perfect Meals - Production Server
[BOOT] OpenAI key length: 51
[BOOT] Database URL present: true
[BOOT] S3 bucket: <bucket-name>
[BOOT] AWS region: us-east-1
```

Key length (not value) is logged for the OpenAI key to confirm the key is present and plausibly valid without leaking the secret.

---

## 2. Git and Branching Workflow

### Branch Structure

| Branch | Purpose | Write access |
|---|---|---|
| `dev` | Active development; all changes land here first | Engineers |
| `main` | Production-mirroring branch; reflects what is deployed | Merge only (no direct commits) |

### Standard Development Workflow

All changes are made exclusively in the development (Replit) space:

```
1. Make all changes in dev space
2. npm run validate                    # Must exit PASS
3. git push origin dev                 # Triggers pre-push validation hook
4. Open PR: dev → main on GitHub
5. Review and merge PR
6. In production shell: git pull
7. Confirm: curl /api/health
8. Update LAST_STABLE.md
```

**No direct production edits.** The only exception is emergency hotfixes — and these are tracked explicitly in `CHANGE_LOG.md` with a note that normal workflow was bypassed.

### Pre-Push Validation Hook

`scripts/install-hooks.sh` installs a git pre-push hook at `.git/hooks/pre-push` that calls `bash scripts/validate.sh` before every push. The hook is installed once per environment clone.

```bash
# Emergency bypass (document the reason in CHANGE_LOG.md)
git push --no-verify
```

The hook cannot be bypassed silently — `--no-verify` is an explicit override that must be intentional.

### Snapshot Commits

`npm run push` is available as a convenience script for creating a timestamped snapshot commit in dev. This creates an identifiable checkpoint in git history without requiring a meaningful commit message — useful during rapid iteration when intermediate state needs to be preserved before the feature is ready for a proper commit.

### Merge Patterns

Merges are always `dev → main` via GitHub pull request. Rebase is explicitly prohibited in production — only merge commits are used. This preserves a linear, auditable production history where each production state corresponds to a specific merge commit.

### Rollback Philosophy

`LAST_STABLE.md` is the operational rollback anchor. It is updated manually after every confirmed successful production deploy. It contains:
- Commit hash of the last confirmed-good deploy
- Date deployed
- Human-readable description of what was in the deploy
- Complete rollback command

**Rollback procedure:**
```bash
# In production shell
git --no-optional-locks log --oneline -5    # Confirm current state
git reset --hard <commit-hash-from-LAST_STABLE.md>
# Restart production server
```

`git reset --hard` is used — not `git revert`. This is a fast, clean rollback that immediately restores the known-good binary state. The tradeoff (discarding uncommitted changes) is acceptable in an emergency where the production environment is the only shell in scope.

**Deploy history** is maintained in `LAST_STABLE.md` as a running table of date, commit hash, and deploy notes — providing a sequential audit trail of production states.

---

## 3. Deployment Operations

### Full Deploy Sequence

The deploy sequence is prescriptive and must not be deviated from:

```
Step 1: Make all changes in dev space only
Step 2: npm run validate                    # Exit PASS required
Step 3: git push origin dev                 # Pre-push hook runs validate again
Step 4: GitHub PR: dev → main (open + merge)
Step 5: Production shell: git pull
Step 6: Check /api/health in browser        # Verify production is healthy
Step 7: Update LAST_STABLE.md              # Commit and push update
```

If production breaks after `git pull`, `LAST_STABLE.md` is opened immediately and `git reset --hard <hash>` is executed.

### Build Validation (`scripts/validate.sh`)

The validation script runs approximately 15–20 seconds and executes four sequential checks:

**Step 1 — Server TypeScript check:**
```bash
npx tsc --noEmit -p tsconfig.server.json
```
Server and shared TypeScript are checked using a server-specific tsconfig. Client TypeScript errors are pre-existing and explicitly excluded from this check — they are non-blocking and do not fail the push.

**Step 2 — Critical file presence:**
Verifies that a defined list of critical server files exist and have not been accidentally deleted or moved. This catches the common failure mode of renaming a file without updating all import references.

**Step 3 — Raw fetch() auth violation scan:**
Scans client code for raw `fetch()` calls hitting auth-protected routes. All authenticated API calls must go through the platform's `apiRequest` wrapper, which handles auth token injection, error normalization, and retry logic. Raw `fetch()` to protected routes is a security and correctness violation.

**Step 4 — Server boot test:**
Starts the server in a subprocess and polls `/api/health` for up to 20 seconds. Checks the startup log for crash patterns (`uncaughtException`, `UnhandledPromiseRejection`, etc.). A clean boot that returns `{ ok: true }` from `/api/health` within 20 seconds is a PASS.

**Exit codes:**
- `0` = PASS or PASS WITH WARNINGS — safe to push
- `1` = FAIL — must fix before pushing

The `--report` flag writes a plain-text summary digest to `/tmp/mpm-validate-report-<timestamp>.txt` for archiving validation results.

### Health-First Startup System

Production boot is designed so that health checks always respond, even if application initialization fails:

```
Process start → HTTP server binds immediately (port 5000, 0.0.0.0)
  → /healthz → 200 "ok" (always, no middleware, no delays)
  → /api/health → { ok, initialized: false } until init completes
  → initializeApp() runs in background
  → Middleware stack activates after successful init
  → isInitialized flag set true
  → /api/health → { ok: true, initialized: true }
```

If `initializeApp()` fails, the server continues running and `/api/health` reports `{ initialized: false, initError: "<message>" }`. Health check infrastructure can distinguish between "process is down" and "process is up but initialization failed."

**Production health response fields:**
```json
{
  "ok": true,
  "initialized": true,
  "initError": null,
  "timestamp": "2026-05-23T...",
  "env": "production",
  "hasDatabase": true,
  "hasOpenAI": true,
  "isDeployment": true
}
```

### Environment Variable Management

Environment variables are the sole configuration mechanism. No config files are committed. Secrets are managed through Replit's secrets system, which injects them as environment variables at runtime.

**Critical operational variables:**

| Variable | Purpose | Flip behavior |
|---|---|---|
| `BILLING_ENFORCED` | Master launch switch — `"true"` activates real paywalls | Flip without code deploy |
| `MPM_TESTER_EMAILS` | Comma-separated tester email allowlist | Flip without code deploy |
| `ONCOLOGY_SUPPORT_V1` | Oncology feature flag (`"active"` or `"off"`) | Flip without code deploy |
| `MACRO_AUDIT` | Macro debug logging | Development only |
| `AI_DEBUG` | Full AI telemetry logging | Development only |
| `LOG_RAW_OUTPUT` | Log raw GPT output | Development only |
| `COST_WINDOW_MS` | Cost guard sliding window (default: 60000ms) | Tunable at runtime |
| `COST_MAX_CALLS_PER_USER` | Per-user AI call limit per window (default: 60) | Tunable at runtime |
| `COST_MAX_CALLS_GLOBAL` | Global AI call limit per window (default: 1000) | Tunable at runtime |

### Change Log Discipline

Every change is recorded in `CHANGE_LOG.md` with a standard format:
- **Change scope:** What was changed and why
- **Files touched:** Exhaustive list of modified files
- **Expected impact:** User-visible and system-level effects
- **Golden Path result:** Explicit verification against the golden path checklist

This creates an auditable engineering history in the repository itself, independent of git commit messages. The change log is the first reference point when diagnosing a regression — it allows correlating a production symptom with a specific change without bisecting git history.

---

## 4. Infrastructure Evolution

### Phase Architecture

The codebase has evolved through documented phases, each adding a distinct layer of capability:

**Phase 1 — Core meal generation:**
Express API + basic AI generation + user authentication + Stripe billing. Single-user, single-profile model. Meal generation without protocol enforcement (prompts only).

**Phase 2 — Protocol enforcement:**
Introduction of the Enforcement Gateway and Safety Profile Service. Generation moved from "prompt-based constraints" to "structural enforcement" — allergens, dietary identity, and medical conditions became deterministic blocks, not advisory instructions. The behavioral memory service (Phase 2 Step 1) was introduced as read-only evidence-based preference learning.

**Phase 3 — Clinical and compliance:**
HIPAA-aligned audit logging (`auditLog.ts` — explicitly labeled "Phase 3 HIPAA Compliance" in source). PHI boundary discipline formalized. Clinical lab schema introduced. Physician portal, patient-physician agreements, and lab-to-protocol resolution added. ProCare attestation gating implemented.

**Phase 4 (current) — ProCare expansion and enterprise readiness:**
Voice note transcription pipeline, tablet moderation service, async voice job worker. Multi-tenant organization schema. White-label OrgContext infrastructure. Creator System Configs (Signature Kitchens). Shopping list V2 with retail intelligence. Family plan and household profile support.

### January 2026 — Environment Drift Incident

The AI generation fallback activated in production without an obvious error signal. Root cause: `OPENAI_API_KEY` was not being aliased from `VITE_OPENAI_API_KEY` in `server/prod.ts` the same way it was in `server/index.ts`. The fix was the creation of `server/bootstrap/envSetup.ts` — a shared module imported by both entry points that handles all environment variable aliasing in one place.

**Lesson embedded in architecture:** Any environment-specific behavior that must be consistent across dev and production entry points belongs in the shared bootstrap module, not in each entry file independently.

### March 2026 — iOS StoreKit Migration

In-app purchase product IDs were migrated from non-consumable format (`mpm.iap.basic_upgrade.v1`) to auto-renewable subscription format (`mpm.sub.basic.monthly.v1`) to match App Store Connect configuration. The native plugin (`@squareetlabs/capacitor-subscriptions`) was crashing in the restore flow because `getCurrentEntitlements()` force-unwrapped nil on non-consumable transactions. Fix: replaced `getCurrentEntitlements()` with per-product `getLatestTransaction()` calls, added subscription expiration and revocation validation.

**Lesson:** iOS StoreKit product type (non-consumable vs. auto-renewable subscription) is not a client-side decision — it must match App Store Connect configuration exactly, and the native plugin behavior differs significantly between types.

### Shopping System Evolution

V1 shopping list: basic ingredient accumulation from meal logs, manual unit management, no retail intelligence.

V2 shopping list: full consolidation pipeline — unit-aware quantity accumulation, deduplication across meals, retail intelligence layer converting accumulated quantities to retail-unit strings ("1 bunch asparagus" not "340g asparagus"), allergen annotation per item. `formatQuantity()` return contract: human-readable string or `null` — raw gram/mL values are never shown to users.

### Enforcement System Evolution

Generation v1: allergen constraints embedded in prompt text ("avoid nuts"). Prompt-instructed, not enforced — AI could and did occasionally violate constraints.

Generation v2: Safety Profile Service added as a pre-generation deterministic check. Returns `SAFE | AMBIGUOUS | BLOCKED | DIET_ADAPT` before any AI call. Ambiguous dish detection added.

Generation v3: Enforcement Gateway with the full five-tier constraint hierarchy. `enforceBeforeGenerate()` + `scanGeneratedOutput()` pattern — both must pass, not just one.

Generation v4 (current): Ingredient Intelligence Store with provenance-aware fail-closed logic. Macro Truth Contract v1.0 with explicit `null` semantics. Post-generation scan as a third mandatory validation pass.

### Mobile / iOS Expansion

Web app → Capacitor iOS shell → App Store publication. Key operational transitions:
- Safe area handling: CSS custom properties injected at app root, zeroed on iOS native to prevent double-padding
- Native demo mode: `initNativeDemoMode()` before React render for App Store preview recording
- Push notifications: VAPID (web) → APNs (iOS) dual-path
- In-app purchases: Stripe (web) → Apple IAP (iOS) dual-path with server-side receipt verification
- StoreKit product type migration (non-consumable → auto-renewable, March 2026)

---

## 5. Debugging and Diagnostics Philosophy

### Diagnose-First Workflow

The engineering rule is: no code change without a diagnosed root cause. Symptoms are written down, reproduction steps are confirmed, root cause is identified, and the fix targets the root cause — not the symptom. "While I'm here" refactors are explicitly prohibited by `docs/agent-rules.md`: "Only touch files listed in the scope of the requested change."

### Change Discipline Rules

From `docs/agent-rules.md`:
- **One change set, one purpose.** No bonus refactors bundled into a fix.
- **Only touch files in scope.** Files not in the stated scope are not modified.
- **Do exactly what is asked.** Do not rewrite or restructure components that were not part of the request.
- **All new features must use `PhaseGate` for phased rollout.**

This discipline exists because the codebase is complex enough that unexpected interactions between changes are a real risk. Tight scope limits the blast radius of any single change.

### Boot Diagnostics

The boot sequence emits structured logs at each initialization step. If the server fails to reach `isInitialized = true`, the last boot log emitted before the failure identifies the point of failure:

```
🚀 [BOOT] Production server starting...
🕐 [BOOT] Start time: 2026-05-23T...
📍 [BOOT] PORT env: 5000 (default)
📍 [BOOT] NODE_ENV: production
✅ [BOOT] Server listening on 0.0.0.0:5000
⏱️ [BOOT] Ready for health checks at: ...
```

`/api/health` provides programmatic boot status including `initError` message if initialization failed — allowing diagnostic queries without shell access to the production container.

### AI Telemetry

`aiTelemetry.ts` provides structured observability for AI generation without changing user-facing behavior. Active when `AI_DEBUG=true` or `NODE_ENV=development`.

**Fallback reason codes** (structured enum, 16 codes):

| Code | Meaning |
|---|---|
| `parse_failed` | GPT response couldn't be parsed |
| `parse_default_nutrition` | Nutrition values fell back to defaults |
| `validator_reject` | Meal failed type validation |
| `catalog_fallback` | Fell back to catalog instead of AI |
| `carb_derived` | Carbs calculated, not from AI |
| `instruction_fallback` | Instructions fell back to defaults |
| `image_generation_failed` | DALL-E image generation failed |
| `api_rate_limit` | OpenAI rate limit hit |
| `api_timeout` | OpenAI request timed out |
| `api_error` | Generic OpenAI API error |
| `circuit_breaker_open` | Circuit breaker blocked request |
| `empty_response` | GPT returned empty/null content |
| `schema_validation_failed` | Zod schema validation failed |
| `ingredient_parse_failed` | Individual ingredient parsing failed |
| `no_catalog_match` | No match in meal catalog |
| `glycemic_filter_fallback` | Glycemic filtering reduced options |

Each telemetry session tracks: `sessionId`, `source` (which builder), `startTime`, `fallbackReasons[]`, `parseSuccess`, `validationSuccess`, `nutritionSource` (`ai | derived | default`), `ingredientParseRate`.

### Sentry Error Monitoring

Sentry is initialized in both server (`server/lib/sentry.ts`) and client (via `VITE_SENTRY_DSN`) at startup:

- **Production:** `tracesSampleRate: 0.1` (10% of transactions traced)
- **Development:** `tracesSampleRate: 0.0` (no transaction traces)
- `sendDefaultPii: false` — PII is never sent to Sentry
- Ignored errors: `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT` — these are infrastructure noise, not application errors

`captureException()` wrapper allows structured exception reporting with contextual metadata from anywhere in the codebase without a direct Sentry SDK dependency.

### Logging Philosophy

| Layer | Mechanism | Retention |
|---|---|---|
| Request log | `logger` middleware (method, path, status, duration) | Process lifetime |
| Audit log | `auditLog.ts` fire-and-forget DB write | Permanent (PostgreSQL) |
| Activity log | `activityLog.ts` coach-client events | Permanent (PostgreSQL) |
| AI telemetry | `aiTelemetry.ts` session records | Development only (configurable) |
| Error log | `errorLog.ts` structured application errors | Permanent (PostgreSQL) |
| Boot log | `console.log` instrumented sequence | Process lifetime |
| Sentry | Exception capture with context | Sentry retention policy |

**PHI log discipline:** Audit logs record that a field changed, not what value it changed to. `meta` in audit entries must not contain raw PHI values. This is enforced by code comment convention and code review — it is not technically enforced at the type level.

### Golden Path Checklist

`BASELINE_STATUS.md` is the functional regression checklist. It covers:

- **Identity:** signup, login, password reset, logout, re-login
- **Onboarding:** complete flow, profile + allergy save, dashboard landing
- **Macro Calculator:** flow completion, target save, dashboard visibility, restart
- **Meal Builders:** all builder variants, board save, board reload, shopping list
- **Builder Exchange:** page load, badge accuracy, builder switch, program transitions
- **Pro Portal:** client list, folder modal, messages tab, provider notes, biometrics, macro calculator, client dashboard routing
- **Pro Week Board:** coach opens 7 builder variants for client, data isolation (coach edits write to client's board, not coach's), client sees coach changes
- **Client Tablet:** client sees coach messages, client can reply, 10s auto-refresh polling

Any change that potentially affects these flows is verified against the checklist before the change log entry is closed.

### Production Debugging

When a production issue is reported:

1. Check `CHANGE_LOG.md` for recent changes that match the symptom
2. Query `/api/health` for initialization state
3. Check Sentry for recent unhandled exceptions in the relevant time window
4. Check the AI telemetry fallback reason codes if the issue is generation-related
5. Check the audit log for access pattern anomalies if the issue is data-related
6. If the issue is post-deploy: check `LAST_STABLE.md` and consider `git reset --hard` to the last stable commit

---

## 6. AI Operations and Cost Management

### Quota System

`aiQuotaService.ts` enforces per-user, per-feature daily limits tracked in the `aiUsage` database table:

| Feature | Free tier daily limit | Paid tier |
|---|---|---|
| Fridge Rescue | 1 | Unlimited |
| Craving Creator | 0 | Unlimited |
| Dessert Creator | 0 | Unlimited |
| Beverage Creator | 0 | Unlimited |
| Meal Builder | 0 | Unlimited |

Limits reset at UTC midnight. The quota check is synchronous and fails before any AI call is made — no tokens are consumed on a quota-blocked request.

### Cost Guard (Circuit Breaker)

`costGuard.ts` is the platform-level spend protection layer, independent of the per-user quota system:

```
Window: COST_WINDOW_MS (default: 60 seconds)
Per-user limit: COST_MAX_CALLS_PER_USER (default: 60 calls/window)
Global limit: COST_MAX_CALLS_GLOBAL (default: 1000 calls/window)
```

`costGuardCheck(userId)` is called before every AI generation request. If either limit is exceeded, it throws `budget:user` or `budget:global`. These errors surface to the user as a rate limit response, not a server error.

Both windows use in-memory sliding buckets. They reset automatically when the window expires. This is a fast, low-overhead protection mechanism — appropriate for first-line spend protection. Persistent cross-restart cost tracking would require database-backed counters.

**Environment tuning:** All cost guard parameters are environment variables — no code deploy needed to tighten or loosen limits in response to unexpected spending patterns.

### AI Feature Gating

Paid vs. free AI feature access is enforced at two layers:
1. `requireActiveAccess` middleware blocks the route before the handler runs
2. `aiQuotaService.checkDailyQuota()` enforces within-tier daily limits

Feature-level alpha/beta controls are implemented via the `PhaseGate` component in the frontend, which gates UI visibility based on access tier, tester status, or feature flag state. New AI features are gated behind `PhaseGate` before general availability, allowing controlled rollout to tester accounts before launch.

### AI Debug Controls

| Environment variable | Effect |
|---|---|
| `AI_DEBUG=true` | Full AI telemetry logging, raw output hash, parse success tracking |
| `LOG_RAW_OUTPUT=true` | Log raw GPT responses (WARNING: may include user content) |
| `MACRO_AUDIT=true` | Log macro value sources and contract violations |

All debug flags are disabled by default and must be explicitly set. They are not operational in production unless explicitly activated for a diagnostic session.

---

## 7. Operational Safeguards

### Fail-Safe Systems

**Protocol Envelope — mandatory:** `enforceBeforeGenerate()` and `scanGeneratedOutput()` are called in every generation path. There is no code path that produces AI output without both passes. Route handlers that skip either call cannot reach generation — it is a pre-condition, not a middleware that can be omitted.

**Macro Truth Contract:** `null` macro values are preserved through all pipeline layers. No layer may substitute a numeric fallback for an unknown value. Validation failures trigger regeneration, not value substitution.

**Fail-closed enforcement:** Unknown ingredient provenance for a strict-protocol ingredient = BLOCK. The system cannot produce output for an uncertain ingredient under a strict protocol.

**Cost guard throw:** When the cost guard triggers, it throws — it does not return a boolean. This means a generation call cannot proceed past a budget check unless the check explicitly passes. Silent cost overruns are not possible.

### Deployment Protections

**Pre-push hook:** `bash scripts/validate.sh` runs on every `git push`. The four validation checks (TypeScript, file presence, raw fetch scan, boot test) must all pass before GitHub receives the push. Bypass requires explicit `--no-verify` — it cannot happen accidentally.

**Health-first boot:** The production server answers health checks before initialization completes. Cloud Run and any load balancer health check infrastructure see a responsive process immediately, preventing premature traffic routing decisions while init is in progress.

**Unhandled error traps:**
```javascript
process.on('unhandledRejection', (reason) => console.error('UNHANDLED REJECTION:', reason));
process.on('uncaughtException', (error) => console.error('UNCAUGHT EXCEPTION:', error));
```
Both handlers log to stderr without crashing the process. Production uptime is preserved through exception logging rather than process termination.

### Entitlement Enforcement

Entitlement enforcement follows a defense-in-depth pattern:
1. Server resolves `accessTier` from the database on every authenticated request — client-provided tier is never trusted
2. `requireActiveAccess` middleware blocks paid-gated routes at the middleware layer
3. `requirePremiumAccess` enforces premium-specific entitlements beyond the basic paid tier
4. `aiQuotaService` enforces feature-level daily limits within the tier
5. `costGuard` enforces platform-level call rate limits independent of user tier

A request must pass all applicable layers. There is no shortcut path that grants access by passing a single check.

### Billing Protections

**Stripe webhooks:** Signature verification (`stripe.webhooks.constructEvent`) is the first operation in every webhook handler. No state changes occur without a verified Stripe signature.

**Apple receipt verification:** All IAP receipt data is verified against Apple's server before any entitlement is granted. Client-provided purchase confirmations are not trusted.

**`BILLING_ENFORCED` flag:** The master paywall switch. When unset, all users receive `PAID_FULL` (pre-launch mode). Setting it to `"true"` activates real enforcement. This is an environment variable flip — no code change, no deployment required.

### Environment Isolation

Development and production are isolated at the network level (separate Replit deployments). They share a database — which is explicitly documented and managed through auth token stability design (tokens are reused, not regenerated on login).

**Rule:** No direct production file edits except emergency hotfixes. All changes must flow through the dev → main pipeline. This is a process safeguard, not a technical one — enforcement is through discipline and `CHANGE_LOG.md` documentation.

### Moderation Safeguards

Voice note and text message moderation runs before storage — blocked content is never written to the database in its original form. Blocked voice notes are stored as `[Voice note removed]` with `moderation_status='blocked'`. The activity log records `message_blocked` and `message_flagged` actions for audit trail purposes.

The moderation service cannot be bypassed by route parameter or user input — it runs in the voice job worker outside the HTTP request cycle and in the message route handler before database write.

---

## 8. Mobile and iOS Operations

### Capacitor Workflow

The web application is wrapped in a Capacitor iOS shell for App Store distribution. The Capacitor layer provides:
- Native iOS shell with WKWebView rendering the web app
- Native plugin access (APNs push, StoreKit IAP, device sensors)
- Safe area management (iOS controls the safe area; CSS variables are zeroed to prevent double-padding)

**Development:** The Capacitor-wrapped app runs against the same dev server as the web app. Platform detection (`Capacitor.isNativePlatform()`) gates native-specific behavior.

**iOS demo mode:** `initNativeDemoMode()` is called before React render. This initializes state for App Store preview recording sessions — demo mode allows recording app flows without a real account or network connection.

### Apple Deployment Process

App Store submission follows the standard iOS release process:
1. Build the Capacitor iOS project against the production web bundle
2. Archive and submit through Xcode / App Store Connect
3. App Store review
4. Phased rollout or immediate release

**Version coordination:** iOS app version updates require App Store review (typically 24–48 hours). Web app updates are immediate (via `git pull` in production). Features that require iOS app changes (new native plugins, StoreKit product IDs, permission prompts) must be coordinated with the App Store submission timeline.

### iOS Verification Systems

**StoreKit (IAP):**
- Product IDs are auto-renewable subscription format: `mpm.sub.<tier>.<period>.v<version>`
- `getLatestTransaction()` per product (not `getCurrentEntitlements()`) — this prevents the nil force-unwrap crash on non-consumable transactions
- Subscription expiration and revocation are checked: expired or revoked subscriptions do not grant entitlements
- Receipt data submitted to server → server verifies with Apple → entitlement granted

**Server-side verification** (`server/routes/iosVerify.ts`):
- Supports both Apple sandbox and production verification endpoints
- Receipt verification results are stored
- Duplicate receipt claims are rejected

### Push Notifications

**Dual-path architecture:**
- Web: VAPID protocol (`pushNotifications.ts`, device token registration via `notify.register.ts`)
- iOS native: APNs via Capacitor push notification plugin

Both paths converge on the same notification content model. Meal reminders, coaching alerts, and program updates are delivered through whichever channel the user's device has registered.

### App Store Operational Handling

**Product ID changes:** Changing StoreKit product IDs requires updating both `client/src/lib/iosProducts.ts` (client-side product list) and `server/routes/iosVerify.ts` (server-side product-to-plan mapping). The March 2026 migration from non-consumable to auto-renewable subscription format is the reference example.

**Receipt compatibility:** Historical receipts from previous product formats remain valid at the Apple verification layer. Server-side mapping must handle both old and new product IDs during transition periods.

---

## 9. Long-Term Engineering Direction

### Enterprise Readiness Direction

The current platform is built on an architecture that is enterprise-extensible without a rebuild:

**Multi-tenancy:** `organizations` table and `OrgContext` system are implemented. Studio-scoped data isolation is operational. Institution-level tenancy (parent org over multiple studios) requires schema extension and enforcement layer additions — the data model foundation exists.

**White-label:** Per-organization app name, branding colors, logo assets, custom domain field, and `poweredByVisible` flag are all stored in the `organizations` table and resolved at request time. Front-end CSS injection from `OrgContext` color values and custom domain routing are the remaining implementation items.

**Audit trail:** The audit log system (`auditLog.ts`) is already designed to HIPAA audit trail standards — action types, actor/target separation, PHI-excluded metadata. Formal HIPAA compliance requires additional policy and procedural work, not significant technical additions.

**SSO/SAML:** Session management (`connect-pg-simple`) and auth middleware (`requireAuth`) are cleanly separable from identity source. SAML token-to-session mapping can be introduced at the auth layer without restructuring downstream route handling.

### White-Label Scaling Direction

The `OrgContext` resolver (`loadOrgContext()`, `loadOrgBySlug()`) already handles the per-request organization resolution. Scaling white-label support involves:
1. Front-end CSS variable injection from `OrgContext.primaryColor` / `secondaryColor` at the `RootViewport` level
2. Custom domain → organization slug routing in the Express layer (before session middleware)
3. Organization-level feature flag enforcement at the middleware layer (using `OrgContext.featureFlags`)
4. Institutional admin role with cross-studio read access scoped to `orgId`

All four extensions attach to existing infrastructure. No new architectural layer is required.

### Infrastructure Scaling Goals

**Horizontal scaling:** The Express application is stateless at the application layer. Session state in PostgreSQL (`connect-pg-simple`) allows multiple instances without shared memory. Redis-backed session store is the upgrade path for higher session throughput.

**Database scaling:**
- Read replicas for analytics and reporting queries (Drizzle ORM allows explicit replica routing)
- Table partitioning for high-volume tables (`aiUsage`, `auditLog`, `macroLogs`) by date
- Connection pooling (PgBouncer or equivalent) for connection count management at scale

**Message queue:** The SMS worker uses BullMQ with Redis. Activating a Redis instance enables full async job queue infrastructure for email, SMS, push, and AI generation — decoupling HTTP response time from processing time for expensive operations.

**Voice processing:** The `VoiceJobWorker` polling pattern (`FOR UPDATE SKIP LOCKED`) supports multiple parallel instances without coordination infrastructure. Worker count scales independently of the web server.

**AI cost scaling:** `COST_MAX_CALLS_PER_USER` and `COST_MAX_CALLS_GLOBAL` are environment variables — spend ceiling adjustments require no deployment. Moving cost tracking from in-memory buckets to database-backed counters would survive process restarts and provide accurate cross-instance limiting.

### Operational Maturity Direction

**Monitoring:** Sentry captures exceptions. The next maturity level is structured metrics (p50/p95/p99 latency per route, AI generation success rate, quota hit rate) in a time-series store (Datadog, Grafana/Prometheus, or equivalent).

**Alerting:** Current alerting is Sentry exception volume. Production alerting should include: `/api/health` response time, AI fallback rate (from `aiTelemetry.ts` fallback reason codes), cost guard trigger rate, and Stripe webhook processing latency.

**Formal HIPAA compliance pathway:**
1. Formal risk assessment documentation
2. Business Associate Agreement (BAA) framework for healthcare partner contracts
3. Incident response procedure documentation
4. Workforce training policy
5. SOC 2 Type II audit (6-month observation period)

The technical infrastructure for HIPAA compliance (audit logging, PHI boundary discipline, role-based access control, encryption in transit) is already substantially implemented. The gap is documentation, process, and formal audit — not technical rework.

**Developer experience:** Pre-push validation (`validate.sh`) and the golden path checklist (`BASELINE_STATUS.md`) are the current regression prevention mechanisms. The next maturity level is automated integration tests that run the golden path programmatically on every PR, providing faster feedback without manual verification overhead.

---

*Document generated from operational codebase, scripts, and engineering artifacts — May 2026.*

*Primary source files: scripts/validate.sh, scripts/install-hooks.sh, docs/agent-rules.md, BASELINE_STATUS.md, CHANGE_LOG.md, LAST_STABLE.md, server/prod.ts, server/index.ts, server/bootstrap/envSetup.ts, server/lib/sentry.ts, server/lib/accessTier.ts, server/services/aiTelemetry.ts, server/services/costGuard.ts, server/services/aiQuotaService.ts, server/services/voiceJobWorker.ts*
