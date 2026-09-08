# MyPerfectMeals — Infrastructure & Security Runbook

**Version:** 1.0  
**Status:** Active  
**Effective:** 2026-05-22  
**Owner:** Engineering  
**Review cadence:** Quarterly, after every production incident, and before any enterprise partner onboarding

---

## Purpose

This document defines MPM's operational security posture: how infrastructure is configured, how secrets are managed, how production deployments work, what data retention policies are enforced, and what procedures exist for incidents. It answers the questions on enterprise security questionnaires and serves as the engineering team's operational reference.

---

## 1. Environments

| Environment | Hosting | Purpose | Real PHI? |
|---|---|---|---|
| **Development** | Replit (shared workspace) | Active development, feature work | No — test data only |
| **Staging** | Replit (when needed) | Pre-release validation | No — test data only |
| **Production** | Provider/configuration not inspected by U8/U9 | Live user traffic | Production data classification requires current operational evidence |

### Environment Separation Policy

- Development and staging environments must **never** contain real patient data
- `NODE_ENV` controls behavior for logging, caching, and dev-only routes
- Dev-only routes (mounted under `/admin` in development entry) are **not mounted** in `server/prod.ts`
- `BILLING_ENFORCED` is the master paywall switch — unset in dev, `"true"` in production
- `MPM_TESTER_EMAILS` is empty in production post-launch; populated for designated testers only

### Production Hosting Evidence Gap (Known)

The repository contains Replit deployment configuration, but U8/U9 did not
inspect the active Production deployment, geography, account tier, or
contractual coverage. Replit BAA availability for the applicable account and
service must be confirmed externally. UTHSC and legal/compliance must determine
whether the evidenced hosting posture is acceptable; this runbook does not
prescribe a provider migration without that determination.

The application is migration-ready: `server/prod.ts` is the standalone production entry point with no Replit-specific dependencies.

---

## 2. Authentication & Session Security

### Password Storage
- All passwords hashed with **bcrypt** (cost factor 10) via `bcryptjs`
- Plain-text passwords are never stored, logged, or returned in API responses

### Auth Token
- Each authenticated session uses a **64-character hex token** (32 random bytes via `crypto.randomBytes`)
- Token is stored in `users.auth_token` (nullable); invalidated on logout by setting to `null`
- Token creation timestamp stored in `users.auth_token_created_at`
- Clients send token in `X-Auth-Token` header on every request
- `requireAuth` middleware validates token via DB lookup on each request

### Session Cookie
- Express session cookie set as a fallback for mobile compatibility
- Protected by `SESSION_SECRET` environment variable (must be set in production)
- Session is destroyed on logout alongside token invalidation

### Token Security Rules
- `auth_token` and `reset_token` are **never** returned in API responses after initial issuance
- Neither field is included in audit log entries
- Never log auth token values in any log line

### Password Reset
- Reset tokens generated the same way as auth tokens (32 random bytes)
- Reset tokens have limited validity (implementation in `server/routes/auth.session.ts`)

---

## 3. Secrets Management

### Current Approach
Application secrets are supplied through **Replit environment variables** and
must never be committed to source control. Replit documents encryption for its
secrets service generally; effective Production access policy and
account-specific configuration remain external evidence.

### Required Secrets (Production)

| Secret | Purpose | Rotation Trigger |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Any DB credential change |
| `SESSION_SECRET` | Express session signing | Annually or on suspected compromise |
| `OPENAI_API_KEY` | AI generation | Annually or on suspected compromise |
| `STRIPE_SECRET_KEY` | Payment processing | Per Stripe recommendation |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | On webhook endpoint change |
| `RESEND_API_KEY` | Transactional email | Annually |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS | Annually |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Push notifications | On VAPID key rotation |
| `SENTRY_DSN` | Error monitoring | On Sentry project change |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 object storage | Annually or on IAM policy change |
| `ELEVENLABS_API_KEY` | TTS voice | Annually |

### Rotation Procedure
1. Generate new secret in the vendor's console
2. Add new secret to Replit environment variables (do not remove old one yet)
3. Deploy and verify the new secret is working
4. Remove the old secret
5. Document rotation date in this table

### What Is Never A Secret
- `BILLING_ENFORCED` — operational flag, not sensitive
- `MPM_TESTER_EMAILS` — operational list, not sensitive
- `NODE_ENV` — environment label, not sensitive

---

## 4. Database

### Provider
The application uses PostgreSQL through `DATABASE_URL` and contains
Neon-specific configuration. U8/U9 did not inspect Production, so the active
Production database provider is **UNKNOWN** pending external evidence.

### Connection Security
- Application runtime pools and production-capable PostgreSQL scripts use the
  shared certificate-verifying TLS policy for Neon and TLS-requesting URLs
- SSL warning on `prefer`/`require` modes — production should use `sslmode=verify-full`
- Connection string never logged; never appears in error messages

### Encryption at Rest
- Production database encryption at rest is **UNKNOWN** and requires
  project-specific provider/configuration evidence

### Access Control
- Production network exposure, private networking, firewall rules, and
  developer access policy are **UNKNOWN** pending Production/provider evidence
- Drizzle ORM is used for all queries — no raw string concatenation SQL

### Migrations
- Schema migrations run via `tsx scripts/migrate_*.ts` from the workspace
- Migration scripts are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
- Never run migrations against production without a prior staging test

### BAA Status
Database-provider identity, BAA availability, and executed-agreement status
require external/provider confirmation.

---

## 5. Data Storage (Object Storage)

### Providers in Use
- **AWS S3** (`server/lib/s3.ts`) — image uploads, meal images
- **Replit Object Storage** (`server/replit_integrations/object_storage/`) — user uploads via GCS backend

### Encryption
- Effective Production encryption, key management, region, versioning, and
  lifecycle settings are **UNKNOWN** pending project-specific provider evidence

### Access Control
- Profile photos and user-uploaded content: review `ACL: "public-read"` in `presignUpload()` — this should be `private` for any health-related uploads; only meal images intended for public sharing should be `public-read`
- Presigned URLs are time-limited (default 5 minutes for uploads)
- Object ACL policy system (`server/objectAcl.ts`) controls per-object access

### BAA Status
Storage-provider BAA availability and executed-agreement status require
external/provider confirmation.

---

## 6. Audit Log

### Schema
Table: `audit_log` (created via `scripts/migrate_audit_log.ts`)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Unique event identifier |
| `actor_user_id` | text | Who performed the action |
| `target_user_id` | text | Whose data was accessed |
| `org_id` | text | Tenant context |
| `action` | text | Event type (see below) |
| `resource_type` | text | What category of resource |
| `resource_id` | text | Specific resource ID |
| `table_name` | text | DB table involved |
| `field_name` | text | Specific field (T1 writes only) |
| `route` | text | API route or generator name |
| `ip_address` | text | Client IP |
| `meta` | jsonb | Non-PHI contextual flags |
| `created_at` | timestamp | Event timestamp |

### Indexed columns
- `actor_user_id + created_at` — actor timeline queries
- `target_user_id + created_at` — subject access requests
- `org_id + created_at` — tenant-level audit views
- `action + created_at` — event-type filtering

### Audit Actions

| Action | Trigger |
|---|---|
| `AUTH_LOGIN` | Successful password authentication |
| `AUTH_SIGNUP` | New user account created |
| `AUTH_LOGOUT` | Token invalidated on logout |
| `ORG_VIOLATION` | Cross-org access attempt blocked |
| `READ` | T1 Clinical PHI read by a professional |
| `WRITE` | T1/T2 PHI written by a professional |
| `AI_PROMPT_PHI` | T1/T2 field categories included in AI generation context |

### Retention Policy
**6 years minimum** per HIPAA § 164.530(j) requirement.

The `audit_log` table has no automatic purge. Retention enforcement:
- Year 1–2: hot storage (primary database)
- Year 2+: archive strategy TBD (compress to cold storage; maintain queryability for audit)
- Deletion requires documented approval; records may not be deleted to cover up incidents

### PHI Rules for Audit Log
- Field **values** are never stored — only field names
- `auth_token`, `reset_token`, `password` never appear in any log entry
- Email addresses in meta use masked form or are omitted
- `client_notes.body` content never logged — only entry ID

---

## 7. Error Monitoring (Sentry)

**Provider:** Sentry  
**Integration:** `server/lib/sentry.ts`, `client/src/lib/sentry.ts`

### Current Configuration
- Sentry DSN stored in `SENTRY_DSN` (server) and `VITE_SENTRY_DSN` (client)
- Initialized at startup: `[Sentry] ✅ Initialized — env: development`

### Application Scrubbing Boundary
- Server and client initialization set `sendDefaultPii: false`
- Shared `beforeSend` and `beforeBreadcrumb` processing strips request content,
  user data, query strings, fragments, and sensitive values to a bounded
  diagnostic allowlist
- Client replay masks text and blocks media
- `server/tests/sentryScrubber.test.ts` verifies the application scrubber

This is repository/application evidence only. Production Sentry project
configuration, retention, region, access policy, and contractual/BAA status
remain **NEEDS EXTERNAL/PROVIDER CONFIRMATION**.

---

## 8. Production Deployment Procedure

### Normal Deployment
1. All changes go through the development environment first
2. Confirm server starts cleanly (`🚀 Server running on 0.0.0.0:5000`)
3. Confirm no TypeScript errors in server files
4. Deploy via Replit Deployments console
5. Verify production health endpoint responds: `GET /api/health`
6. Monitor Sentry for error spike in first 10 minutes

### Database Migration Deployment
1. Run migration script against development database first
2. Verify migration is idempotent (safe to re-run)
3. Deploy application code
4. On production, run migration script via `tsx scripts/migrate_*.ts`
5. Verify table/index existence before confirming complete

### Production Environment Variable Changes
1. Never remove a variable without first deploying code that no longer references it
2. Add new variable, deploy, then remove old variable if replacing
3. Document change in this runbook's change log

### Rollback Procedure
1. Replit maintains deployment history — roll back to previous deployment via console
2. If schema migration was applied: assess whether rollback is safe (most migrations are additive and do not require rollback)
3. For data corruption incidents: contact Neon support for point-in-time recovery

### Known Startup Issues
- `npm run dev` previously contained `pkill -f 'tsx server/index'` which caused self-termination — **removed** (2026-05-22)
- Workflow command uses `rm -rf node_modules/.vite` to prevent Vite cache corruption on startup

---

## 9. Incident Response

### Classification

| Level | Description | Response Time |
|---|---|---|
| P0 | PHI breach or suspected unauthorized PHI access | Immediate — within 1 hour |
| P1 | Production down; auth system failure; data corruption | Within 4 hours |
| P2 | Performance degradation; partial service failure | Within 24 hours |
| P3 | Non-critical bug; cosmetic issue | Next sprint |

### PHI Breach Response (P0)
Under HIPAA Breach Notification Rule (45 CFR §§ 164.400-414):

1. **Contain:** Immediately rotate affected credentials; block affected access paths
2. **Assess:** Query `audit_log` to determine scope — which records were accessed, by whom, when
3. **Document:** Preserve all logs; do not delete anything
4. **Notify:** If breach involves 500+ records or unsecured PHI — notify HHS within 60 days; notify affected individuals without unreasonable delay
5. **Review:** Post-incident analysis; update controls

### Audit Log Query for Incident Assessment
```sql
-- All actions by a suspected actor in the last 30 days
SELECT * FROM audit_log
WHERE actor_user_id = '<userId>'
AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- All org violations in the last 7 days
SELECT * FROM audit_log
WHERE action = 'ORG_VIOLATION'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- All T1 PHI reads for a specific target user
SELECT * FROM audit_log
WHERE target_user_id = '<userId>'
AND action = 'READ'
ORDER BY created_at DESC;
```

---

## 10. Security Checklist (Pre-Enterprise Launch)

| Item | Status | Notes |
|---|---|---|
| Passwords hashed (bcrypt) | ✅ Done | Cost factor 10 |
| Auth tokens: random 32-byte hex | ✅ Done | Invalidated on logout |
| Auth tokens never in logs | ✅ Done | Policy enforced |
| Protected-route authentication and actor binding | 🔶 Partial | Verified controls exist; U5 retains PARTIAL and policy-dependent route/object classifications |
| Org isolation on all cross-user routes | ✅ Done | Phase 1 + 1B |
| Clinical route gating (physician-only) | ✅ Done | `verifyClinicalAccess` |
| Audit logging (T1/T2 reads + writes) | ✅ Done | Phase 3 |
| AI prompt identifier minimization | 🔶 Partial | Verified for selected flows; no universal boundary covers every OpenAI call site |
| Name removed from AI prompts | ✅ Done | `[anonymous]` in promptBuilder |
| HTTPS / TLS in transit | ✅ Replit platform | Verify on migration to new host |
| Production secrets in env vars | ✅ Done | Never in source control |
| Stripe webhook signature verification | ✅ Done | `stripeWebhook.ts` |
| Dev-only routes not in production | ✅ Done | `server/prod.ts` vs `server/index.ts` |
| `BILLING_ENFORCED` launch switch | ✅ Done | Master paywall control |
| AWS S3 contractual/BAA evidence | ❓ External | Confirm provider availability and executed-account coverage |
| Sentry application scrubbing | ✅ Done | Repository implementation and regression tests verified |
| Sentry provider/contract evidence | ❓ External | Confirm Production settings, retention, region, access, and agreement status |
| Production hosting eligibility | ❓ External / UTHSC | Confirm active provider/configuration and institutional requirements |
| Database provider/BAA evidence | ❓ External | Active provider and agreement status unverified |
| OpenAI contractual or PHI-minimized operating posture | ❓ External / UTHSC | Confirm agreement/configuration or approve a bounded architecture |
| Twilio contractual/BAA evidence | ❓ External | Confirm provider availability and executed-account coverage |
| SendGrid contractual/BAA evidence | ❓ External | Confirm provider availability and executed-account coverage |
| Encryption at rest verified (database, storage) | 🔶 Partial | Requires project-specific Production/provider evidence |
| Backup / point-in-time recovery verified | 🔶 Unverified | Requires project-specific Production/provider evidence |
| Secrets rotation procedure documented | ✅ Done | Section 3 above |
| Role & permission matrix documented | ✅ Done | `docs/role-permission-matrix.md` |
| Vendor / BAA map documented | ✅ Done | `docs/vendor-baa-map.md` |
| PHI boundary documented | ✅ Done | `docs/phi-boundary.md` |

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-22 | v1.0 — Initial security runbook. Covers infrastructure posture as of Phase 4 completion. |
