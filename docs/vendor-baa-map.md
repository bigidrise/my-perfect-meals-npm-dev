# MyPerfectMeals — Vendor & BAA Mapping

**Version:** 1.0  
**Status:** Active  
**Effective:** 2026-05-22  
**Owner:** Engineering / Compliance  
**Review cadence:** Quarterly, or when a new vendor is added

---

## Purpose

This document is the authoritative reference for every third-party vendor that touches MPM user data. It identifies which vendors receive PHI, whether a Business Associate Agreement (BAA) is available, current risk level, and what action is required before enterprise partnerships or HIPAA attestation.

Under HIPAA, any vendor who creates, receives, maintains, or transmits PHI on behalf of a covered entity is a **Business Associate** and must sign a BAA. Vendors without a signed BAA who receive PHI create a reportable violation.

---

## Risk Legend

| Level | Meaning |
|---|---|
| 🔴 CRITICAL | PHI flows to vendor; BAA not available or not signed; must resolve before enterprise launch |
| 🟠 HIGH | PHI may flow; BAA available but not signed, or BAA chain uncertain |
| 🟡 MEDIUM | PHI flows in limited form; BAA available; action required |
| 🟢 LOW | No PHI flows; no BAA required |
| ⚪ N/A | Vendor inactive or PHI flow eliminated by architecture |

---

## Vendor Table

| # | Vendor | Role | PHI Flows? | BAA Available | Risk | Status |
|---|---|---|---|---|---|---|
| 1 | **OpenAI** | AI meal generation, assistant, biometric analysis | **Yes — T1 Clinical** | Enterprise tier only | 🟠 HIGH | No BAA signed |
| 2 | **Neon (PostgreSQL)** | Primary database | **Yes — All tiers** | Verify required | 🔴 CRITICAL | Unverified |
| 3 | **Replit** | Hosting platform | **Yes — All tiers** | Not available (standard) | 🔴 CRITICAL | Structural blocker |
| 4 | **AWS S3** | User image and file storage | **Yes — T2/T3** | Yes (via AWS HIPAA BAA) | 🟠 HIGH | No BAA signed |
| 5 | **Replit Object Storage** | User uploads (via Google Cloud backend) | **Yes — T2/T3** | GCS BAA available; chain through Replit unclear | 🟠 HIGH | Chain unverified |
| 6 | **Sentry** | Error monitoring | **Potentially — T1/T3** | Yes | 🟡 MEDIUM | No BAA signed; PHI in errors unverified |
| 7 | **Resend** | Primary transactional email | **T3 PII (to/from); possibly T2** | Not publicly offered | 🟡 MEDIUM | No BAA; scope PHI in email bodies |
| 8 | **SendGrid** | Legacy/backup email | **T3 PII; possibly T2** | Yes (Twilio-owned; HIPAA eligible) | 🟡 MEDIUM | No BAA signed |
| 9 | **Twilio** | SMS notifications | **T3 PII; possibly T2** | Yes (HIPAA-eligible product tier) | 🟡 MEDIUM | No BAA signed |
| 10 | **ElevenLabs** | Text-to-speech voice output | **Possibly T2** | Not publicly available | 🟡 MEDIUM | No BAA; voice content includes dietary context |
| 11 | **Stripe** | Payment processing | **No PHI — financial only** | Not applicable (PCI-DSS scope) | 🟢 LOW | No action needed |
| 12 | **Google Places API** | Restaurant search | **No PHI — query only** | Not applicable | 🟢 LOW | No action needed |
| 13 | **VAPID / Web Push** | Push notifications | **Possibly T2 (notification content)** | Protocol-level; FCM/APN in delivery chain | 🟡 MEDIUM | Keep notification content generic; no clinical data |
| 14 | **Facebook Graph API** | Community group integration | **No PHI if properly scoped** | Not available | 🟢 LOW | Verify no PHI in payload; keep to content IDs only |
| 15 | **YouTube Data API** | Cooking tutorial fetching | **No PHI — content lookup only** | Not applicable | 🟢 LOW | No action needed |
| 16 | **Redis** | Session cache / job queues | **Potentially T2/T3 when active** | Depends on provider | ⚪ N/A | Currently disabled; assess before re-enabling |

---

## Detailed Entries

---

### 1. OpenAI

**Role:** Powers all AI meal generation (Craving Creator, Chef's Kitchen, Snack Creator, Fridge Rescue, Beverage Creator, Holiday Feast), the conversational assistant, photo-based macro estimation, and biometric analysis prompts.

**PHI exposure:**
- T1 Clinical: medical conditions (diabetes, GLP-1, oncology, renal, cardiac, thyroid), real-time blood glucose, medication names, oncology symptom flags
- T2 Behavioral: macro targets, dietary restrictions, consumption patterns
- T3 PII: previously included user name — **removed by Phase 4 sanitization**

**Phase 4 mitigations applied:**
- `sanitizeIdentifiers()` strips email addresses, phone numbers, and UUID-style IDs from all `ProtocolPromptBlock.combined` strings before any API call
- `profile.name` removed from `buildMealPrompt()` — replaced with `[anonymous]`
- Medical/dietary clinical content still present in prompts by design (required for safety guardrails)

**BAA:**  
Available under OpenAI's Enterprise tier. Standard API does not include BAA coverage. This is the primary gap — all AI generation that involves T1 data requires an enterprise agreement or a restructured approach where PHI is not sent in prompts.

**Risk:** 🟠 HIGH

**Action required:**  
- Option A: Negotiate OpenAI Enterprise agreement with BAA before enterprise launch
- Option B: Architect a PHI-free prompt mode where clinical context is represented as abstract directives only (e.g., "high protein, low glycemic index" instead of "user has diabetes")
- Option B is architecturally cleaner for the long term — does not require per-enterprise vendor negotiation

**Owner:** Engineering + Legal  
**Priority:** P0 before any enterprise HIPAA attestation

---

### 2. Neon (PostgreSQL)

**Role:** Primary production database. Stores all user data across all PHI tiers.

**PHI exposure:** Everything — T1 Clinical, T2 Behavioral, T3 PII, T4 Operational.

**BAA:**  
Neon offers SOC 2 Type II certification. BAA availability depends on account tier. Standard plans likely do not include BAA. Enterprise/dedicated deployments may be available.

**Alternative:** Self-managed PostgreSQL on a HIPAA-eligible cloud provider (AWS RDS, Google Cloud SQL, Azure Database for PostgreSQL — all offer BAA). Migration cost is significant but this is the most defensible path.

**Risk:** 🔴 CRITICAL

**Action required:**  
- Contact Neon for BAA availability on current or upgraded plan
- Document the outcome
- If Neon cannot provide BAA: plan migration timeline to AWS RDS or equivalent

**Owner:** Engineering + Legal  
**Priority:** P0

---

### 3. Replit

**Role:** Application hosting platform. All server code executes here; all network traffic flows through Replit's infrastructure.

**PHI exposure:** All tiers (platform-level — code, memory, network, storage all pass through Replit's systems).

**BAA:** Not available on standard or team plans. Replit is a developer platform, not a HIPAA-eligible hosting provider.

**This is the biggest structural issue for HIPAA attestation.**

Healthcare enterprise partners' security teams will ask: "Where does your application run?" If the answer is "Replit," they will identify the BAA gap immediately.

**Options:**

| Option | Description | Complexity |
|---|---|---|
| A | Stay on Replit for development; deploy production to AWS/GCP/Azure via Replit Deployments to a self-managed instance | Medium |
| B | Migrate production fully to AWS ECS, GCP Cloud Run, or Azure Container Apps | High |
| C | Negotiate Replit Enterprise — evaluate if they offer HIPAA-eligible infrastructure | Low (if available) |

**Near-term position (pre-enterprise):** Use Replit for development and staging. Deploy production to a HIPAA-eligible provider. The existing `server/prod.ts` entry point is already deployment-ready.

**Risk:** 🔴 CRITICAL (production); 🟢 LOW (development/staging if no real PHI)

**Action required:**  
- Define production hosting strategy before first enterprise deal
- Document that development environment never contains real patient data

**Owner:** Engineering + Legal  
**Priority:** P0 (for enterprise readiness; not blocking consumer launch)

---

### 4. AWS S3

**Role:** Object storage for user-uploaded images (profile photos, food photos, ingredient scan images), meal images, and other media.

**PHI exposure:**
- T2: Food photos tied to meal logs (behavioral)
- T3: Profile photos (PII/biometric indicator)
- Potentially T1: Ingredient scan images or lab document uploads if ever added

**BAA:** Available. AWS offers a BAA for S3 as part of their HIPAA-eligible services portfolio. Standard AWS agreement; free to add.

**Risk:** 🟠 HIGH (no BAA signed)

**Action required:**  
- Sign AWS BAA (covered under AWS's standard HIPAA BAA — applies to all eligible services in the account)
- Ensure bucket-level encryption at rest (SSE-S3 or SSE-KMS)
- Verify object ACLs: `public-read` is used in `presignUpload()` — ensure profile photos and any health-adjacent uploads are private-only

**Owner:** Engineering  
**Priority:** P1

---

### 5. Replit Object Storage

**Role:** Used for user uploads accessed through Replit's integrated object storage (backed by Google Cloud Storage via a sidecar endpoint at `http://127.0.0.1:1106`).

**PHI exposure:** Same as AWS S3 — user-uploaded content.

**BAA:** Google Cloud Storage offers a BAA. However, the BAA chain through Replit's integration layer (the sidecar) is unverified — it's unclear whether Replit's integration constitutes a covered sub-processor relationship.

**Risk:** 🟠 HIGH

**Action required:**  
- Consolidate object storage to AWS S3 (BAA signed) or Google Cloud Storage (direct, BAA signed)
- Retire Replit Object Storage for production PHI workloads until the BAA chain is verified

**Owner:** Engineering  
**Priority:** P1

---

### 6. Sentry

**Role:** Error monitoring. Captures exceptions, stack traces, request context, and performance data.

**PHI exposure:**  
Stack traces may include request bodies, response data, or logged variables that contain PHI if an exception occurs mid-generation or mid-route. The risk is subtle but real — a thrown error in an oncology route could capture the patient context in the trace.

**BAA:** Sentry offers a BAA under their Business and Enterprise plans.

**Risk:** 🟡 MEDIUM

**Action required:**  
- Upgrade to Sentry Business/Enterprise and sign BAA
- Configure Sentry `beforeSend` hook to scrub PHI fields from error payloads before transmission:
  - Strip request body fields: `oncologySupportContext`, `medicalConditions`, `glucose*`
  - Strip user-identifiable metadata beyond user ID
- Document the scrubbing configuration

**Owner:** Engineering  
**Priority:** P2

---

### 7. Resend

**Role:** Primary transactional email provider. Used for care team notifications, coaching alerts, invite emails, and account communications.

**PHI exposure:**  
Email `to` addresses are T3 PII. Email body content may include health-adjacent context (e.g., "Your coach has updated your nutrition plan" with a meal plan link). Direct PHI in email bodies should be avoided — email is not a secure channel.

**BAA:** Resend does not publicly offer BAAs. This is a meaningful gap if email bodies ever contain clinical language.

**Risk:** 🟡 MEDIUM

**Action required:**  
- Audit all email templates to confirm no T1/T2 content in email bodies — links only, no health data
- Evaluate migration to SendGrid (Twilio-owned, HIPAA-eligible BAA available) for enterprise tier
- Add `[REDACTED]` policy to any email template that might include condition-specific language

**Owner:** Engineering + Product  
**Priority:** P2

---

### 8. SendGrid

**Role:** Legacy/backup email provider (referenced in codebase; `SENDGRID_API_KEY`).

**PHI exposure:** Same as Resend.

**BAA:** Yes — SendGrid (Twilio-owned) offers a BAA under their HIPAA-eligible tier. This makes SendGrid the better long-term choice over Resend if email BAA coverage is needed.

**Risk:** 🟡 MEDIUM (no BAA signed despite availability)

**Action required:**  
- If BAA-covered email is required: activate SendGrid as primary provider and sign BAA
- Retire Resend for PHI-touching email flows

**Owner:** Engineering  
**Priority:** P2

---

### 9. Twilio (SMS)

**Role:** SMS notifications for coaches, clients, and reminders via `server/services/sms.ts` and `server/smsService.ts`.

**PHI exposure:**  
SMS message content may include health-adjacent language (check-in reminders, coaching messages). SMS is not encrypted in transit (carrier-level) and should not carry T1 content.

**BAA:** Twilio offers a BAA under their HIPAA-eligible product tier (requires a specific agreement).

**Risk:** 🟡 MEDIUM

**Action required:**  
- Contact Twilio to sign BAA under HIPAA-eligible tier
- Audit all SMS templates: no T1 content, no condition names, no medication references in message bodies
- SMS should carry only: name (optional), generic action prompts, and links

**Owner:** Engineering + Legal  
**Priority:** P2

---

### 10. ElevenLabs

**Role:** Text-to-speech for the Chef AI voice assistant and tablet voice features (`server/routes/elevenlabs-config.ts`).

**PHI exposure:**  
Text sent to ElevenLabs for synthesis may include dietary context and meal-specific language (e.g., instructions referencing dietary restrictions). Not T1 by itself, but combined with user identity it approaches T2.

**BAA:** ElevenLabs does not publicly advertise a BAA program. This is a meaningful gap if voice content includes personalized health context.

**Risk:** 🟡 MEDIUM

**Action required:**  
- Review exactly what text is sent to ElevenLabs for synthesis — confirm no T1 field values
- If voice personalization requires health context, evaluate enterprise agreement or architecture change (synthesize generic audio; inject clinical content client-side only)
- Monitor ElevenLabs BAA availability as they mature

**Owner:** Engineering  
**Priority:** P3

---

### 11. Stripe

**Role:** Payment processing, subscription management, webhook fulfillment.

**PHI exposure:** None. Stripe receives billing information (card data, billing address) — covered under PCI-DSS, not HIPAA. No health data flows to Stripe.

**BAA:** Not required.

**Risk:** 🟢 LOW

**Action required:** None from PHI perspective. Ensure Stripe webhook signature verification remains enforced (currently implemented in `stripeWebhook.ts`).

---

### 12. Google Places API

**Role:** Restaurant search and location lookup for restaurant meal generation features.

**PHI exposure:** None. Only location/search queries sent; no user health data included.

**BAA:** Not required.

**Risk:** 🟢 LOW

**Action required:** None.

---

### 13. VAPID / Web Push

**Role:** Browser push notifications for meal reminders, coach alerts, and check-ins. VAPID is a self-hosted signing standard; delivery uses browser vendor infrastructure (Google FCM for Android/Chrome, Apple APNs for Safari/iOS).

**PHI exposure:**  
Push notification payloads may reach FCM/APNs servers. Content should be generic (e.g., "You have a new message from your coach") — never include condition names, lab values, or clinical language.

**BAA:** Google FCM and Apple APNs are not HIPAA BAA signatories for standard developer accounts. Keep notification bodies PHI-free.

**Risk:** 🟡 MEDIUM (if content contains PHI); 🟢 LOW (if content stays generic)

**Action required:**  
- Audit all `pushToUser()` call sites: confirm notification bodies contain no T1 content
- Enforce a policy: push notification body = action + link only. No health data.

**Owner:** Engineering  
**Priority:** P2

---

### 16. Redis

**Role:** Session cache, SMS worker queues, notification queues. Currently disabled in production (`📡 Redis temporarily disabled`).

**PHI exposure:** When active, Redis caches session state and job payloads that may include user IDs and behavioral data (T2/T3).

**BAA:** Depends on provider (Redis Cloud, AWS ElastiCache, Upstash, etc.). AWS ElastiCache is HIPAA-eligible with BAA.

**Risk:** ⚪ N/A (currently disabled)

**Action required:**  
- Before re-enabling Redis: select a HIPAA-eligible provider (AWS ElastiCache preferred)
- Ensure cache keys do not contain PHI values — user IDs only
- Set appropriate TTL and encryption at rest

**Owner:** Engineering  
**Priority:** P3 (when re-enabling Redis)

---

## Summary: Actions by Priority

### P0 — Blocking for enterprise HIPAA attestation

| Action | Vendor | Owner |
|---|---|---|
| Negotiate OpenAI Enterprise BAA **or** redesign prompts to be PHI-free | OpenAI | Engineering + Legal |
| Verify Neon BAA availability; migrate to AWS RDS if unavailable | Neon | Engineering + Legal |
| Define production hosting strategy on HIPAA-eligible infrastructure | Replit | Engineering + Legal |

### P1 — Required before handling real patient data in production

| Action | Vendor | Owner |
|---|---|---|
| Sign AWS HIPAA BAA; verify S3 encryption and ACL posture | AWS S3 | Engineering |
| Consolidate object storage; verify or retire Replit Object Storage for PHI workloads | Replit Object Storage | Engineering |

### P2 — Required before enterprise partner onboarding

| Action | Vendor | Owner |
|---|---|---|
| Sign Sentry BAA; add `beforeSend` PHI scrubbing hook | Sentry | Engineering |
| Audit email templates; migrate to SendGrid (BAA) if PHI touches email | Resend / SendGrid | Engineering + Product |
| Sign Twilio BAA; audit SMS content templates | Twilio | Engineering + Legal |
| Audit push notification content — enforce PHI-free bodies | VAPID / FCM / APNs | Engineering |

### P3 — Before feature expansion

| Action | Vendor | Owner |
|---|---|---|
| Evaluate ElevenLabs BAA; audit voice content for PHI | ElevenLabs | Engineering |
| Select HIPAA-eligible Redis provider before re-enabling | Redis | Engineering |

---

## BAA Status Tracker

| Vendor | BAA Available | BAA Signed | Date | Notes |
|---|---|---|---|---|
| OpenAI | Enterprise only | ❌ No | — | Requires enterprise tier upgrade |
| Neon | TBD | ❌ No | — | Needs verification |
| Replit | ❌ No (standard) | ❌ No | — | Structural — production hosting decision required |
| AWS S3 | ✅ Yes | ❌ No | — | Free; sign via AWS console |
| Replit Object Storage (GCS) | Chain unclear | ❌ No | — | Consolidate first |
| Sentry | ✅ Yes (Business+) | ❌ No | — | Requires plan upgrade |
| Resend | ❌ Not offered | ❌ No | — | Evaluate migration to SendGrid |
| SendGrid | ✅ Yes (HIPAA tier) | ❌ No | — | Preferred email provider for enterprise |
| Twilio | ✅ Yes (HIPAA tier) | ❌ No | — | Requires HIPAA tier agreement |
| ElevenLabs | ❌ Not public | ❌ No | — | Monitor; architect PHI-free voice |
| Stripe | N/A (PCI-DSS) | N/A | — | No action needed |
| Google Places | N/A | N/A | — | No action needed |
| Facebook Graph | N/A | N/A | — | No PHI; no action |
| YouTube Data | N/A | N/A | — | No PHI; no action |
| Redis | Depends on provider | ❌ No | — | Select provider when re-enabling |

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-22 | v1.0 — Initial vendor/BAA map. Covers all active integrations as of Phase 4 completion. |
