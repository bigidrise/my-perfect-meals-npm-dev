# Clinical Intelligence Governance

**Platform:** My Perfect Meals  
**Document Type:** Master Governance Reference  
**Status:** Active  
**Last Reviewed:** 2025-07-26  
**Maintained By:** Engineering + Clinical Advisor  
**Review Cycle:** Annual, or on major FDA label update / new consensus publication

---

## Purpose

This document is the authoritative reference for how My Perfect Meals generates, governs, and maintains nutrition recommendations that touch clinical territory — particularly GLP-1 / metabolic medication support.

It answers:

- Where do our recommendations come from?
- Which sources are authoritative?
- How are rules approved for use?
- How are rules updated or removed?
- Which recommendations are baseline (all users)?
- Which recommendations are clinic-configurable?
- How are source changes tracked?
- How often are sources reviewed?

Any engineer, clinical partner, physician, or enterprise reviewer should be able to read this document and understand exactly how the platform's clinical intelligence layer works.

---

## 1. The Two Layers of Clinical Intelligence

### Layer 1 — MPM Baseline Guidance

These are the recommendations that apply to any user who has a given health profile or condition, regardless of whether they are connected to a clinic or provider.

**Characteristics:**
- Directional only — no hardcoded clinical percentages or specific numerical thresholds
- Based exclusively on publicly available sources: FDA prescribing information, peer-reviewed consensus, and institutional guidelines
- Conservative by design — we favor "avoid high fat" over "cap fat at 12g" unless a provider sets that cap
- Every rule must have at least one approved source in the Rule Registry before it reaches users

**Examples:**
- Smaller meal portions when nausea is reported (directional, not a specific kcal value)
- Lower-fat meals for GLP-1 users (directional, fat ceiling set by provider guardrails or macro calculator)
- Hydration emphasis when vomiting or diarrhea is reported
- Protein priority for lean mass preservation

### Layer 2 — Clinic-Configured Protocol

These are parameters that a clinic, physician, or registered dietitian sets for their patient population. They layer on top of the MPM baseline and can make rules more restrictive — never less restrictive.

**Characteristics:**
- Numerical thresholds the clinic takes ownership of (protein floor, fat ceiling, calorie targets, hydration goals)
- Stored in `glp1_profile.guardrails` as clinic-assigned values
- Cannot override the MPM baseline safety limits (e.g., a clinic cannot disable escalation for vomiting)
- Subject to the clinic's own clinical review process, not MPM's

**Examples:**
- Protein floor of 35g per meal for a specific bariatric program
- Fat ceiling of 8g per meal for a post-op patient
- Custom escalation message wording approved by the clinic's care team
- Hydration goal of 3,000 mL/day for a specific patient

---

## 2. The Rule Registry

All clinical rules live in `server/services/glp1/ruleRegistry.ts`.

Each rule carries:

| Field | Description |
|---|---|
| `ruleId` | Unique slug. Never renamed once approved — rename breaks audit trail. |
| `description` | Plain English statement of what the rule does |
| `sourceIds[]` | One or more entries from the Source Catalog |
| `evidenceLevel` | `fda_label` / `peer_reviewed_consensus` / `institutional_guideline` / `expert_opinion` / `uncited` |
| `reviewStatus` | `approved` / `pending_review` / `removed` |
| `lastReviewedDate` | ISO date of last review |
| `governanceNote` | Explains limitations, caveats, or required pairing conditions |

### Evidence Level Hierarchy

| Level | Definition | Can ship? |
|---|---|---|
| `fda_label` | Direct citation from FDA prescribing information | ✅ Yes |
| `peer_reviewed_consensus` | Published consensus paper or systematic review | ✅ Yes |
| `institutional_guideline` | Published guidelines from a named institution (AGA, AND, NIDDK, etc.) | ✅ Yes |
| `expert_opinion` | Clinical advisor recommendation, not yet in literature | ⚠️ Ships with pending_review flag |
| `uncited` | No identified source | ❌ Must not reach users |

### Review Status

| Status | Meaning | Enforcement |
|---|---|---|
| `approved` | Source reviewed, rule is production-ready | Can be used in resolver without restriction |
| `pending_review` | Rule exists in code; clinical review required before production | Resolver must flag output; cannot be shown to users without clinic override |
| `removed` | Rule was in the system; now removed. Kept for audit trail. | Must not appear in any active resolver logic |

---

## 3. The Source Catalog

All sources cited by rules live in `server/services/glp1/ruleRegistry.ts` under `SOURCE_CATALOG`.

Each source carries:

| Field | Description |
|---|---|
| `sourceId` | Unique identifier. Never renamed. |
| `title` | Full document title |
| `organization` | Issuing organization |
| `year` | Publication or most recent revision year |
| `url` | Direct link to source document |
| `drives[]` | Platform surfaces this source's rules influence |

This drives the user-facing Medical Sources page. Every entry in the Sources page has a corresponding `sourceId` in the catalog.

### Currently Approved GLP-1 Sources

| Source ID | Document | Drives |
|---|---|---|
| `FDA_SEMAGLUTIDE_PI_2025` | FDA Ozempic/Wegovy Prescribing Information | GLP-1 Builder, Grocery Coach, Snack Creator, Beverage Creator, Coach's Corner, Restaurant Guide, Smart Scan, Daily Tolerance Check-in, Escalation |
| `FDA_TIRZEPATIDE_PI_2025` | FDA Mounjaro/Zepbound Prescribing Information | Same as above |
| `PMID_36614945` | GI Adverse Event Management Consensus — Gut 2023 | GLP-1 Builder, Snack Creator, Meal Builders, Grocery Coach, Beverage Creator, Daily Tolerance Check-in |
| `NIDDK_GASTROPARESIS` | NIDDK Gastroparesis: Symptoms & Causes | GLP-1 Builder, Grocery Coach, Coach's Corner, Smart Scan |
| `AND_GLP1_NUTRITION` | Academy of Nutrition and Dietetics — Weight Management | GLP-1 Builder, Beverage Creator, Meal Builders, Grocery Coach |
| `AGA_GI_MANAGEMENT` | American Gastroenterological Association | Daily Tolerance Check-in, GLP-1 Builder, Coach's Corner, Escalation |

---

## 4. What Requires Clinical Review Before Production

The following items are in the codebase with `pending_review` status and require a registered dietitian or physician review before going live to end users:

### Escalation Message Wording

The escalation messages triggered by vomiting or significant dehydration difficulty need word-for-word clinical approval. The trigger logic (vomiting = escalate, dehydration difficulty = escalate) is FDA-supported. The exact wording must be reviewed.

**Draft wording (not yet approved):**
> "Based on what you've reported, we recommend contacting your care team before your next meal. If you're unable to keep fluids down, please seek guidance today."

### Intro Phase Calorie Multiplier (0.82×)

- The direction (fewer calories during intro/up-titration) is supported by peer-reviewed consensus.
- The specific coefficient (0.82×) is an engineering estimate with no direct clinical source.
- This must be reviewed by a dietitian before being applied to users without explicit provider guardrails.

### Appetite Suppression Calorie Multiplier (0.80×)

- The direction (lower calories when appetite is suppressed) is FDA-documented.
- The specific coefficient (0.80×) is an engineering estimate.
- Same review requirement as the intro phase multiplier.

### Default Protein Floor (15g baseline fallback)

- Protein priority is fully supported.
- The specific 15g floor when no macro target exists is a conservative engineering default.
- A registered dietitian should confirm this is appropriate as a fallback for users with no macro plan.

---

## 5. Removed Rules — Audit Trail

These rules existed in design documentation or early implementation. They have been explicitly rejected and must not appear in any active resolver code.

| Rule ID | What it was | Why removed |
|---|---|---|
| `glp1_portionScale_0_65` | Automatic 65% calorie reduction for nausea | No source. Replaced by directional flag. |
| `glp1_maxFatAdjustmentG_minus5` | Automatic -5g fat adjustment beyond provider cap | No source. Fat ceiling is provider-configured. |
| `glp1_three_symptoms_escalate` | "3 severe symptoms = escalate" threshold | No source for count trigger. Replaced by type-based escalation. |
| `glp1_48h_injection_window` | Automatic 48-hour post-injection restriction period | No source. Pharmacokinetics vary by drug and patient. |

---

## 6. How Rules Are Added

1. **Identify the clinical behavior** — what should the platform do, and for which users?
2. **Find the source** — locate the FDA label, peer-reviewed paper, or institutional guideline. If no source exists, the rule cannot be approved.
3. **Add to Source Catalog** — add a new entry to `SOURCE_CATALOG` in `ruleRegistry.ts` if the source is not already registered.
4. **Add to Rule Registry** — add a new `ClinicalRule` entry with `reviewStatus: "pending_review"` initially.
5. **Clinical review** — share the rule and source with a clinical advisor, RD, or physician.
6. **Promote to approved** — update `reviewStatus` to `"approved"` and set `lastReviewedDate`.
7. **Update Medical Sources page** — if the source is new, add it to the `MedicalSourcesInfo.tsx` GLP-1 section.
8. **Update this document** — reflect the new rule in the appropriate section.

---

## 7. How Rules Are Updated or Removed

- **FDA label update:** Re-evaluate all rules citing the affected source. Update `lastReviewedDate`.
- **New consensus paper:** Evaluate whether existing rules need strengthening, weakening, or removal. Update source IDs.
- **Clinical partner feedback:** If a clinic's physicians identify a rule that conflicts with their clinical protocols, log it in governance note and initiate review. Do not remove rules for a single clinic without broader review.
- **Removal:** Set `reviewStatus: "removed"`. Keep the entry in the registry for audit purposes. Never delete removed rules.

---

## 8. Source Review Schedule

| Trigger | Action |
|---|---|
| Annual (July each year) | Review all `lastReviewedDate` fields. Flag any source older than 24 months. |
| FDA label update for Ozempic, Wegovy, Mounjaro, or Zepbound | Review all rules citing that source within 30 days |
| New peer-reviewed GLP-1 GI management paper | Evaluate against active rules within 60 days |
| Enterprise clinic onboarding | Clinical team reviews all approved rules before clinic goes live |
| Escalation event in production | Immediate review of the escalation trigger rule |

---

## 9. What a Clinic Sees vs. What MPM Controls

| Aspect | MPM Controls | Clinic Configures |
|---|---|---|
| Which symptoms are recognized | ✅ | ❌ |
| Escalation trigger type (vomiting, dehydration) | ✅ | ❌ |
| Escalation message wording | ✅ (reviewed wording) | ✅ (clinic may customize) |
| Protein priority direction | ✅ | ❌ |
| Fat-lower direction | ✅ | ❌ |
| Protein floor (specific grams) | Default only | ✅ Clinic sets |
| Fat ceiling (specific grams) | Default only | ✅ Clinic sets |
| Hydration goal (mL/day) | Default only | ✅ Clinic sets |
| Calorie targets | Macro calculator | ✅ Clinic overrides |
| Ingredient block lists | ✅ Baseline | ✅ Clinic can add |

---

## 10. Contact for Clinical Questions

If a clinical partner, physician, or enterprise reviewer has questions about a specific rule or source, the primary reference is:

1. This document
2. `server/services/glp1/ruleRegistry.ts` — the machine-readable authority
3. The Medical Sources page in the app — the user-facing reference

For rule changes that require clinical review, initiate a documented review session with a licensed RD or physician and update `lastReviewedDate` upon completion.
