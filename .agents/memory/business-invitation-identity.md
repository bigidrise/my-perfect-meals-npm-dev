---
name: Business invitation identity
description: Product and security rules for connecting Organization clients through invitations.
---

An Organization client invitation is the connector. Existing My Perfect Meals members sign in to their existing account; new recipients create a normal account while preserving the same invitation context. Both converge on one server-authoritative acceptance path that creates or restores the canonical Organization and ProCare relationship.

Never create a duplicate account for an existing identity, build separate relationship systems for existing and new recipients, trust client-submitted Organization or professional IDs, or overwrite an existing paid personal subscription.

**Why:** Professionals should not need to know whether a recipient already uses My Perfect Meals, and identity duplication would fragment billing, history, consent, and ProCare relationships.

**How to apply:** Bind invitations to normalized email and persisted Organization/inviter context. Put bearer tokens only in URL fragments, scrub them into session storage immediately, and inspect or accept them through headers or POST bodies so request URLs and logs never contain them. Preserve the token through login or signup, consume it idempotently, and keep client capacity separate from professional team seats.

## Public authentication remains independent of invitation capture

Missing or failed invitation capture must not disable normal sign-in or signup. Only invitation redemption requires the validated token; opening authentication never starts a pilot clock.

**Why:** The user encountered greyed-out buttons during a real Development Business Pilot test. A tokenless page can remain mounted when an invitation is reopened through fragment-only navigation, so initial page rendering is not sufficient evidence that a later invitation was captured.

**How to apply:** Preserve the same-document invitation lifecycle as well as fresh-document entry. Verify tokenless auth navigation and fragment-only reopening with synthetic tokens, without signing in, redeeming a real invitation, or writing shared account data.