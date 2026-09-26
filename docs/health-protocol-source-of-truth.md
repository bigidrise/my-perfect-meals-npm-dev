# Health-protocol source of truth — DEV migration plan

The Builder is a strategy for a food action, **not** a diagnosis or evidence of
current medication. A health protocol is a subject-owned state supported by
one or more independent sources. Active, inactive, historical, and unresolved
legacy claims must not be conflated. The pure resolver contract is in
`shared/healthProtocolState.ts` and `server/services/healthProtocols/`.
It is **not connected to live food generation yet**.

## Ownership rules to validate before activating persisted reads

- A user can end a user-owned support claim after confirmation. This does not
  delete the historical claim or another active source for the same protocol.
- A provider may end the provider claim they own during an authorized care
  relationship. A patient action cannot silently overwrite that provider
  claim; the patient must be shown the source and the route to review/dispute.
  On disconnect, its authority ends and the claim requires review. Food
  generation must not proceed with an unresolved claim: it cannot silently
  keep a stale provider directive or silently remove a clinically necessary
  protection.
- A raw lab signal is evidence, not an accepted protocol. An accepted lab
  recommendation may create a distinct source claim. Declining/discontinuing
  it must be recorded explicitly; old abnormal labs do not silently re-add it.
  Any still-current independent provider claim remains in effect.
- Verified current medication use is distinct from historical medication
  names and from voluntarily selecting GLP-1 nutrition support. A system
  suggestion requires acceptance before it becomes an active claim.
- The UI should expose *all* active sources and any review-required source,
  plus the outcome of an off action. An off action that removes only one source
  must explain why the protocol is still active.

These are target behaviors, **not a claim that current endpoints enforce them**.
Clinical ownership, patient disputes, and the review/confirmation workflow
require approval before write paths are switched over.

## DEV schema (additive tables applied; shadow-only)

Add `health_protocol_sources`: `id` (UUID), `subject_user_id`, canonical
`protocol_key`, `source_kind` (`user`, `provider`, `lab`, `medication`,
`system_recommendation`, `legacy_migrated`), `status` (`active`, `inactive`,
`historical`, `pending_review`), `owner_user_id` nullable,
`care_relationship_id` nullable, `evidence_ref` nullable, acceptance/current-use
evidence fields, `activated_at`, `ended_at`, `reviewed_at`, and timestamps.
Index by subject, protocol, source, and relationship. Do not assume one row
per protocol: multiple independent claims can coexist.

Add append-only `health_protocol_events` with source row ID, actor, old/new
status, reason code, and timestamp; restrict evidence references to valid
authorized rows. Provider/lab/medication source writes must have distinct
server-side authorization and evidence verification. No private clinical
values belong in generic application logs.

The DEV migration is explicit (`NODE_ENV=development npx tsx
scripts/migrate-health-protocols-dev.ts`), never an application boot migration.
It rejects non-DEV environments and creates an update/delete blocker on the
event table. Evidence references are verified by source-specific service
queries before writes; the generic reference is intentionally *not* a foreign
key because it spans different evidence tables. An authorization check at the
eventual HTTP boundary is still required before any write route is enabled.

No existing table or field is removed. Keep current `users` columns,
`glp1_profile`, clinical labs/recommendations, studio membership, and
preferences intact while adapters and consumers are migrated.

## Legacy mapping and backfill

| Existing representation | Proposed disposition |
| --- | --- |
| `selected_meal_builder` / `active_board` | Builder strategy only; never backfill a medical diagnosis or medication source. Reconcile conflicting values before switching reads. |
| `medical_conditions` | Create review-required legacy claims where a supported protocol is unambiguous as a *name*; never infer that an entry proves current medication use, especially GLP-1. Preserve original array. |
| `specialty_conditions` and singular `specialty_condition` | Deduplicate into review-required claims unless a trustworthy, scoped acceptance/owner event can establish source and active status. Preserve original values. |
| `health_conditions` | Retain as legacy health history/guidance; do not silently promote it to an active provider/lab claim. |
| Historical lab rows and recommendation rows | Retain evidence and decisions. An isolated abnormal row does not prove current active ownership; correlate explicit accepted/removed decisions and lab identity before backfilling an active source. |
| Existing provider assignments and memberships | Backfill provider claims only where a verifiable assignment, owner, and current relationship coincide. Revoked memberships must not become permanent active claims. |
| Anti-Inflammatory Support preference | User-owned optional overlay, not a diagnosis; distinguish from Anti-Inflammatory Builder and lab/specialty claims. |
| Performance mode/context | Preserve separate performance strategy and demand inputs; do not infer a medical diagnosis. |

Backfill in small idempotent DEV batches with a dry-run count and reviewed
sample categories, never by resetting arrays. Ambiguous records remain
`pending_review`; **no backfilled legacy entry is labeled verified current
medication**. Until explicit reconciliation, existing conservative safeguards
remain in the live legacy path. The new resolver returns no food decision when
a claim needs review; it must not be used for live reads until UI and blocking
behavior are ready. Avoid flipping only one route to the new source of truth.

**DEV Phase 2 shadow observation:** The exact-name backfill (dry-run, then
apply; rerunning adds zero) inserted 86 review-pending source claims and 86
creation events. Four are GLP-1; zero are verified-current medication, active
provider claims, or active lab claims. No builder selection was backfilled as
medical evidence. The read-only comparison uses the *same* GLP-1 activation
predicate as the live resolver and the pure shadow resolver: four legacy
GLP-1 activations have pending-review new claims, one legacy GLP-1
builder-only activation has no new medical source, and one legacy GLP-1 medical
signal overlaps an ended membership without proven current provider ownership.
Other aggregate mismatches: seven anti-inflammatory builder-only, 18
anti-inflammatory legacy conditions pending review, one renal pending review,
and ten cardiac pending review (overlap is possible). There are 34 accepted
recommendation rows with matching labs, but acceptance at one point does not
establish currentness or the absence of a later discontinuation; none were
automatically promoted. This is **not** a full legacy food-generation
comparison for non-GLP-1 protocols. It is not safe to enable new reads.

## Staged activation and rollback

1. **Completed first phase:** define and test the deterministic contract
   without schema changes, backfill, or live behavior changes. Inventory the
   food surfaces and verify the current timestamp fingerprint behavior.
2. Add additive DEV tables and append-only writes behind a disabled gate,
   instrument reconciliation, and implement authorized user/provider/lab
   mutations and explicit confirmation/review UI. Shadow-read against legacy
   behavior; do not use shadow rows to serve food.

    The schema, DEV-only service, conservative legacy backfill and bounded
    aggregate comparison are present. A DEV-only authenticated Health Context
    route and confirmation UI now allow a subject to review earlier profile
    entries, mark medication information past, and discontinue lab-based support.
    The paused personal-support screen also exposes pending legacy review.
    These choices remain shadow-only: no food consumer reads the tables.
    Unverified medication and system suggestions cannot activate themselves.
    A provider disconnect can mark its own source pending review without
    erasing another source. Provider-owned review and source-specific clinical
    food restrictions still need a verified care-team path before cutover.
3. Route all human-food, protocol envelope, GLP-1, and nutrition resolvers
   through a single authoritative snapshot. Verify Create a Dish, Craving,
   Dessert, Beverage, Sushi, Fridge Rescue (both routes), Recipe Scan,
   Restaurant/Fast Food, MPM and legacy Weekly Board, and nutrition-sensitive
   shopping *generation*; shopping-list CRUD is not food recommendation.
   Gate each surface on matching authority and fail closed on unresolved
   clinical claims. Preserve independent protections and per-subject scope.
4. After behavior and data reconciliation, enable new reads in DEV for
   reviewed accounts, confirm restoration and rollback, then separately plan
   any Production rollout. Do not remove old columns or medical history.

Rollback is an application feature flag returning reads to the unchanged
legacy pipeline. Disable new writes or dual-write safely before rollback;
retain additive tables and events for audit, not destructive reverse DDL.
Production is outside this plan's execution scope.
At this stage there is no food-read flag to flip: food reads remain entirely
legacy. The DEV review endpoint is not itself a food-read cutover. Before
connecting it, ensure every authenticated food path fails closed instead of
falling back to a guest envelope on a missing protocol, and verify that
provider-owned directives have exact, current, relationship-verified authority.
Stop invoking the DEV-only service/backfill to return to the pre-Phase-2 food
behavior, retaining the audit tables and original fields.

## Exact directives and review decisions — staged, not activated

An additive **shadow-only** layer is defined in
`server/db/schema/healthProtocolDirectives.ts` and the explicit migration
`scripts/migrate-clinical-directives-dev.ts`. It does not alter the existing
profile fields, clinical labs, source claims, or food consumers:

- `health_protocol_food_directives` stores immutable versions of typed food
  rules, bound to an exact subject, protocol, and source. Rules currently
  represent an exact ingredient avoidance or a measurable nutrient bound with
  unit and per-serving/per-day scope. Each has an effective time, optional
  expiry, and optional superseded version. A condition name and free-text
  provider note are **not** a rule.
- `health_protocol_review_decisions` stores append-only actor/time/reason
  decisions. A source can be retained as history, confirmed as current
  guidance, or left unresolved. A directive may be confirmed as a specific
  hard restriction, verified as provider-owned, or later marked historical.
  Database triggers reject updates/deletes and cross-subject/source links.
  An end or supersession appends a decision; it never erases the prior rule.
- The DEV-only internal service validates exact rule shape, subject ownership,
  and active verified clinic membership/recorded provider owner before
  recording a provider rule. It is **not an HTTP endpoint**: clinical training,
  consent, and role gates must be added before exposing provider writes.
  Subject decisions cannot change provider-owned claims. The read-only shadow
  loader rejects absent tables instead of treating missing evidence as empty.
- The pure `resolveClinicalMealAuthority` contract accepts health history,
  source records, directives, and decisions separately. Only an explicit,
  current, source-matched decision makes a typed rule a hard restriction.
  Pending or conflicting evidence yields a null shadow candidate. Even with
  reviewed inputs, `effectiveForFood` is **always null** until a separate,
  independently verified legacy/source completeness gate is implemented.
  It does not feed `protocolEnvelope`, Human Food Context, or any meal
  surface yet.

**Storage boundary:** Development and Production intentionally share the
project's external Neon database. The migration creates additive tables in
that shared schema; it is an explicit Development-only command requiring
both migration opt-in and shared-schema acknowledgement, not a boot migration
or a production application change. New application reads/writes remain
Development-gated and no production food consumer uses these tables.
The migration was applied after a read-only target preflight: the two new
tables and four identity/append-only triggers exist, and both new tables
were empty on verification. No account records were converted or edited.

Before any food-read activation, connect a complete authorized review path,
reconcile legacy names without guessing clinical instructions, validate the
actual production-effective authenticated routes (some currently fall back
to guest envelopes), and prove all major food surfaces and independent
allergy/GLP-1/Alpha-gal/pregnancy protections remain intact. Stop and report
at that gate rather than flipping one consumer at a time.

## Recipe intent and the existing 409

Keep 1–10 **total** servings and per-serving nutrition distinct. The
authenticated actor and nutrition subject remain separate concepts; future
`meal audience`/`cooking for` intent should distinguish personal portions
from a shared recipe rather than assuming every serving is eaten by the
account holder. No new family UI is introduced in the first phase.

The current One-Touch fingerprint already excludes `resolvedAt` and
`context.nutrition.provenance.calculationTimestamp`; its unit test covers
timestamp equality and substantive nutrition/protocol differences. A
route-level reproduction must still establish whether any 409 remains after
this code before changing the comparator or claiming a live fix.