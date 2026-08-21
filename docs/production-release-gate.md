# MPM Production Release Gate — Architecture Proposal

**DEV WORKSPACE — ARCHITECTURE / IMPLEMENTATION PLANNING ONLY**

This system will be designed and implemented in the DEV branch, following the normal
DEV → GitHub → production promotion workflow. Its purpose is to validate the **actual
published production environment**, not merely DEV or the production workspace.

> **The rule:** A release is not successful because it published.
> A release is successful when production acceptance tests pass.

---

## Current State — Honest Audit

Before designing, here is what already exists and what each piece actually does.

| Artifact | Where it runs | What it tests | Gap |
|---|---|---|---|
| `/api/health` | localhost / any URL | Returns `{ ok: true, version: "1.0.0" }` | No git SHA, no bucket ID, no env tag, hardcoded version string |
| `/api/health/ai` | localhost | AI generation success/fallback metrics | Doesn't test production infra identity |
| `release-manifest.json` | client bundle | `{ "version": "<timestamp>" }` | No SHA, no environment, no bucket binding |
| `scripts/release-check.sh` | **localhost only** | TypeScript build + HTTP status codes | Never touches `app.myperfectmeals.com` |
| `scripts/smoke-test.ts` | **dev workspace URL (hardcoded)** | Auth, affiliate, ProCare, meals | Hardcoded to dev URL + dev DB tokens. Cannot run against production. |
| `scripts/preflight.sh` | Accepts a URL arg | Build + health + AI generation | Manual only; never automated after publish |
| `scripts/pre-publish-check.sh` | localhost | Git status, TypeScript, port check | Stops before publish; nothing runs after |
| `scripts/cut-release.js` | Local | Writes release notes to manifest | No SHA, no environment, no bucket |

**Conclusion:** Every current check runs before or during publish, against localhost or
the dev workspace. Zero checks run automatically against `app.myperfectmeals.com` after
a publish completes. That is the structural gap this incident exposed.

---

## Architecture — Four Stages

```
DEV workspace
  └── Gate 0: Pre-commit checks (already largely exists, needs strengthening)
        │
        ▼
  GitHub dev → merge → production branch
        │
        ▼
  Production workspace pulls production branch
  └── Gate 1: Pre-publish configuration validation
        │
        ▼
  User clicks Publish → Replit builds + deploys
        │
        ▼
  Gate 2: Post-publish production acceptance tests
    (hit app.myperfectmeals.com — not workspace, not localhost)
        │
        ▼
  Gate 3: Continuous synthetic monitoring
    (periodic checks continue after release declared healthy)
```

---

## Gate 0 — Pre-Commit / Pre-Publish (DEV)

**Purpose:** Catch code-level issues before anything reaches production.

**What already exists:** TypeScript check, build, git status check, localhost health ping.

**What is missing:**

### 0-A: Release identity baked into the artifact

`release-manifest.json` must be extended at build time to include:

```json
{
  "version": "1787190721132",
  "releaseId": "2026-08-21-1",
  "gitSha": "a83f5d2c",
  "buildTimestamp": "2026-08-21T14:30:00Z",
  "environment": "production",
  "storageBucketId": "replit-objstore-3ccef2ce-...",
  "notes": ["What changed for users"]
}
```

`scripts/update-version.js` already runs during build — extend it to also write
`gitSha` (via `git rev-parse --short HEAD`), `buildTimestamp`, and `environment`
(from `NODE_ENV`). The `storageBucketId` comes from the `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
secret at build time.

**Why git SHA matters:** After publishing, the first thing the post-deploy gate does
is read `/api/release` from `app.myperfectmeals.com` and confirm the SHA matches
the commit that was just promoted. This closes the "I think production has the fix"
loop permanently.

### 0-B: `/api/release` endpoint (replaces the weak `/api/health`)

A new endpoint — public, read-only, zero auth required — that the acceptance gate
and monitoring system can call:

```json
GET /api/release

{
  "environment": "production",
  "gitSha": "a83f5d2c",
  "releaseId": "2026-08-21-1",
  "buildTimestamp": "2026-08-21T14:30:00Z",
  "apiOrigin": "app.myperfectmeals.com",
  "storageBucketId": "replit-objstore-3ccef2ce-...",
  "nodeVersion": "22.x"
}
```

This endpoint reads from the baked-in release manifest (static file, never DB) so
it answers even when the database is down. It is the production deployment's identity
card.

---

## Gate 1 — Pre-Publish Configuration Validation (Production Workspace)

**Purpose:** Before the user clicks Publish, verify that production's configuration
is correct. Catches the class of bug this incident exposed — wrong bucket ID, missing
secrets — before the deployment goes live.

**What already exists:** Nothing systematic. `preflight.sh` exists but is manual.

**New: `scripts/pre-publish-validate.sh`** — automated, must pass before publish.

```
Checks:
  ✅ DEFAULT_OBJECT_STORAGE_BUCKET_ID is set and non-empty
  ✅ DEFAULT_OBJECT_STORAGE_BUCKET_ID does NOT match the dev bucket ID
       (hard-coded known dev bucket: replit-objstore-2a68d585-...)
  ✅ DATABASE_URL is set
  ✅ DATABASE_URL does NOT contain "dev" or the dev workspace hostname
  ✅ OPENAI_API_KEY is set
  ✅ SESSION_SECRET is set
  ✅ STRIPE_SECRET_KEY is set
  ✅ NODE_ENV == "production"
  ✅ Storage bucket is reachable (lightweight GET on a known stable object key)
  ✅ Database is reachable (lightweight SELECT 1)
  ✅ TypeScript build passes
  ✅ Client build passes
  ✅ No references to *.replit.dev in the compiled client bundle
  ✅ No references to the dev workspace URL in the compiled server bundle
```

The dev-bucket and dev-URL checks are regression tests for exactly this incident.
They run on the production workspace before every publish.

---

## Gate 2 — Post-Publish Production Acceptance Tests

**This is the missing stage.** These tests run after publish completes, against
`app.myperfectmeals.com`. They are the last gate before a release is declared healthy.

### Implementation approach

**New file:** `scripts/prod-acceptance-test.sh` (and `scripts/prod-acceptance-test.ts`
for the authenticated journeys that need a real session)

**Target:** Always `app.myperfectmeals.com` (canonical domain), never configurable
away from this. A separate pass verifies `app.myperfectmeals.ai` redirects or serves
identically.

**New file:** `scripts/run-prod-acceptance.sh` — the single command to run after every publish.
Documents the required step: *"publish is not done until this passes."*

### Gate 2-A: Release identity verification

```bash
SHA=$(git rev-parse --short HEAD)
RELEASE=$(curl -sf https://app.myperfectmeals.com/api/release)

# Confirm the live site is running the commit we just promoted
LIVE_SHA=$(echo $RELEASE | jq -r .gitSha)
if [ "$LIVE_SHA" != "$SHA" ]; then
  FAIL "Production is serving SHA $LIVE_SHA but we deployed $SHA"
fi

# Confirm the correct storage bucket
LIVE_BUCKET=$(echo $RELEASE | jq -r .storageBucketId)
EXPECTED_BUCKET="replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491"
if [ "$LIVE_BUCKET" != "$EXPECTED_BUCKET" ]; then
  FAIL "Production bucket mismatch: got $LIVE_BUCKET"
fi

# Confirm environment tag
LIVE_ENV=$(echo $RELEASE | jq -r .environment)
if [ "$LIVE_ENV" != "production" ]; then
  FAIL "apiOrigin reports environment=$LIVE_ENV — not production"
fi
```

### Gate 2-B: Infrastructure health

New endpoint: `GET /api/health/full` — authenticated with an internal header token
(not public). Returns per-system status:

```json
{
  "application": "healthy",
  "database": "healthy",
  "objectStorage": "healthy",
  "storageBucketId": "replit-objstore-3ccef2ce-...",
  "openai": "configured",
  "auth": "healthy",
  "release": "current"
}
```

Each check is real: DB does `SELECT 1`, storage does `GET` on a known permanent
object (the `migration-manifest.json` already in the bucket is a good canary),
OpenAI checks key is non-empty + valid format, auth checks the session service.

The acceptance gate calls this and fails the release if any subsystem is not healthy.

### Gate 2-C: Environment isolation check

```bash
# Scan the live HTML/JS bundle for any reference to dev infrastructure
BUNDLE=$(curl -sf https://app.myperfectmeals.com/)
if echo "$BUNDLE" | grep -q "replit.dev\|spock.replit\|my-perfect-meals-npm-dev"; then
  FAIL "Production HTML/bundle references DEV URLs — environment isolation broken"
fi

# Confirm /api/release.apiOrigin is the production domain
ORIGIN=$(curl -sf https://app.myperfectmeals.com/api/release | jq -r .apiOrigin)
if [ "$ORIGIN" != "app.myperfectmeals.com" ]; then
  FAIL "apiOrigin=$ORIGIN — production app thinks it is running on a different host"
fi
```

### Gate 2-D: Authenticated critical-journey smoke tests

These require the **Production QA Account** (see below). The test runner uses that
account's credentials, not a real user.

**Journey tests (in order of risk):**

| # | Journey | Method | Pass condition |
|---|---|---|---|
| 1 | App loads | `GET /` | HTTP 200, HTML contains app root |
| 2 | Auth — valid session | `GET /api/auth/session` with QA token | HTTP 200, user object present |
| 3 | Auth — invalid token | Same with bad token | HTTP 401 |
| 4 | Profile loads | `GET /api/user/profile` | HTTP 200, expected QA user fields present |
| 5 | Saved meals | `GET /api/saved-meals` | HTTP 200, array (may be empty) |
| 6 | Weekly board | `GET /api/weekly-board?week=<current>` | HTTP 200 |
| 7 | Meal generation gate | `POST /api/meals/generate` (unauthenticated) | HTTP 401 — confirms auth wall up |
| 8 | Object Storage canary | `GET /public-objects/<prod-bucket>/<canary-key>` | HTTP 200, Content-Type image/* |
| 9 | Image delivery | Known permanent image URL from QA saved meal | HTTP 200, Content-Type image/* |
| 10 | ProCare gate | `GET /api/pro/clients` (QA non-pro account) | HTTP 403 or 401 — confirms tier gate |
| 11 | Domain alias | `GET https://app.myperfectmeals.ai/api/release` | Same gitSha as .com |
| 12 | Shopping list | `GET /api/shopping-list` with QA token | HTTP 200 |
| 13 | Macro targets | `GET /api/users/<qa-id>/macro-targets` with QA token | HTTP 200, numeric values present |
| 14 | Nutrition prescription | `GET /api/prescription/<today>` with QA token | HTTP 200 or 404 (not 500) |

Journeys 1–10 are **P0** — must pass before release is declared healthy.
Journeys 11–14 are **P1** — must pass before wider pilot onboarding.

**One full meal-generation test per day** (not every release — too expensive). This
runs on a schedule via the monitoring system, not the acceptance gate.

### Gate 2-E: Domain relationship

**Diagnosis first (no change yet):**

Run `curl -I https://app.myperfectmeals.ai/api/release` and compare the `gitSha`
to `app.myperfectmeals.com`. If they differ, the two domains are serving different
deployments — that is a critical configuration error.

**Recommended resolution:** Choose one canonical domain.

- **Canonical:** `app.myperfectmeals.com`
- **Alias:** `app.myperfectmeals.ai`

The alias either 301-redirects to `.com` (cleanest — one deployment to verify) or
is explicitly configured to point to the same Replit deployment (both pass Gate 2-A
with identical SHAs). Do not maintain two independent deployments for the same
application — that creates permanent divergence risk.

The acceptance gate enforces this: if `.ai` SHA ≠ `.com` SHA, Gate 2-A fails.

---

## Gate 3 — Continuous Production Monitoring

**Purpose:** A release passing acceptance tests at T+0 doesn't mean production stays
healthy at T+6 hours. Monitoring catches degradations that aren't caused by a deploy.

### What to monitor (lightweight, not expensive)

| Check | Frequency | Failure action |
|---|---|---|
| `GET /api/release` → 200 | Every 5 min | Alert immediately |
| `GET /api/health/full` → all healthy | Every 5 min | Alert immediately |
| Known permanent image URL → 200 | Every 5 min | Alert immediately — this is the image incident detector |
| Auth gate → 401 on unauth request | Every 10 min | Alert immediately |
| Weekly board → 200 with auth | Every 15 min | Alert |
| Full synthetic meal generation (QA account) | Once daily | Alert if fails |

**Storage canary object:** `migration-manifest.json` is already in the production
bucket, is a known stable object, and its GET response time is a reliable indicator
of Object Storage health. Use it as the permanent storage health probe. No need to
generate or delete anything.

### Alert channels

Minimum viable: email to a dedicated ops address that you monitor. Do not route to
personal email that may have filters.

Nice-to-have: Slack webhook or SMS for P0 failures (storage down, auth wall broken).

### Implementation on Replit

Replit's `scheduled` deployment type can run a Node.js health-check script on a
cron schedule. This is a separate scheduled deployment that probes the main
autoscale deployment. It has no user-facing surface.

Alternatively, a lightweight external monitor (Better Uptime, Freshping, or similar
— many have free tiers) can probe the public endpoints and alert on failures. This
has the advantage of not depending on Replit availability to detect Replit failures.

**Recommendation:** Use both. The internal scheduled checker tests authenticated
routes. The external monitor tests public availability. Neither can do what the
other does.

---

## Production QA Account

**Purpose:** Authenticated smoke tests against production without touching real user
data or triggering billing events.

**Design:**

- Email: `qa-automation@myperfectmeals.com` (or similar non-customer address)
- Created in the production database via a one-time setup script
- Known profile: specific diet type, no clinical conditions, no ProCare membership
- Subscription: exactly one known tier (e.g. Basic) so tier-gate tests are predictable
- Saved meals: 3–5 permanent saved meals with known image URLs (uploaded once, never deleted)
- Auth token: long-lived auth token stored as a production secret (`QA_AUTOMATION_TOKEN`)

**Rules:**
- This account is never logged into manually
- Its saved meals are never modified by production tests — tests only read
- If a test needs to write (e.g. save a meal), it cleans up after itself in the same test run
- The account's profile fields are documented as constants in the acceptance test script

**The account's known image URL** becomes the storage canary for Gate 2-D journey
test #9 and for Gate 3 monitoring.

---

## Rollback Design

**Current state:** Replit Checkpoints provide the rollback mechanism. No structured
rollback procedure exists.

**Proposed procedure (no new tooling required at P0):**

1. Gate 2 fails after publish
2. Immediately post a status note: "Release candidate failed acceptance — reverting"
3. In the production workspace: open Checkpoints, roll back to the last known-good
   checkpoint (the one taken before this publish)
4. Verify rollback by re-running `scripts/run-prod-acceptance.sh` against `app.myperfectmeals.com`
5. Record: which release failed, which tests failed, what the rollback checkpoint was

**Documentation required:** A `ROLLBACK.md` file that contains exactly these steps,
including the command to re-run acceptance tests. No one should have to think under
pressure.

**Longer term (P2):** Replit's autoscale deployment type does not natively support
blue/green or instant rollback — a rollback requires re-publishing from a previous
checkpoint or git tag. The fastest path to one-click rollback on this platform is
maintaining a `last-known-good` git tag that the production workspace can rebuild
from on demand.

---

## Database Migrations — Remove from Boot

**Current state:** `server/prod.ts` runs `ALTER TABLE IF NOT EXISTS` statements
during every startup, inline, before the server accepts traffic. This is:

1. **Slow** — adds latency to every cold start
2. **Dangerous** — a failed migration on a new deploy leaves the server in an
   undefined state with no clean rollback
3. **Non-auditable** — no record of which migration ran on which deployment

**Proposed change (P0):**

Separate migrations from startup. Migrations run once, explicitly, before a
publish — not during server boot.

```
New workflow:
  1. Run migrations: node scripts/run-migrations.ts --env production
  2. Verify migrations: node scripts/verify-schema.ts --env production
  3. Publish (server boots with schema already correct)
```

The server boot process (`prod.ts`) removes all `ALTER TABLE` calls. It runs
`SELECT 1` to confirm DB connectivity and exits non-zero if DB is unreachable.
It does not modify schema.

This is a structural change. It requires a transition period where the existing
boot migrations are extracted into versioned migration files first.

---

## Prioritized Recommendations

### P0 — Required immediately (before next production release)

| # | Item | What it prevents | Effort |
|---|---|---|---|
| P0-1 | `GET /api/release` endpoint with git SHA + bucket ID | "I think production has the fix" — replaces guessing | 1–2 hours |
| P0-2 | Build-time SHA injection into release-manifest.json | Release identity travels with the artifact | 30 min |
| P0-3 | `scripts/pre-publish-validate.sh` with dev-bucket check | Exact class of bug that caused this incident | 2–3 hours |
| P0-4 | `GET /api/health/full` — per-system status including storage | Detects the image outage before users do | 2–3 hours |
| P0-5 | `scripts/run-prod-acceptance.sh` — post-publish gate (unauthenticated journeys) | Release declared done without production verification | 2–3 hours |
| P0-6 | Storage canary probe (known object in prod bucket, every 5 min) | Images go down undetected for hours | 1 hour |
| P0-7 | `ROLLBACK.md` — documented rollback procedure | Recovery improvised under pressure | 30 min |
| P0-8 | Domain alias check (`.ai` SHA == `.com` SHA) | Two domains serving different code undetected | 1 hour |

### P1 — Required before wider pilot onboarding

| # | Item | What it prevents | Effort |
|---|---|---|---|
| P1-1 | Production QA account + `QA_AUTOMATION_TOKEN` secret | Authenticated smoke tests require a real user | 2 hours |
| P1-2 | Authenticated journey tests (Gate 2-D, journeys 1–10) | Finding broken auth/profile/meals/images after publish | 4–6 hours |
| P1-3 | Bundle isolation check (no dev URLs in prod bundle) | Environment contamination class of bugs | 1–2 hours |
| P1-4 | External uptime monitor (Better Uptime or similar) | Replit outage not detected because monitor is on Replit | 1 hour (config only) |
| P1-5 | Migrate boot-time DB migrations to explicit pre-publish step | Startup failures from migration errors | 4–8 hours |
| P1-6 | Alert routing for P0 monitoring failures | Discovering incidents from user reports | 1–2 hours |
| P1-7 | `RELEASE_AUDIT.md` — record of every production release | No history of what was deployed when | 30 min (template + discipline) |

### P2 — Scaling / reliability maturity

| # | Item | Notes |
|---|---|---|
| P2-1 | Full synthetic meal-generation test (daily, QA account) | Expensive (DALL-E); daily is enough |
| P2-2 | One-click rollback via `last-known-good` git tag | Requires git tag discipline on every healthy release |
| P2-3 | Scheduled deployment for continuous monitoring | Replit-native; replaces any external monitor over time |
| P2-4 | ProCare and clinical endpoint journey tests | Requires QA account with ProCare permissions |
| P2-5 | Release diff report (what changed between this SHA and last healthy SHA) | Narrows the blast radius of a failed release |
| P2-6 | Structured incident log with RCA template | Currently informal; needs a home |

---

## What Replit Supports vs. What Needs External Services

| Requirement | Replit-native? | Notes |
|---|---|---|
| Post-publish acceptance tests (run script after publish) | ⚠️ Manual only | Replit has no "post-deploy webhook" hook. The acceptance test is run manually from the production workspace after publish, or triggered by a GitHub Action on the `production` branch merge. GitHub Actions is the recommended automation layer. |
| Scheduled monitoring probes | ✅ Yes | `scheduled` deployment type runs a Node.js script on cron. Perfect for the monitoring checker. |
| Rollback | ✅ Yes (Checkpoints) | Manual, but reliable. No one-click automation yet. |
| Environment secrets (QA_AUTOMATION_TOKEN, etc.) | ✅ Yes | Replit Secrets handles this natively. |
| External uptime monitoring | ❌ No | Better Uptime, Freshping, or UptimeRobot (free tier sufficient at this scale). |
| Build artifacts with git SHA | ✅ Yes | `git rev-parse --short HEAD` works in the Replit build environment. |
| Blue/green deployment | ❌ No | Not available on Replit autoscale. Rollback = checkpoint restore + republish. |
| Email/SMS alerting | ❌ No | Must be external (Better Uptime handles this, or a small Resend-based alert script). |

**Conclusion on Replit suitability:** The platform supports everything needed for
P0 and P1. The two genuine gaps (post-deploy webhook automation and external uptime
monitoring) are solved by GitHub Actions and Better Uptime respectively — neither
requires migrating off Replit. Do not migrate the platform. Add the release
engineering layer.

---

## What This Looks Like When Complete

```
DEV workspace
  ├── git commit (SHA: a83f5d2)
  ├── scripts/pre-publish-validate.sh → PASSES
  │     ✅ Bucket ID is production bucket
  │     ✅ No dev URLs in bundle
  │     ✅ NODE_ENV = production
  │     ✅ Storage reachable
  │     ✅ DB reachable
  ├── User clicks Publish
  ├── Replit builds + deploys
  └── scripts/run-prod-acceptance.sh → PASSES
        ✅ SHA matches: a83f5d2
        ✅ Bucket: 3ccef2ce (production)
        ✅ Environment: production
        ✅ Storage canary: 200 OK
        ✅ Auth gate: 401 on unauth
        ✅ Profile: 200 OK
        ✅ Saved meals: 200 OK
        ✅ Known image URL: 200 OK
        ✅ .ai alias SHA matches .com
        ─────────────────────────────
        RELEASE DECLARED HEALTHY: 2026-08-21-1

Then every 5 minutes:
  ✅ /api/release → 200
  ✅ /api/health/full → all healthy
  ✅ Storage canary → 200
```

Instead of:

```
User clicks Publish.
Idrise opens the app.
Idrise clicks around.
Idrise says "looks good."
Release done.
```

---

## Next Step

Approve this architecture. Then implementation begins with the P0 items in order:

1. **P0-1 + P0-2** — Release identity (`/api/release` + SHA in build manifest) — foundation everything else depends on
2. **P0-3** — `pre-publish-validate.sh` — the specific regression test for this incident
3. **P0-4** — `/api/health/full` — per-system health endpoint
4. **P0-5 + P0-8** — `run-prod-acceptance.sh` — the post-publish gate
5. **P0-6** — Storage canary monitoring
6. **P0-7** — `ROLLBACK.md`

No changes to production until P0 is implemented in DEV and promoted through
the normal DEV → GitHub → production workflow.
