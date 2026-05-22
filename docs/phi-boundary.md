# MyPerfectMeals — PHI Boundary Document

**Version:** 1.0  
**Status:** Active  
**Effective:** 2026-05-22  
**Owner:** Engineering / Compliance  

---

## Purpose

This document defines the exact Protected Health Information (PHI) surface of the MyPerfectMeals platform. It serves as the authoritative reference for:

- **Audit logging scope** (Phase 3) — which reads/writes must be logged
- **AI sanitization rules** — which fields must never appear in prompts or logs
- **BAA discussions** — what covered entities are agreeing to protect
- **Access control decisions** — which routes need clinical-grade enforcement
- **Data subject requests** — what gets deleted or exported on user request

Under HIPAA, PHI is any individually identifiable health information. MPM stores PHI across three tiers. Tier 1 carries the highest legal exposure.

---

## Sensitivity Tiers

| Tier | Label | Description | BAA Required | Audit Logged |
|---|---|---|---|---|
| **T1** | Clinical PHI | Lab results, diagnoses, prescriptions, clinical protocols, oncology context | Yes | Every read + write |
| **T2** | Behavioral PHI | Consumption logs, macro tracking, biometric history, meal boards | Yes (when linked to identity) | Writes |
| **T3** | PII | Name, email, phone, date of birth, auth credentials | No (HIPAA) / Yes (GDPR) | Auth events only |
| **T4** | Operational | Audit trails, activity logs, internal routing | No | No (is the log) |

---

## Tier 1 — Clinical PHI

These fields directly reflect diagnosis, treatment, or prescription. Cross-org access to any T1 field is an immediate HIPAA violation. Every write must be physician-or-coach-attributed and must pass `verifyClinicalAccess`.

### `users` table (`shared/schema.ts`)

| Column | Type | Description |
|---|---|---|
| `health_conditions` | `text[]` | Self-reported diagnoses (diabetes, hypertension, etc.) |
| `medical_conditions` | `text[]` | Physician-assigned conditions (includes `"glp1"` flag) |
| `specialty_condition` | `text` | Single active clinical protocol slot (renal, cardiac, liver-disease, liver-support, oncology-support, thyroid-support) |
| `specialty_conditions` | `text[]` | Multi-protocol expansion of above |
| `oncology_support_context` | `jsonb` | Physician-assigned cancer nutrition context: `enabled`, `symptoms[]`, `emphasis`, `source`, `locked`, `ownerName`, `updatedBy`, `updatedAt` |
| `oncology_support_intent` | `text` | User-stated onboarding intent only — not clinical, but adjacent |
| `thyroid_medication` | `text` | Specific thyroid prescription disclosure |
| `age` | `integer` | Clinical demographic (used in protocol calculations) |
| `height` / `weight` | `integer` | Physical biometrics (used in macro and clinical calculations) |

### `clinical_labs` table (`server/db/schema/clinicalLabs.ts`)

All columns are T1. The full field list:

| Panel | Columns |
|---|---|
| Lipid | `ldl`, `hdl`, `triglycerides` |
| Cardiac | `blood_pressure_systolic`, `blood_pressure_diastolic`, `ejection_fraction`, `inr` |
| Renal | `creatinine`, `bun` |
| Liver | `alt`, `ast`, `bilirubin`, `albumin` |
| Thyroid | `tsh`, `free_t4`, `free_t3`, `tpo_antibodies`, `thyroglobulin_antibodies` |
| Metabolic | `fasting_insulin`, `glucose`, `a1c` |
| Inflammation | `crp` |
| Hormonal | `cortisol` |
| Oncology/Nutrition status | `prealbumin` |
| Metadata | `recorded_by_id`, `lab_date`, `notes` |

Access control: `recorded_by_id` must be a verified studio owner. No self-service write path.

### `diabetes_profile` table (`shared/diabetes-schema.ts`)

| Column | Description |
|---|---|
| `type` | Diagnosis (T1D, T2D, PREDIABETES, NONE) |
| `a1c_percent` | Most recent HbA1c reading |
| `medications` | `string[]` — active diabetes medications |
| `guardrails` | `jsonb` — physician-set carb limits, meal frequency caps |
| `hypo_history` | Boolean — hypoglycemia history flag |

### `glucose_logs` table (`shared/diabetes-schema.ts`)

| Column | Description |
|---|---|
| `value_mgdl` | Blood glucose reading |
| `context` | Fasted / post-meal / random |
| `insulin_units` | Dose administered at time of reading |

Physician-only: `insulin_units` is suppressed in coach-facing API responses.

### `glp1_shots` table (`server/db/schema/glp1Shots.ts`)

| Column | Description |
|---|---|
| `dose_mg` | Prescription dose — physician-only visibility |
| `location` | Injection site — physician-only visibility |
| `date_utc` | Administration date |

Physician-only fields (`dose_mg`, `location`) are stripped from non-physician responses in `/api/pro/clients/:clientId/nutrition-strategy`.

### `client_notes` + `client_cycle_protocols` (`server/db/schema/studio.ts`)

| Column | Description |
|---|---|
| `body` | Narrative clinical note — may contain diagnoses, symptoms, treatment discussion |
| `transcript` | AI-transcribed voice note content |
| `audio_object_key` | S3/object storage key to raw voice audio |
| `tags` | Clinical annotation tags (e.g., `visibleTo:client`) |
| `strategy_type` | Protocol type (e.g., anti-inflammatory, cardiac) |
| `coach_instructions` | Free-text clinical guidance |
| `watch_for` | Symptom watch list |

All `client_notes` rows are T1 PHI regardless of `entry_type` (message or note). The narrative content can contain anything the coach or client has typed.

### `guardrail_audit_log` + `glp1_audit_log` (`server/db/schema/patientAssignment.ts`)

| Table | T1 Columns |
|---|---|
| `guardrail_audit_log` | `doctor_id`, `patient_id`, `field`, `old_value`, `new_value` |
| `glp1_audit_log` | `user_id`, `clinician_id`, `previous_values`, `new_values` |

These tables ARE the audit trail for their respective domains. They are T1 because they record diffs of T1 fields.

---

## Tier 2 — Behavioral PHI

These tables are PHI when linked to an identified individual. On their own they describe health-adjacent behavior. Under HIPAA, linking any of these to a named user makes them PHI.

### `macro_logs` (`shared/schema.ts`)

| Column | Description |
|---|---|
| `kcal`, `protein`, `carbs`, `fat`, `fiber`, `alcohol` | Daily nutritional intake |
| `starchy_carbs`, `fibrous_carbs` | Clinical carb breakdown (relevant for diabetes/renal protocols) |
| `at` | Timestamp (establishes eating pattern) |

### `biometric_sample` (`shared/biometricsSchema.ts`)

| Column | Description |
|---|---|
| `type` | steps, heart_rate, weight, sleep, active_energy, resting_energy |
| `value` | Numeric measurement |
| `unit` | mg/dL, bpm, kg, etc. |
| `source` | apple_health, manual, etc. |
| `recorded_at` | Timestamp |

### `body_fat_entries` (`server/db/schema/bodyComposition.ts`)

| Column | Description |
|---|---|
| `current_body_fat_pct` | Body composition measurement |
| `scan_method` | DEXA, calipers, bioimpedance — indicates clinical setting |
| `lean_mass_lbs`, `fat_mass_lbs` | Derived composition values |

### `meal_board_items` + `meal_boards` (`server/db/schema/mealBoards.ts`)

Coach-assigned meal boards are T2 because they encode prescribed nutrition. Client-authored boards are T2 behavioral. Board contents are not themselves T1, but they operationalize T1 protocols (e.g., renal carb limits).

### `users` — nutritional targets (`shared/schema.ts`)

| Column | Description |
|---|---|
| `daily_calorie_target` | Prescribed or self-set energy target |
| `protein_target`, `carbs_target`, `fat_target` | Macro targets |
| `dietary_restrictions` | `text[]` — medically necessary (e.g., dialysis-level phosphorus restriction) |
| `allergies` | `text[]` — immunological sensitivities |
| `fitness_goal` | Self-reported goal (weight loss, muscle gain, etc.) |

`dietary_restrictions` and `allergies` straddle T1/T2 — they can reflect clinical necessity (renal diet = dialysis) or simple preference (lactose intolerance). Treat as T1 when set by a physician, T2 otherwise.

### `household_profiles` (`server/db/schema/householdProfiles.ts`)

Mirrors the `users` health fields for family members. All health columns (conditions, restrictions, allergies, targets) carry the same tier as the equivalent `users` column. PII fields (display name) are T3.

---

## Tier 3 — PII (Identity)

Not medical PHI under HIPAA, but required for identity protection, GDPR compliance, and data subject requests.

### `users` — identity fields

| Column | Category |
|---|---|
| `email` | Contact PII |
| `first_name`, `last_name` | Legal name PII |
| `username` | Identifier PII |
| `phone` | Contact PII |
| `birthday` | Quasi-identifier (becomes PHI when combined with health data) |
| `nickname` | Personal identifier |
| `profile_image_url` | Personal image |
| `stripe_customer_id` | Financial identifier |
| `auth_token`, `reset_token` | Security credentials (never log, never return in API responses) |

### `care_team_member` / `care_invite` / `studio_invites`

| Column | Category |
|---|---|
| `name`, `email` (care_team_member) | T3 PII — may also be a clinician's identity |
| `email` (care_invite, studio_invites) | T3 PII |

---

## Tier 4 — Operational (Not PHI)

These tables record system events. They may contain user IDs and action codes but not health content. They are the audit infrastructure, not the subject of auditing.

| Table | Notes |
|---|---|
| `client_activity_log` | Action codes + metadata. Never stores note body content. |
| `ai_usage` | Token counts, quota tracking. No prompt content. |
| `guardrail_audit_log` | T1 — already listed above (exception: it records diffs of T1 data) |

---

## AI Sanitization Rules

These rules apply to every OpenAI call, log line, and error message in the system.

### Never include in prompts
- Full name + any health condition in the same prompt
- `auth_token`, `reset_token`, `password`
- Raw lab values with patient name attached (use aggregated/anonymized references)
- `oncology_support_context` full object (the prompt builder extracts only symptom flags)

### Never log
- Any T1 field value (log that a field was updated, not its value)
- `auth_token`, `reset_token`, `password` (ever, under any circumstance)
- Email addresses in application logs (use masked form: `user@***`)
- `body` content of `client_notes` (narrative PHI — log entry ID only)

### Safe to log
- User IDs (UUIDs, not emails or names)
- Action type and timestamp
- Route path (not query parameters that may contain health values)
- Org ID and studio ID

---

## Phase 4 — Implemented AI Sanitization Layer

**Status:** Active as of 2026-05-22  
**Files:** `server/services/promptSanitizer.ts`, `server/services/protocolEnvelope.ts`, `server/services/promptBuilder.ts`

### Identity Scrubbing (`server/services/promptSanitizer.ts`)

`sanitizeIdentifiers(text)` is applied to every `ProtocolPromptBlock.combined` string inside `enforceBeforeGenerate()` before the block reaches any OpenAI call. It replaces:

| Pattern | Replacement |
|---|---|
| Email addresses | `[email]` |
| US/intl phone numbers | `[phone]` |
| UUID v4 identifiers | `[id]` |

Medical/dietary/clinical content is never modified — only identity tokens are stripped.

### Name Removal (`server/services/promptBuilder.ts`)

`buildMealPrompt()` previously injected `profile.name` (T3 PII) into the user prompt section. This has been replaced with the anonymous label `[anonymous]`. The AI receives dietary profile, macro targets, and medical context but never the user's real name.

### T1 Field Audit at AI Boundary (`server/services/protocolEnvelope.ts`)

`enforceBeforeGenerate()` now:
1. Scans the assembled envelope for T1/T2 PHI field categories (no values — names only)
2. Returns `phiFields: string[]` on the `ProtocolPromptBlock` for callers
3. When `context.actorId` is provided, fires a `PROMPT_PHI_AUDIT` audit log entry recording which field categories were sent to AI

Detected field categories: `medical_hard_limits`, `condition_guidance_blocks`, `oncology_context`, `glp1_context`, `renal_context`, `cardiac_context`, `diabetic_guidance`, `thyroid_medication`, `thyroid_support`

### Audit Action: `AI_PROMPT_PHI`

| Field | Value |
|---|---|
| `action` | `AI_PROMPT_PHI` |
| `resource_type` | `prompt_context` |
| `route` | `generator:<name>` (e.g., `generator:craving_creator`) |
| `meta.phiFields` | Array of T1/T2 field category names present |
| `meta.generatorName` | Which AI generator was invoked |

This event is emitted per-generation for authenticated users — guests produce no audit entry. Values are never included.

---

## Access Control Matrix

| Data Tier | Self-access | Coach (same org) | Physician (same org) | Cross-org | Admin |
|---|---|---|---|---|---|
| T1 Clinical | Own records only | `verifyClinicalAccess` required | `verifyClinicalAccess` + `clinic` studio type | **Blocked** (`assertSameOrg`) | Read-only audit |
| T2 Behavioral | Full access | Via `requireWorkspaceAccess` | Via `requireWorkspaceAccess` | **Blocked** (`assertSameOrg`) | Read-only audit |
| T3 PII | Full access | Name + role only | Name + role only | **Blocked** | Read-only audit |

---

## Enforcement Points (as of Phase 1B)

Every T1 and T2 cross-user access path now passes through at least one of these guards in this order:

```
1. assertSameOrg(actor, target)          — org boundary (requireWorkspaceAccess / inline)
2. verifyClinicalAccess(actor, target)   — studio relationship + org (T1 routes only)
3. Relationship query                    — clientLinks / studioMemberships check
4. Role gate                             — physician-only fields filtered in response
```

Routes using `requireWorkspaceAccess` middleware gain step 1 automatically.  
Clinical routes (oncology, GLP-1, nutrition-strategy) run all four steps.

---

## Scope for Phase 3 — Audit Log

Based on this boundary, the audit log must capture:

| Trigger | Minimum fields to log |
|---|---|
| Any T1 field written | `actor_user_id`, `target_user_id`, `org_id`, `table`, `field_name`, `action` (UPDATE/INSERT), `timestamp` |
| T1 field read by non-owner | `actor_user_id`, `target_user_id`, `org_id`, `route`, `timestamp` |
| T2 write (coach-attributed) | `actor_user_id`, `target_user_id`, `org_id`, `table`, `action`, `timestamp` |
| Auth event | `user_id`, `event_type` (login/logout/token_issue/reset), `ip_address`, `timestamp` |
| Org isolation violation | `actor_user_id`, `actor_org_id`, `target_user_id`, `target_org_id`, `route`, `timestamp` |

The audit log must NOT store the value of the field changed — only that the field was changed and by whom. Exception: `guardrail_audit_log` and `glp1_audit_log` already store diffs for their specific domains and should be considered canonical for those fields.

Retention: 6 years minimum (HIPAA § 164.530(j)).

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-22 | v1.0 — Initial PHI boundary document. Covers all schema files as of Phase 1B enforcement completion. |
| 2026-05-22 | v1.1 — Phase 4 AI sanitization layer implemented. Added promptSanitizer, name removal from promptBuilder, T1 field detection and `AI_PROMPT_PHI` audit event in enforceBeforeGenerate. |
