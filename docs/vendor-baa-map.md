# MyPerfectMeals — Vendor & BAA Mapping

**Version:** 1.1
**Status:** Active  
**Effective:** 2026-05-22  
**Owner:** Engineering / Compliance  
**Review cadence:** Quarterly, or when a new vendor is added

---

## Purpose

This document inventories third-party vendors that may touch MPM user data and
tracks evidence still required before institutional review. Repository evidence
can establish integration paths and payload categories; it cannot establish the
active Production provider, account tier, current BAA availability, or whether
an agreement is executed.

Legal/compliance and UTHSC must determine which services are Business
Associates and which agreements are required for the intended use. Every BAA
availability/signature entry below is **NEEDS EXTERNAL/PROVIDER CONFIRMATION**
unless supported by a current account-specific agreement.

---

## Risk Legend

| Level | Meaning |
|---|---|
| 🔴 CRITICAL | Potential PHI flow with unresolved provider/contractual evidence; institutional review required |
| 🟠 HIGH | Potential PHI flow with incomplete account-specific evidence |
| 🟡 MEDIUM | Limited or conditional data flow requiring evidence or policy confirmation |
| 🟢 LOW | No expected PHI flow; contractual scope still requires UTHSC/legal determination |
| ⚪ N/A | Vendor inactive or PHI flow eliminated by architecture |

---

## Vendor Table

| # | Vendor | Role | Potential data flow | Contract/BAA evidence | Risk | Status |
|---|---|---|---|---|---|---|
| 1 | **OpenAI** | AI meal generation, assistant, biometric analysis | **T1/T2 may be sent by selected flows** | Needs external/provider confirmation | 🟠 HIGH | Account/configuration unverified |
| 2 | **PostgreSQL provider** | Primary database role | **All stored tiers** | Needs provider identity and contract evidence | 🔴 CRITICAL | Active Production provider unverified |
| 3 | **Replit** | Repository/deployment platform | **Potentially all tiers depending on Production configuration** | Needs account-specific confirmation | 🔴 CRITICAL | Production configuration unverified |
| 4 | **AWS S3** | User image and file storage | **Potentially T2/T3** | Needs account-specific confirmation | 🟠 HIGH | Agreement/configuration unverified |
| 5 | **Replit Object Storage** | User uploads | **Potentially T2/T3** | Needs provider-chain confirmation | 🟠 HIGH | Chain/configuration unverified |
| 6 | **Sentry** | Error monitoring | **Potentially T1/T3; application scrubber verified** | Needs account-specific confirmation | 🟡 MEDIUM | Provider settings/contract unverified |
| 7 | **Resend** | Primary transactional email | **T3 PII; possibly T2** | Needs provider confirmation | 🟡 MEDIUM | Contract and payload scope unverified |
| 8 | **SendGrid** | Legacy/backup email | **T3 PII; possibly T2** | Needs provider confirmation | 🟡 MEDIUM | Contract and active use unverified |
| 9 | **Twilio** | SMS notifications | **T3 PII; possibly T2** | Needs provider confirmation | 🟡 MEDIUM | Contract and payload scope unverified |
| 10 | **ElevenLabs** | Text-to-speech voice output | **Possibly T2** | Needs provider confirmation | 🟡 MEDIUM | Contract and payload scope unverified |
| 11 | **Stripe** | Payment processing | **No PHI — financial only** | Not applicable (PCI-DSS scope) | 🟢 LOW | No action needed |
| 12 | **Google Places API** | Restaurant search | **No PHI — query only** | Not applicable | 🟢 LOW | No action needed |
| 13 | **VAPID / Web Push** | Push notifications | **Possibly T2 (notification content)** | Protocol-level; FCM/APN in delivery chain | 🟡 MEDIUM | Keep notification content generic; no clinical data |
| 14 | **Facebook Graph API** | Community group integration | **No PHI if properly scoped** | Needs provider confirmation if in scope | 🟢 LOW | Verify no PHI in payload; keep to content IDs only |
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
- T3 PII: identifier minimization is verified for selected Phase 4 prompt flows,
  not as a universal boundary over every OpenAI call site

**Flow-specific Phase 4 mitigations:**
- `sanitizeIdentifiers()` strips email addresses, phone numbers, and UUID-style
  IDs from the reviewed `ProtocolPromptBlock.combined` flow
- `profile.name` removed from `buildMealPrompt()` — replaced with `[anonymous]`
- Medical/dietary clinical content still present in prompts by design (required for safety guardrails)
- Other direct OpenAI call sites require separate payload evidence; no universal
  sanitizer is claimed

**BAA:**  
**NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Current account tier,
HIPAA-eligible configuration, BAA availability/execution, retention, region,
training use, and deletion behavior were not established by U8/U9.

**Risk:** 🟠 HIGH

**Action required:**  
- Option A: Negotiate OpenAI Enterprise agreement with BAA before enterprise launch
- Option B: Architect a PHI-free prompt mode where clinical context is represented as abstract directives only (e.g., "high protein, low glycemic index" instead of "user has diabetes")
- Option B is architecturally cleaner for the long term — does not require per-enterprise vendor negotiation

**Owner:** Engineering + Legal  
**Priority:** P0 before any enterprise HIPAA attestation

---

### 2. PostgreSQL provider

**Role:** Primary database role. The repository contains Neon-specific support,
but the active Production provider/configuration was not inspected.

**PHI exposure:** Everything — T1 Clinical, T2 Behavioral, T3 PII, T4 Operational.

**BAA:**  
**NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Confirm the active provider, account
tier, current certifications, BAA availability/execution, region, retention,
and subprocessor terms directly.

**Alternative:** Evaluate a managed or self-managed PostgreSQL service whose
account-specific security and contractual evidence satisfies UTHSC. Migration
cost and suitability require separate assessment.

**Risk:** 🔴 CRITICAL

**Action required:**  
- Contact Neon for BAA availability on current or upgraded plan
- Document the outcome
- If Neon cannot provide BAA: plan migration timeline to AWS RDS or equivalent

**Owner:** Engineering + Legal  
**Priority:** P0

---

### 3. Replit

**Role:** Repository and configured deployment platform. Active Production
hosting and traffic flow were not inspected by U8/U9.

**PHI exposure:** All tiers (platform-level — code, memory, network, storage all pass through Replit's systems).

**BAA/eligibility:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION** for the applicable
account and service. U8/U9 did not establish current availability or executed
coverage.

**This is a material unresolved hosting/contract evidence question.**

Institutional reviewers will require evidence of the active hosting provider,
service tier, data flow, and applicable contractual coverage.

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

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Verify applicable service
eligibility and executed account coverage directly.

**Risk:** 🟠 HIGH (agreement and Production configuration unverified)

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

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** The contractual and
subprocessor chain through the Replit integration is unverified.

**Risk:** 🟠 HIGH

**Action required:**  
- Consolidate object storage only after the selected account has verified
  contractual coverage and approved Production configuration
- Retire Replit Object Storage for production PHI workloads until the BAA chain is verified

**Owner:** Engineering  
**Priority:** P1

---

### 6. Sentry

**Role:** Error monitoring. Captures exceptions, stack traces, request context, and performance data.

**PHI exposure:**  
Stack traces may include request bodies, response data, or logged variables that contain PHI if an exception occurs mid-generation or mid-route. The risk is subtle but real — a thrown error in an oncology route could capture the patient context in the trace.

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Account tier, current
availability, and executed coverage were not established.

**Risk:** 🟡 MEDIUM

**Action required:**  
- Confirm provider configuration, retention, region, access policy, and
  contractual status
- Preserve the verified application `beforeSend`/`beforeBreadcrumb` scrubber
  and regression coverage

**Owner:** Engineering  
**Priority:** P2

---

### 7. Resend

**Role:** Primary transactional email provider. Used for care team notifications, coaching alerts, invite emails, and account communications.

**PHI exposure:**  
Email `to` addresses are T3 PII. Email body content may include health-adjacent context (e.g., "Your coach has updated your nutrition plan" with a meal plan link). Direct PHI in email bodies should be avoided — email is not a secure channel.

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** This remains material if
email bodies contain clinical language.

**Risk:** 🟡 MEDIUM

**Action required:**  
- Audit all email templates to confirm no T1/T2 content in email bodies — links only, no health data
- Evaluate alternate email providers only after account-specific eligibility
  and contractual evidence is obtained
- Add `[REDACTED]` policy to any email template that might include condition-specific language

**Owner:** Engineering + Product  
**Priority:** P2

---

### 8. SendGrid

**Role:** Legacy/backup email provider (referenced in codebase; `SENDGRID_API_KEY`).

**PHI exposure:** Same as Resend.

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Confirm service eligibility,
account tier, and executed coverage before selecting it for this purpose.

**Risk:** 🟡 MEDIUM (contract and active configuration unverified)

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

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Confirm product eligibility,
account tier, and executed coverage.

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

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** This remains material if
voice content includes personalized health context.

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

**Contractual scope:** **NEEDS UTHSC/LEGAL DETERMINATION.** Repository evidence
supports a payment-only integration boundary, but does not make a legal
determination.

**Risk:** 🟢 LOW

**Action required:** None from PHI perspective. Ensure Stripe webhook signature verification remains enforced (currently implemented in `stripeWebhook.ts`).

---

### 12. Google Places API

**Role:** Restaurant search and location lookup for restaurant meal generation features.

**PHI exposure:** None. Only location/search queries sent; no user health data included.

**Contractual scope:** **NEEDS UTHSC/LEGAL DETERMINATION.** Repository evidence
supports a location/search boundary, but does not make a legal determination.

**Risk:** 🟢 LOW

**Action required:** None.

---

### 13. VAPID / Web Push

**Role:** Browser push notifications for meal reminders, coach alerts, and check-ins. VAPID is a self-hosted signing standard; delivery uses browser vendor infrastructure (Google FCM for Android/Chrome, Apple APNs for Safari/iOS).

**PHI exposure:**  
Push notification payloads may reach FCM/APNs servers. Content should be generic (e.g., "You have a new message from your coach") — never include condition names, lab values, or clinical language.

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION.** Regardless of contract
status, keep notification bodies free of clinical content unless explicitly
approved.

**Risk:** 🟡 MEDIUM (if content contains PHI); 🟢 LOW (if content stays generic)

**Action required:**  
- Audit all `pushToUser()` call sites: confirm notification bodies contain no T1 content
- Enforce a policy: push notification body = action + link only. No health data.

**Owner:** Engineering  
**Priority:** P2

---

### 16. Redis

**Role:** Session cache, SMS worker queues, and notification queues. Current
repository/runtime evidence indicates Redis is disabled; Production was not
inspected.

**PHI exposure:** When active, Redis caches session state and job payloads that may include user IDs and behavioral data (T2/T3).

**BAA:** **NEEDS EXTERNAL/PROVIDER CONFIRMATION** when a provider is selected.

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
| Obtain account-specific contract/configuration evidence or approve a minimized-payload architecture | OpenAI | Engineering + Legal |
| Identify the active Production database provider and obtain contract/configuration evidence | PostgreSQL provider | Engineering + Legal |
| Establish the active Production hosting evidence and obtain UTHSC acceptance | Hosting provider | Engineering + Legal |

### P1 — Required before handling real patient data in production

| Action | Vendor | Owner |
|---|---|---|
| Confirm account-specific contractual coverage; verify S3 encryption and ACL posture | AWS S3 | Engineering |
| Consolidate object storage; verify or retire Replit Object Storage for PHI workloads | Replit Object Storage | Engineering |

### P2 — Required before enterprise partner onboarding

| Action | Vendor | Owner |
|---|---|---|
| Confirm Sentry provider/contract evidence; preserve verified application scrubbing | Sentry | Engineering |
| Audit email templates and obtain provider/contract evidence for the selected service | Resend / SendGrid | Engineering + Product |
| Obtain Twilio provider/contract evidence; audit SMS content templates | Twilio | Engineering + Legal |
| Audit push notification content — enforce PHI-free bodies | VAPID / FCM / APNs | Engineering |

### P3 — Before feature expansion

| Action | Vendor | Owner |
|---|---|---|
| Obtain ElevenLabs provider/contract evidence; audit voice content for PHI | ElevenLabs | Engineering |
| Select a provider accepted by UTHSC before re-enabling Redis | Redis | Engineering |

---

## Contract and BAA Evidence Tracker

No executed agreement was inspected during U8/U9. “Unknown” means the
repository cannot establish either availability or signature status.

| Vendor/service | Availability evidence | Executed agreement evidence | Notes |
|---|---|---|---|
| OpenAI | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm account tier and operating configuration |
| PostgreSQL provider | NEEDS PROVIDER IDENTIFICATION/CONFIRMATION | UNKNOWN | Active Production provider unverified |
| Replit | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm applicable account/service and Production role |
| AWS S3 | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm account coverage and bucket configuration |
| Replit Object Storage | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm contractual/subprocessor chain |
| Sentry | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Application scrubber is verified separately |
| Resend | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm payload scope and provider terms |
| SendGrid | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm active use, tier, and terms |
| Twilio | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm active use, tier, and terms |
| ElevenLabs | NEEDS EXTERNAL/PROVIDER CONFIRMATION | UNKNOWN | Confirm payload scope and provider terms |
| Stripe | NEEDS UTHSC/LEGAL DETERMINATION IF IN SCOPE | UNKNOWN | Payment data flow must remain separate from clinical data |
| Google Places | NEEDS UTHSC/LEGAL DETERMINATION IF IN SCOPE | UNKNOWN | Verify actual payload remains search/location only |
| Facebook Graph | NEEDS UTHSC/LEGAL DETERMINATION IF IN SCOPE | UNKNOWN | Verify actual payload remains nonclinical |
| YouTube Data | NEEDS UTHSC/LEGAL DETERMINATION IF IN SCOPE | UNKNOWN | Verify actual payload remains content lookup only |
| Redis | NEEDS PROVIDER SELECTION/CONFIRMATION | UNKNOWN | Reassess before re-enabling |

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-22 | v1.0 — Initial vendor/BAA map. Covers all active integrations as of Phase 4 completion. |
| 2026-09-08 | v1.1 — Reconciled provider, BAA, Production identity, Sentry, and flow-specific OpenAI claims with U8/U9 evidence. |
