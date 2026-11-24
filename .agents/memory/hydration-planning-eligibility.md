---
name: Hydration planning eligibility
description: Safety boundary between resolved Hydration context and any future numeric planning policy.
---

Planning eligibility has only three outcomes: eligible, withheld, or needs review. Eligibility never authorizes numeric output; the global numeric-planning permission remains disabled until a separately approved formula and safety policy exists.

**Why:** Resolver status filtering can discard withheld or expired claims, so validating only active claims creates a fail-open path. Legacy intake corrections can also retain a stable source ID, so identity-only snapshot hashes miss changed facts.

**How to apply:** Validate every supplied claim against the active registry and provenance requirements before resolution, regardless of runtime status. Accept only the approved registry governance version. Let the modifier resolver remain the sole owner of conflict and hard-stop classification. Fingerprint canonical intake with correction-sensitive payload provenance and reject cross-subject or tampered snapshots.

Eligibility must not interpret a withheld or expired supplied claim as evidence that its clinical context is safely absent. Return a review reason and preserve that claim's provenance even though the modifier resolver omits inactive claims.

**Why:** The resolver's active-only behavior is appropriate for resolution, but silently dropping stale context at the eligibility boundary would make incomplete inputs look plan-ready.

**How to apply:** Keep inactivity review in eligibility, not a second conflict resolver. Canonical snapshot callers supply only current effective events; deduplicate identical replays, reject conflicting identities, and scope events by their occurrence instant in the requested timezone rather than the legacy UTC date. Corrections and voids remain owned by the canonical intake source, never by eligibility.