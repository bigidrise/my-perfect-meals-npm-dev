# My Perfect Meals — Legal & Compliance Overview
**Version:** May 2026 | **Classification:** Internal / Enterprise-Facing Operational Documentation

*This document is not legal advice. It describes the operational compliance architecture, technical safeguards, and policy framework currently implemented in the My Perfect Meals platform.*

---

## 1. Platform Compliance Philosophy

My Perfect Meals operates on a compliance-first product philosophy: safety and constraint enforcement are architectural foundations, not features bolted on after the fact.

**Core principles:**

**User safety is non-negotiable and non-bypassable.**
No user action, preference setting, or override mechanism can remove the clinical and allergy constraint layer from a user's account. A user with a nut allergy cannot generate a meal containing peanuts through any path in the platform — the enforcement gateway blocks at the prompt construction layer, and a second scan validates the output after generation. There is no "disable safety" option.

**Clinical boundaries are structurally enforced, not policy-only.**
The platform does not rely on disclaimer text alone to establish clinical scope of practice. Clinical protocols (GLP-1, diabetes, oncology, thyroid, kidney disease, heart failure) are physician-assigned fields. The software enforces what those protocols allow and prohibit at the AI generation layer. A user cannot self-assign the oncology support protocol.

**Fail-closed on ambiguity.**
When the provenance or safety status of an ingredient is unknown relative to a strict dietary protocol (Kosher, Halal, or a clinical hard limit), the system treats it as unsafe, not safe. Uncertainty defaults to caution.

**PHI boundary discipline.**
Audit logging records that a sensitive field changed, not what value it changed to. Raw clinical values, note bodies, and lab numbers are explicitly excluded from all audit log entries.

**Moderation is structural, not reactive.**
Coach-client communication runs through an automated moderation layer before storage. Personal contact information, off-platform solicitation, abusive language, and professional misconduct patterns are detected and blocked before they reach the database.

---

## 2. Clinical Boundary Structure

### Platform Positioning

My Perfect Meals is a nutrition guidance and meal planning platform. It is not a medical device, a clinical decision support system, a dietary supplement, or a replacement for physician care. The platform provides personalized nutrition guidance calibrated to a user's stated health conditions, dietary identity, and goals. It does not diagnose, prescribe, treat, or claim to manage any medical condition.

### Clinical Protocol Scope of Practice Enforcement

The platform's legal document framework includes distinct scope-of-practice agreements for each professional role:

**Nutrition Disclaimer** — accepted by all users during client onboarding flow. Establishes that the platform provides nutritional guidance, not medical advice.

**Scope of Practice Agreement** — accepted by coaches during professional onboarding. Defines what a nutrition coach may and may not represent to clients within the platform context.

**Physician Scope of Practice Agreement** — accepted by clinicians during physician onboarding. Defines the physician's role as protocol assignment and clinical oversight, not direct nutrition program management.

**Patient Physician Agreement + Clinical Data Consent + Medical Waiver** — accepted when a patient is linked to a physician in the care team system. Establishes the clinical data sharing relationship and its boundaries.

All document acceptances are version-tracked. If a document is updated to a new version, the user must re-accept before the relevant functionality is available again. The `checkLegalAcceptance()` function is called at login for role-relevant flows.

### Physician vs. Coach Role Separation

| Capability | Coach | Physician |
|---|---|---|
| Assign clinical protocols (GLP-1, oncology, etc.) | No | Yes |
| View lab results | No (unless explicitly granted) | Yes |
| Manage client meal board | Yes | No |
| Assign general nutrition protocols | Yes | Yes |
| Communicate with client via tablet messaging | Yes | Yes |
| Access patient clinical data consent records | No | Yes |

Coach user IDs are never exposed to the frontend. All coach identification uses slug-only references to prevent client-side privilege escalation.

### Condition-Aware Generation Boundaries

Clinical protocol meal builders (diabetic, GLP-1, anti-inflammatory, oncology support) generate meals within the clinical parameters of the assigned protocol. They do not:
- Reference or recommend specific medications
- Make treatment claims of any kind
- Adjust protocol parameters without physician assignment
- Claim to improve, cure, or treat any medical condition

The oncology support context is explicitly physician-assigned and not self-reportable by the user. The `oncology_support_intent` field (user onboarding intent) and `oncology_support_context` (physician-assigned protocol) are structurally separate fields. Hard-blocked ingredients for oncology are enforced both at prompt construction and in post-generation scanning. No treatment claims are permitted in generated output.

---

## 3. AI Safety and Enforcement Systems

### Protocol Envelope — Universal Pre-Generation Enforcement

Every AI generation call across the entire platform — Create a Dish, Fridge Rescue, Craving Creator, Beverage Creator, Dessert Creator, Restaurant Guide, Find Meals Near Me, or any other generator — must pass through `protocolEnvelope.ts` before any AI call is made.

The Protocol Envelope assembles a `UserProtocolEnvelope` from:
1. **Dietary Identity** — outermost container; no generation occurs outside it
2. **Allergy profile** — absolute hard stops with provenance-aware expansion
3. **Medical hard limits** — carbohydrate ceilings, sodium limits, clinical parameter enforcement
4. **Medical optimization layers** — positive optimization targets inside hard limits
5. **Avoidance list** — user-marked unwanted foods
6. **Behavioral preferences** — flavor, cuisine, convenience

**Procedural constraint layer (cross-cutting):** preparation rules, storage requirements, equipment constraints, instruction-level compliance rules, cross-contamination prevention.

`enforceBeforeGenerate()` is called before every AI call. `scanGeneratedOutput()` is called on every AI response before it is returned to the user. Both calls are mandatory; no generator can produce output without both.

### Safety Profile Service

`safetyProfileService.ts` sits above every meal generator as a deterministic blocking layer that runs before the AI call. It returns one of four verdicts:

| Result | Meaning |
|---|---|
| `SAFE` | No constraint conflicts detected; generation proceeds |
| `AMBIGUOUS` | Named dish or ingredient has known high-risk associations; warning surfaced |
| `BLOCKED` | Hard constraint violation detected; generation blocked |
| `DIET_ADAPT` | Input requires dietary adaptation before generation |

**Ambiguous dish detection:** The system maintains a lookup table of dishes known to carry hidden allergen risk (jambalaya → shellfish, paella → shellfish/fish, Thai dishes → peanuts/fish sauce/shellfish, stir fry → soy/peanuts/shellfish). When a user with a relevant allergy requests an ambiguous dish, the system surfaces a warning and suggests a safe alternative before proceeding.

### Enforcement Gateway

`enforcementGateway.ts` implements the full five-tier constraint hierarchy with strict priority ordering:

- **Tier 0:** Dietary Identity — outermost wall; runs before allergy checks
- **Tier 1:** Allergy / life-threatening safety — absolute nested constraint
- **Tier 2:** Medical hard limits
- **Tier 3:** Medical optimization targets
- **Tier 4:** User food avoidances

**Fail-closed contract:** Unknown provenance or certification for a strict protocol = BLOCK. The system does not treat unknown as safe.

Cultural relationship rules are evaluated via `evaluateRelationshipRules()` from `culturalRules.ts` — for example, preventing Kosher meals from including meat-dairy combinations even when individual ingredients pass their own checks.

### Macro Truth Contract

`macroTruthContract.ts` enforces a documented standard across all generation:
- `null` = macro value is unknown
- `0` = macro value is confirmed zero
- AI is prohibited from inventing macro values
- Values may be rejected or trigger regeneration; they are never silently mutated
- Macro injection is blocked for specific diet types where AI macro generation is structurally unreliable

### Ingredient Intelligence Store — Fail-Closed Provenance Database

`ingredientIntelligence.ts` is a curated database of ingredients whose dietary safety depends on source and process, not just ingredient name. Each entry tracks:
- **Source:** animal / plant / synthetic / derived / unknown
- **Process metadata:** slaughter method, fermentation type, refinement level
- **Certification:** kosher-certified / halal-certified / both / none / unknown
- **Protocol risk:** per-protocol risk level with stated reason
- **Fail-closed protocols:** protocols for which "unknown" = "unsafe"

Examples: gelatin (pork-derived vs. fish-derived vs. plant-derived), rennet (animal vs. microbial), L-cysteine (duck feather vs. synthetic). The system treats certification-unknown versions of strict-protocol ingredients as blocked.

### Safety Pin System

`safetyPinService.ts` governs the allergen override flow for users who wish to override a specific safety block (e.g., a user with a documented nut sensitivity who wishes to include one controlled nut ingredient).

**Technical safeguards:**
- PINs stored as bcrypt hashes (12 salt rounds)
- Override tokens expire after 5 minutes; unused tokens are purged on a clean-up interval
- Maximum 5 PIN entry attempts before 15-minute lockout
- Each override token is single-use, bound to a specific user ID, allergen, and meal request
- All safety overrides are written to `safetyOverrideAuditLogs` for review

Allergy profile edits (not just per-meal overrides) require a separate `allergyEditToken` flow to prevent casual modification of the allergy profile.

### Post-Generation Output Scan

`scanGeneratedOutput()` runs on every AI response before it reaches the user. The scan checks:
- Generated meal text for hidden dietary violations
- Hard-blocked ingredient presence (by exact match and category expansion)
- Allergen presence through the full expanded allergen vocabulary (not just exact ingredient names)
- Oncology hard-blocked ingredient list (for oncology-assigned users)

A meal that passes prompt-level enforcement but fails the post-generation scan is blocked and not returned to the user.

### Voice Note Moderation

All voice notes in the ProCare coach-client communication system pass through `tabletModerationService.ts` after transcription and before storage.

**Detection categories:**

| Severity | Category | Action |
|---|---|---|
| High | Abusive language (death threats, slurs, assault threats) | Block + flag |
| High | Grooming / inappropriate relationship language | Block + flag |
| High | Professional misconduct | Block + flag |
| Medium | Personal contact information (email, phone, social handles) | Block |
| Medium | Off-platform solicitation ("my Instagram is...") | Block |
| Low | Mild unprofessional language | Warn |

**Personal information detection:** The moderation service detects standard email address formats, all common phone number formats (including international), and explicit social media handle sharing ("my ig is...", "@handle" patterns).

**Platform conduct boundary:** Contact information and off-platform solicitation are blocked at the message layer to maintain the coach-client relationship within the platform — protecting both the coach's professional boundary and the client's privacy.

---

## 4. User Data and Privacy Architecture

### Authentication Architecture

- **Password storage:** bcrypt with 12 salt rounds. Plaintext passwords are never stored or logged.
- **Auth tokens:** 32 cryptographically random bytes (`crypto.randomBytes(32)`) per session. Tokens are not predictable or guessable.
- **Session state:** Server-side session with token-based authentication. The `requireAuth` middleware resolves the full `AuthenticatedUser` context from the database on every protected request — no client-side trust for plan, entitlement, or role data.
- **Entitlement enforcement:** Plan tier and entitlements are resolved server-side at request time via `resolveAccessTier()`. Client-provided plan status is never trusted.

### User Profile Protection

- All profile endpoints require valid authentication. The `requireAuth` middleware runs before any user data is accessed.
- `requireActiveAccess` middleware enforces paid-tier gating on protected features server-side.
- Dietary identity, medical conditions, allergen profile, and clinical protocol assignments are stored in the users table and are never returned to clients other than the account owner or an authorized ProCare professional.

### Role Separation

The authenticated user context includes `organizationId` for multi-tenant role isolation. Cross-organization access attempts are logged as `ORG_VIOLATION` audit events. The public organization (`MPM_PUBLIC_ORG_ID`) is the default for non-professional users.

**Tester identification:** `isTester` is set at signup only via explicit email allowlist (`MPM_TESTER_EMAILS` environment variable). It cannot be set by the user and is not client-writable.

### Household Profile Handling

Each household profile has an independent set of dietary identity, medical conditions, allergens, preferences, and generation history. The account owner can switch between profiles; non-owner household members cannot access the owner's profile data. The profile resolver (`profileResolver.ts`) enforces that generation calls use the active profile's constraint set, not the account owner's.

### Biometric Data Storage

Biometric data (weight, body composition, glucose, blood pressure, sleep) is stored in the `biometricSample` table with `userId` scoping. All values are normalized to canonical units at ingest (weight to kg, waist to cm). Biometric data is only accessible to the data owner and to ProCare professionals with an established client relationship.

### Clinical Lab Data

Lab results are stored in `clinicalLabs` schema with ownership tracked via `labProtocolOwnership.ts`. Access is restricted to the patient and their linked physician. `resolveProtocolFromLabs.ts` can derive protocol recommendations from lab values but does not expose raw values outside the authorized relationship.

### Audit Logging Architecture

`auditLog.ts` is the platform's audit record system, designed with PHI boundary discipline from Phase 3 HIPAA compliance planning.

**Rules enforced:**
- Log that a field changed, not what value it changed to
- `meta` must not contain raw PHI values (T1 field values, note body, lab numbers)
- Safe in `meta`: resource IDs, action flags (enabled/disabled), counts, route context
- Fire-and-forget: audit writes never block a request; DB write failures go to stderr only

**Logged event types:**

| Event Type | Trigger |
|---|---|
| `AUTH_LOGIN` | Successful authentication |
| `AUTH_LOGOUT` | Session invalidated |
| `AUTH_SIGNUP` | New account created |
| `AUTH_RESET` | Password reset initiated or completed |
| `READ` | T1 field read by a non-owner (coach or physician access) |
| `WRITE` | T1/T2 field created or updated |
| `DELETE` | T1/T2 record deleted |
| `ORG_VIOLATION` | Cross-organization access attempt (always blocked) |

---

## 5. Professional and ProCare Compliance

### Legal Document Acceptance by Role

Every professional role requires acceptance of role-specific legal documents before access is granted. The `checkLegalAcceptance()` system is version-aware — if a document version increments, re-acceptance is required.

**Document sets by flow:**

| Flow | Required Documents |
|---|---|
| `client` | Client Coaching Agreement, Liability Waiver, Data Consent, Nutrition Disclaimer |
| `professional` | Coach Professional Agreement, Conduct Policy, Scope of Practice |
| `physician` | Physician Professional Agreement, Conduct Policy, Physician Scope of Practice |
| `patient_physician` | Patient-Physician Agreement, Clinical Data Consent, Medical Waiver |
| `attestation` | Professional Attestation |

### ProCare Attestation

Before full ProCare coach access is granted, the professional completes an attestation flow (`ProCareAttestation.tsx`). This includes:
- Professional credential submission
- Identity verification
- Acceptance of the professional conduct policy and scope of practice agreement
- Completion of the professional attestation document

Access to the coach workspace is contingent on completed attestation. No one enters the ProCare queue without completed payment AND completed attestation.

### Client Relationship Architecture

The coach-client relationship is established via an atomic transaction in `procareActivation.ts`:
- Studio membership record created
- Client link record created
- Both created or restored together — never partially

**Reconnect safety:** If a client-coach relationship previously existed and was archived, reactivation restores the existing records rather than creating duplicates. Historical compliance and program data are preserved.

Every state change to a client relationship is written to `activityLog.ts` for audit purposes: activation, deactivation, restoration, and any protocol change events.

### Studio System Compliance

Studio billing (`studioBilling` table) tracks payment state for professional accounts. Studio memberships track the relationship between coaches and their studio. Cross-studio data access is blocked — a coach can only access data for clients linked to their studio.

### Coach ID Non-Exposure

Coach user IDs are never exposed to the frontend. All coach identification in client-facing interfaces uses the slug-only reference from the coach registry. This prevents client-side ID enumeration or privilege escalation attempts.

---

## 6. Billing and Subscription Compliance

### Stripe Billing (Web)

- All checkout flows are managed server-side via `server/routes/stripeCheckout.ts`
- Stripe webhooks are signature-verified before processing via `server/routes/stripeWebhook.ts`
- Client-provided subscription or plan status is never trusted — all entitlements are resolved server-side from the verified Stripe subscription record
- Webhook handlers confirm the Stripe signature with the webhook secret before taking any state-changing action

### Apple In-App Purchase Verification (iOS)

- Receipt verification is performed server-side via `server/routes/iosVerify.ts`
- Apple receipt data submitted by the client is verified against Apple's verification API before any entitlement is granted
- Client-side purchase confirmations are not trusted without server-side Apple verification

### Entitlement Enforcement Architecture

Entitlements are resolved at request time by `resolveAccessTier()` in `requireAuth` middleware. The resolved `accessTier` is attached to every authenticated request context. Feature access decisions throughout the application use the server-resolved access tier, not any client-provided value.

**Tester accounts:** `isTester` is set at signup via an explicit server-side email allowlist only. It cannot be elevated through any client-side mechanism.

**Billing enforcement flag:** `BILLING_ENFORCED` environment variable is the master launch switch. When unset or false, all accounts receive Ultimate-tier access (pre-launch/development mode). When set to `"true"`, real entitlement enforcement activates. This change requires no code deployment.

### ProCare Roster Enforcement

ProCare subscription tiers enforce maximum client roster sizes (5, 10, 25, 50, 150). Roster limits are enforced server-side. A coach cannot add clients beyond their subscribed roster size.

---

## 7. Moderation and Communication Safeguards

### Voice Note Moderation Pipeline

Voice notes in the coach-client tablet communication system are not stored until they pass moderation. The full pipeline:

1. Audio recorded → uploaded to object storage
2. Job queued in `tablet_voice_jobs`
3. `VoiceJobWorker` polls queue (8-second interval, `FOR UPDATE SKIP LOCKED` for concurrency safety)
4. Audio downloaded from object storage
5. Transcription via OpenAI Whisper
6. `tabletModerationService.moderation()` evaluates transcript
7. If allowed: stored as `client_notes` record
8. If blocked: job marked failed; note not stored; incident available for admin review

**Maximum 3 processing attempts per job.** Failed jobs after 3 attempts are not silently discarded — they remain in a failed state for administrative review.

### Text Message Moderation

All text communications through the tablet messaging system pass through the same moderation service before storage. Moderation categories:

**High severity (block + flag):**
- Abusive language: death threats, credible threats of harm, slurs (complete vocabulary), threats of sexual violence
- Grooming / inappropriate relationship language
- Professional misconduct patterns

**Medium severity (block):**
- Personal contact information: email addresses (all standard formats), phone numbers (all common formats including international), social media handles and explicit "my [platform] is..." patterns
- Off-platform solicitation

**Low severity (warn):**
- Mild unprofessional language

**Platform conduct standard:** The `BLOCKED_MESSAGE` constant provides a consistent, non-revealing response to blocked communications: "Message blocked. For your safety, please keep all communication respectful, professional, and within My Perfect Meals."

### Push Notification and SMS Safeguards

- Push notifications use VAPID key authentication; tokens are registered per-device
- SMS delivery via Twilio is server-initiated only; no inbound SMS processing exposes user data without auth
- Notification content does not include PHI or sensitive health data

### Abuse Prevention

- PIN rate limiting: 5 attempts before 15-minute lockout, enforced in `safetyPinService.ts`
- Auth token generation uses cryptographically random 32-byte values
- Cross-org access attempts are logged as violations and blocked
- Admin dashboard and moderation tools for platform-level oversight

---

## 8. Enterprise and Healthcare Readiness

### Current Multi-Tenant Architecture

The platform operates a studio-scoped multi-tenancy model:
- Each professional studio is an isolated data tenant
- Coaches access only their studio's clients
- Client data is scoped to the active studio membership relationship
- `organizationId` on the authenticated user context provides the org-level isolation layer

This is not a single-tenant monolith — the data model already accommodates organizational boundaries. Expanding to institution-level tenancy (for white-label educational or enterprise deployments) is an architectural extension of the existing studio model.

### Future EHR Integration Goals

The clinical infrastructure in the platform — physician portal, lab result storage, lab-to-protocol resolution, patient-physician legal agreements, and PHI-boundary-aware audit logging — is designed with EHR integration as a forward-compatible goal.

Key readiness indicators:
- Audit logging follows PHI boundary discipline consistent with HIPAA audit trail requirements
- Clinical protocol assignments are physician-scoped, not self-assignable
- Lab results are stored with ownership tracking and access controls
- Patient-physician legal agreement framework is in place
- Condition-specific prompt builders are isolated services that can be called from external clinical workflows

Full EHR integration (HL7 FHIR, CCD import/export, direct EHR system connectors) is a roadmap item.

### Healthcare Collaboration Direction

The platform's architecture supports a collaborative model between nutrition coaching and clinical care — not a replacement of clinical care. The care team system allows a patient to have a physician AND a trainer simultaneously, each with role-appropriate access. This structure maps to how integrated wellness programs in clinical settings actually operate.

### Telehealth Direction

Telehealth integration — connecting the nutrition protocol layer to telehealth provider platforms — is a natural extension of the existing physician portal and care team infrastructure. The legal framework (patient-physician agreement, clinical data consent) is already in place at the document layer.

### Enterprise Deployment Goals

- Full white-label deployment capability (custom domain, institution branding)
- Institution-level tenant isolation
- Bulk student/user provisioning via product code system
- Institutional compliance reporting (aggregate, non-PHI)
- SSO / SAML integration for enterprise identity management
- Data residency controls for international enterprise deployments

---

## 9. Current Compliance State

### Currently Implemented Safeguards

**AI and generation safety:**
- Protocol Envelope with 5-tier constraint hierarchy on all generators
- Safety Profile Service with deterministic pre-generation blocking
- Enforcement Gateway with fail-closed contract
- Post-generation output scan on every AI response
- Ingredient Intelligence Store with provenance-based fail-closed blocking
- Macro Truth Contract
- Safety Pin system with bcrypt hashing, time-bounded tokens, rate limiting
- Safety override audit logging

**Authentication and access control:**
- bcrypt password hashing (12 rounds)
- 32-byte cryptographically random auth tokens
- Server-side entitlement resolution (no client trust)
- Role separation (consumer, coach, physician, admin)
- Cross-org violation detection and logging
- Tester allowlist-only assignment

**Legal and consent:**
- Version-tracked document acceptance for all professional flows
- Separate document sets for client, coach, physician, patient-physician, and attestation flows
- Legal acceptance checked at login for role-relevant flows
- Scope of practice documents per professional role

**Audit logging:**
- PHI-boundary-aware audit log (logs field changes, not values)
- Full action type coverage: auth events, reads, writes, deletes, org violations
- Fire-and-forget architecture (never blocks requests)
- Safety override audit log

**Professional compliance:**
- ProCare attestation required before coach access
- Completed payment required before ProCare queue
- Atomic client activation with activity logging
- Roster size enforcement by subscription tier
- Coach ID non-exposure on frontend

**Communication moderation:**
- Voice note moderation pipeline (high/medium/low severity)
- Text message moderation with same rule set
- Personal contact information blocking
- Off-platform solicitation blocking
- Professional misconduct detection

**Billing integrity:**
- Stripe webhook signature verification
- Apple receipt server-side verification
- Server-resolved entitlements (no client-side trust)

### Operational Policies in Place

- `BILLING_ENFORCED` environment variable as master launch switch (no code deployment for enforcement activation)
- `MPM_TESTER_EMAILS` allowlist for tester status
- `ONCOLOGY_SUPPORT_V1` feature flag for oncology protocol activation
- `MACRO_AUDIT` flag for macro debug logging in development

### Planned Enterprise Compliance Goals

- Formal HIPAA compliance review and gap analysis
- Business Associate Agreement (BAA) framework for healthcare partnerships
- SOC 2 Type II audit preparation
- Full white-label multi-tenant isolation
- SSO / SAML enterprise identity integration
- EHR integration (HL7 FHIR)
- Data residency controls for international deployments
- Formal penetration testing program
- Vulnerability disclosure policy

### Future Legal and Compliance Roadmap Areas

- GDPR compliance framework for EU user data (right to deletion, data portability, consent management)
- CCPA compliance for California users
- COPPA review for family plan and household features involving minors
- FDA digital health software guidance review for clinical protocol features
- International nutritional labeling and dietary standard compliance for global expansion

---

## 10. Risk and Responsibility Philosophy

### Adaptive AI Nutrition and Human Oversight

My Perfect Meals is an AI-assisted platform, not an autonomous AI system. Every meal generated by the platform is a suggestion. The platform's role is to make high-quality, personalized, constraint-compliant meal suggestions available instantly. Accepting, modifying, or rejecting those suggestions is always the user's choice.

The AI enforcement layers (Protocol Envelope, Safety Profile, Enforcement Gateway, post-generation scan) exist not to make clinical decisions but to ensure that AI-generated content cannot violate a user's established dietary identity, medical constraints, or allergen profile. The human — user, coach, or physician — retains full agency over what they eat, what they recommend, and what protocols they manage.

### Physician Collaboration Model

The platform is explicitly designed for collaboration with physicians, not competition with them. Clinical protocol assignments originate with physicians. Lab result interpretation belongs to clinicians. The platform translates clinical parameters (carbohydrate limits, sodium restrictions, immunosuppression-related dietary rules) into practical meal guidance — a translation function, not a diagnostic or prescriptive one.

The physician portal, care team structure, and patient-physician legal agreements are designed to make the platform a usable tool within a supervised clinical workflow, not a standalone substitute for one.

### Coach Infrastructure as Responsibility

Professional coaches using the ProCare platform accept a scope of practice agreement that defines the boundaries of nutrition coaching within the platform. The platform enforces those boundaries structurally: coaches cannot assign clinical protocols, coaches cannot access lab results without physician authorization, and coach communications are moderated for professional conduct.

Providing coaches with professional infrastructure — roster management, compliance tracking, program delivery, communication logging — raises the quality of client outcomes. It also creates an auditable record of coaching activity, which protects both the client and the coach in the event of a dispute or adverse outcome.

### Educational Usage and Responsibility

In educational deployments, all platform features and enforcement systems operate identically to production use. Students using the platform in a curriculum context work within the same Protocol Envelope, the same safety layers, and the same compliance infrastructure as paying subscribers. There is no "educational mode" that relaxes safety constraints.

This is intentional. Training on the actual production system means graduates enter professional practice already familiar with the real enforcement model — not a simplified simulation of it.

### Responsible Coaching Infrastructure Philosophy

The platform's position is that the nutrition coaching industry is better served by infrastructure that creates accountability, enforces professional conduct, and makes it harder — not easier — to give dangerous guidance, than by software that simply provides tools without structure.

Safety layers are not obstacles to generating meals. They are the reason a coach can hand a client a generated meal without personally verifying every ingredient against every protocol every time. The enforcement infrastructure absorbs that responsibility so the coach can focus on the client relationship.

---

*Document generated from implemented codebase and operational architecture — May 2026.*
*System references: server/lib/auditLog.ts, server/services/enforcementGateway.ts, server/services/safetyPinService.ts, server/services/safetyProfileService.ts, server/services/tabletModerationService.ts, server/services/protocolEnvelope.ts, server/services/legalCheck.ts, shared/legalDocuments.ts, server/routes/auth.session.ts, server/middleware/requireAuth.ts, server/routes/stripeWebhook.ts, server/routes/iosVerify.ts*
