# Clinical approval package: six held explanations

**Decision: pending. No clinician approval is recorded or inferred.**

This is a source-based review handoff, not clinical certification or an
end-to-end verification. Preserve all six explanations unchanged until a
qualified reviewer approves the exact text or requests revisions. Approval to
preserve this Git branch does not approve release.

## Source and review boundary

- Branch: `reconcile/dev-production-20261119`.
- Reconciliation parent: `f1bf5074da3cdddcd72f06d256ec34aac9156c68`.
- All six explanations match the GitHub Production source at
  `4a7a5338653904e9505ff99b62fe629c5ae43f64` verbatim.
- Their failures concern changes from the older protected registry. Prior
  shipment and the earlier provenance review are not qualified clinical approval.
- No clinical explanation, translation, authority rule or feature gate is
  changed by this package.

## Exact wording and approval questions

### 1. GlucoseGuard scope

**Source:** `client/src/pages/Learn.tsx:1431`

> Glucose-aware meal context across the platform

**Claim and observed implementation:** The heading claims broad product scope.
The shared food-context resolver conditionally resolves glucose for a
diabetes-active subject, excluding its explicit-household path
(`server/services/humanFoodContext/resolveHumanFoodContext.ts:372–376`).
This is evidence of conditional shared context, not proof that every surface
consumes it.

**Evidence needed:** A source-owner surface/subject matrix showing where glucose
is displayed, supplied to generation, or deliberately excluded; qualified
confirmation that “across the platform” accurately describes those boundaries.

### 2. GlucoseGuard operation

**Source:** `client/src/pages/Learn.tsx:1437`

> GlucoseGuard is a glucose-awareness feature available across the platform's meal builders and creation tools. When you log a blood glucose reading, the app can show your latest reading and pass that glucose context into meal generation.

**Claim and observed implementation:** The glucose resolver handles logged
readings, freshness and unavailable states
(`server/services/glucoseStateResolver.ts:75–96`). The shared prompt formatter
can include the resolved state and available numeric evidence
(`server/services/humanFoodContext/buildHumanFoodPromptBlock.ts:67–80`).
These observations do not certify every caller or establish clinical efficacy.

**Evidence needed:** Actual caller coverage; fresh/stale/missing-reading and
subject-isolation cases; a clear distinction between logged context and
continuous monitoring, diagnosis or treatment. Confirm the authorized boundary
for numeric glucose versus produce-preference context on each surface.

### 3. Starch Guard distinction and coexistence

**Source:** `client/src/pages/Learn.tsx:1450`

> Starch Guard is about weight management and limiting high-glycemic carbs. GlucoseGuard is about displaying and using logged glucose context across the platform. The two features can work together when a user's profile supports them.

**Claim and observed implementation:** This paragraph describes different
purposes and compatible combined operation. The shared prompt includes
glucose-state produce preferences and a narrowly scoped safety override
(`server/services/humanFoodContext/buildHumanFoodPromptBlock.ts:73–80`).
Combined Starch Guard behavior has not been established by that observation.

**Evidence needed:** Owner traces and representative cases with each feature
alone and both together, including conflict precedence and low-glucose safety.
Confirm that the weight-management/high-glycemic description is appropriate.
The older registry's truncated text is not a reason to approve this replacement.

### 4. Care-team review banner

**Source:** `client/src/pages/profile/EditProfilePage.tsx:1364–1366`

Heading:

> Clinical Protocol Review Required

Body:

> Your clinical settings include physician-directed or earlier clinical assignments. Contact your care team for review before changing them.

**Claim and observed implementation:** The UI reads `user.physicianLocked`
at line 361. The banner condition is at line 1359; condition controls also
consult that flag (including lines 1442 and 1454). This is not independent proof
of server-side authorization or the meaning of every earlier assignment.

**Evidence needed:** Authoritative lock resolution and server mutation checks
for an active physician relationship, historical assignment, disconnected care
team and ordinary trainer enrollment. Confirm the explanation without extending
or removing physician authority.

### 5. Legacy GLP-1 setting title

**Source:** `client/src/pages/profile/EditProfilePage.tsx:1571`

> Existing GLP-1 meal-generation guidance

**Claim and observed implementation:** The section is conditional on
`glp1Active` (line 1566), initialized from the existing `medicalConditions`
array (lines 310–312). `shared/healthProtocolState.ts:1–7` explicitly
distinguishes a legacy `glp1` value from evidence of current medication use.

**Evidence needed:** Confirm the legacy setting's actual meal-generation
consumers, its relationship to the Diabetic Builder and the appropriateness of
calling the resulting behavior “guidance.” Do not infer current medication use.

### 6. Legacy GLP-1 setting explanation

**Source:** `client/src/pages/profile/EditProfilePage.tsx:1572–1573`

> This older profile setting currently affects meal generation, including alongside a Diabetic Builder. It does not prove current medication use. Your separate nutrition support choice below does not yet change today's meals. Follow your clinician's guidance where applicable.

**Claim and observed implementation:** The profile save path explicitly keeps
new Development support choices separate from `medicalConditions`; its compiled
path retains legacy GLP-1 array handling
(`client/src/pages/profile/EditProfilePage.tsx:567–576`). Separate support
controls exist in `client/src/components/profile/HealthContextControls.tsx`.
This does not verify all generation consumers or both runtime experiences.

**Evidence needed:** Preview and compiled-runtime behavior, legacy versus
current-medication identity, Diabetic Builder interaction, optional support
activation boundaries, and the adequacy of clinician-directed language.
Confirm that “does not yet change today's meals” remains true in each intended
runtime. Preserve existing gates and physician restrictions.

## Reviewer return

For each numbered item, return **approve exact wording** or **request revision**,
with reviewer identity/qualification, date, source-owner corroboration, evidence
references and scope. If requesting a revision, identify the disputed claim;
do not treat this document as permission to implement it.

Any recorded decision must be bound to the reviewed source and exact text.
Source changes invalidate that decision until rechecked. No new disposition,
registry regeneration, automatic translation or gate exemption is authorized.

**Release dependency:** all six remain held. Separately resolve the protected
translations and ownership queue described in
`release-localization-review-batches.md`.
