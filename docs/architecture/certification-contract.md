# Certification Contract

> **Status:** Active — do not simplify or consolidate without reading this document first.

---

> **Architecture Decision (ADR Summary)**
>
> We intentionally separate **gate evaluation** from **certification record retrieval**.
>
> - Gate endpoints answer **"Can this user proceed?"**
> - Progress endpoints answer **"What is the state of this certification?"**
>
> These responsibilities must remain separate. Do not repurpose one endpoint for the other.

---

## 1. Purpose

There are two distinct operations the certification system performs, and they must never be conflated:

- **Displaying a certification record** — "What is the state of this user's specific cert?"
- **Making a gate decision** — "Has this user satisfied the Phase 1 requirement?"

These are different questions answered by different endpoints. Mixing them caused repeated review cycles. This document is the contract that prevents that from recurring.

---

## 2. Certification Types

| Type | Meaning |
|---|---|
| `platform_mastery` | Canonical Academy / Platform Mastery certification. Earned by all new users who complete the 8-module curriculum. |
| `platform` | Legacy certification type. Created before the Academy was introduced. Supported only through the compatibility bridge described in §5. |
| `affiliate_social` | Business Success Certification. Part of the Affiliate Coaching path (separate from Academy). |
| `procare_training` | ProCare Training (Phase 2). Separate from Platform Mastery. |

### The `is_certification_track` flag

The `is_certification_track` boolean column on `user_certifications` identifies legacy `platform` records that represent Academy completions (not ProCare training completions). This is the only safe way to distinguish the two uses of the old `platform` type.

- `platform` + `is_certification_track = true` → old Academy completion → counts toward Phase 1
- `platform` + `is_certification_track = false` → ProCare training record → does NOT count toward Phase 1

---

## 3. API Contracts

### `GET /api/certifications/:certType/progress`

- **Returns:** The certification record of the exact requested type for the authenticated user.
- **Use for:** Displaying a specific certification's status in the UI.
- **Do not use for:** Gate decisions. This endpoint is intentionally strict — it returns one type only.

Examples:
- `/certifications/platform/progress` → ProCare training cert (used in LearningHub Phase 2 card)
- `/certifications/platform_mastery/progress` → Academy cert record

### `GET /api/certifications/phase1-status`

- **Returns:** `{ phase1Complete: boolean, certification: CertStatus | null }`
- **Use for:** Phase 1 gate decisions only.
- **Do not use for:** Displaying a specific certification. The returned `certification` is the "best" matching record for display context, not a strict type lookup.

---

## 4. Gate Predicate

Phase 1 is satisfied when the user has a **completed** record matching either condition:

```
(certificationType = 'platform_mastery')
OR
(certificationType = 'platform' AND is_certification_track = true)
```

This predicate is enforced in two places and must remain identical in both:

1. `GET /api/certifications/phase1-status` (client-facing check)
2. `server/middleware/requirePhase1Cert.ts` (server-side route guard)

**Rule:** If the Phase 1 requirement changes, update both files in the same commit. Never update one without the other.

---

## 5. Migration Strategy

### What the bridge does

The boot migration (run on every startup, idempotent) finds existing `platform` records with `is_certification_track = true` and creates corresponding `platform_mastery` records for those users, stamping `certificate_number` with the prefix `cert-type-bridge-v1:` to mark them as bridged rows.

### Rollback

The standalone script at `scripts/migrate-cert-type-bridge.ts` has a `down()` function that deletes only rows with the `cert-type-bridge-v1:` prefix. Running `down()` fully reverses the bridge without touching any other certification records.

### Going forward

- New Academy completions create `platform_mastery` records.
- The `platform` type is legacy-only. No new code should create `platform` records for Academy completions.
- ProCare training completions (`platform` without cert-track flag, or `procare_training`) are unaffected by this migration.

---

## 6. Usage Matrix

| Component | Endpoint / Source | Purpose |
|---|---|---|
| Phase 1 gates (Router, WorkspaceChooser, ProLaunchpad, etc.) | `/api/certifications/phase1-status` | Gate: can user proceed? |
| `requirePhase1Cert.ts` | DB query with same `or()` predicate | Server-side gate enforcement |
| `ProfessionalOnboardingBridge` — Phase 1 step entry | Navigates to `/academy/platform-mastery` | Sends users to the correct Academy flow |
| `LearningHub` — Phase 2 ProCare card | `/certifications/platform/progress` | Displays ProCare training cert (Affiliate path) |
| `LearningHub` — Phase 1 Business Success card | `/certifications/affiliate_social/progress` | Displays Business Success cert (Affiliate path) |
| `AcademyLandingPage`, `BusinessCenter` | `/api/certifications/phase1-status` | Gate: Academy access |
| Admin cert tools | Appropriate endpoint per purpose (display → `/progress`, gate → `phase1-status`) | Depends on intent |

---

## 7. Developer Rules

1. **Don't use `/progress` for gate decisions.** It is strict by design and will not catch both cert types.
2. **Don't add client-side gate predicates.** All Phase 1 gating goes through `phase1-status`. The client renders based on the response — it does not re-implement the predicate.
3. **Don't create `platform` records for new Academy completions.** Use `platform_mastery`.
4. **Keep the predicate in sync.** `phase1-status` and `requirePhase1Cert.ts` must always use the identical logic. If one changes, the other changes in the same commit.
5. **Don't remove the `is_certification_track` filter from the gate predicate.** It is what prevents ProCare training records from falsely satisfying the Phase 1 Academy gate.
