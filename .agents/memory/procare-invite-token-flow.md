---
name: ProCare Invite Token Flow
description: Architecture for token-based ProCare studio invitation deep-links — eliminates manual code entry from the client experience.
---

## What was built

Email invitation button now carries a 32-char `urlToken` so clients never type the short code. The code stays as a ⚠️ fallback.

**New flow:** Email → "Accept ProCare Invitation →" → `/join/studio?token=XXX` → sign in/up → confirm "Join Studio" → connected.

**Fallback:** More → Connect with Access Code → `MP-XXXX-XXX` (unchanged).

## Schema changes

- `care_invite.url_token TEXT UNIQUE` — generated at invite creation time in `careTeamRoutes.ts`
- `studio_invites.url_token TEXT UNIQUE` — reserved for future studio-owner email flow
- Migration: `server/db/migrations/runProCareInviteTokenMigration.ts`
- **Import path for migrations**: `../../db` not `../db` (files live in `server/db/migrations/`)

## Key files

- `server/services/procareInviteService.ts` — canonical service; resolves both `care_invite` and `studio_invites` by token or code into `InviteResolution`
- `server/routes/procareInviteRoutes.ts` — GET (public) + POST/accept (per-route requireAuth)
- `client/src/pages/JoinStudio.tsx` — confirmation page; sessionStorage key `mpm.pendingStudioInviteToken`
- `server/services/emailService.ts` → `sendCareTeamInvite` now accepts `urlToken?`; CTA text changed to "Accept ProCare Invitation →"
- `client/src/pages/Auth.tsx` → `urlReturnTo` useMemo + redirect in `proceedAfterLogin` after `urlInvite` block

## Critical routing rule

`GET /api/procare-invite/token/:token` is public. It **must** be mounted BEFORE any `app.use("/api", requireAuth, someRouter)` catch-all in `routes.ts`. Express runs handlers in registration order; if a broad `app.use("/api", requireAuth, ...)` fires first, unauthenticated GET requests get 401 before reaching the public route. Current mount point: near line ~494, with the other public API routes (`/api/share`, `/api/promotions`).

## Security gates enforced at accept time

1. Email binding — `invite.invitedEmail` must match `users.email` for the authenticated user (fetched from DB, not request)
2. Client needs Clinical/Ultimate subscription (`accessTier === "PAID_FULL"` + tier `ultimate`)
3. Pro needs active ProCare plan (`PROCARE_PLAN_KEYS`)
4. Legal gate (`patient_physician` for clinic, `client` for studio)
5. Expiry + already-accepted checks

**Why:** The architect required explicit confirmation before connection (no silent auto-connect), strict email binding for clinical relationships, and a clear "wrong account" error if the email doesn't match.

## autoAcceptPendingInvites note

The existing `autoAcceptPendingInvites` function (runs at login by email match) is NOT suppressed. It still auto-connects careInvites by email at login. The new token flow is additive — token path shows the confirmation screen, code path is unchanged, and autoAccept remains the legacy path for users who log in directly.

## Email changes

- Subject now mentions "My Perfect Meals ProCare Studio/Clinic"
- Button: "Accept ProCare Invitation →" → deep links to `/join/studio?token=XXX`
- Body: explains existing-account and new-account paths separately
- Backup code section demoted to ⚠️ callout (not primary instructions)
- **Removed:** "you'll need to activate the ProCare (Ultimate) plan" warning (was incorrect for seat/trial/pilot entitlements)
- Invited email address shown explicitly in body as reminder
