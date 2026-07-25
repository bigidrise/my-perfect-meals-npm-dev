---
name: ProCare Physician Legal Policy — Architecture & Bypass Paths
description: Legal acceptance policy for patient-physician connections; which paths had the bypass bug and how it was fixed.
---

## Rule
Every path that calls `activateProCareClient()` for a physician connection must first call `checkLegalAcceptance(userId, "patient_physician")`. No route may skip this gate.

**Why:** `inviteAutoAccept.ts` called `activateProCareClient` at login/signup without any legal check. This created the July 24 studioMembership+clientLinks without patient documents, then the normal reconnect route hit the legal gate for the first time and blocked with 409.

## Compliant paths (gate enforced)
- `POST /api/care-team/connect` (careTeamRoutes.ts) — invite + access code branches both check legal before activation
- `PATCH /:studioId/studio-invite` (studioRoutes.ts) — checks legal at line 353
- `PATCH /:studioId/clients/:clientUserId/restore` (studioRoutes.ts) — added legal check for `studio.type === "clinic"` after this fix

## Fixed bypass paths
- `autoAcceptPendingInvites()` in `inviteAutoAccept.ts` — careInvite path now looks up pro's professionalRole; studioInvite path checks studio.type. Both skip activation and return `{ accepted: false }` when legal is missing.
- `selfHealProCareState()` in `procareActivation.ts` — now checks legal before inserting a new clientLinks row for physician connections.

## Policy
- Accept once per document type+version. Disconnect/archive/restore never re-prompts if versions match.
- Re-prompt only when a new required document is added OR a document's version bumps.
- `selfHeal` may repair technical row gaps but must NOT create a brand-new legal relationship.

## careTeamMember lifecycle
- `deactivateProCareClient` now sets careTeamMember status='revoked' for the matching userId+proUserId
- `activateProCareClient` restore branch sets careTeamMember status='active' for the same pair
- Boot migration reconciles stale active careTeamMember rows where studioMembership is revoked

## clientLinks integrity
- Schema: no `updatedAt` column (only `boardControlUpdatedAt`). All `.set({ updatedAt })` calls on clientLinks removed.
- Unique index `idx_client_links_unique_pair` ON (client_user_id, pro_user_id) added via boot migration in both index.ts and prod.ts.
- Boot migration also deduplicates existing rows (prefer active row, else most recent created_at).
- `careAccessCode.maxUses`: field exists in schema but is never read or enforced. Clearly deprecated in schema comment. Table is empty.

## How to apply
Any new route or service that connects a patient to a physician MUST call `checkLegalAcceptance(clientUserId, "patient_physician")` and return a 409 with `code: "LEGAL_ACCEPTANCE_REQUIRED"` before calling `activateProCareClient`. Reconnect/restore/repair paths pass this check silently because the docs are already on record.
