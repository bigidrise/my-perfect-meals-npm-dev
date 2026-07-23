# Clinical Build Checklist — MyPerfectMeals Clinical Studio

> **Purpose:** Every protocol must pass this checklist before it is considered production-ready.
> This document is the source of truth for clinical feature completeness.

---

## Phase 1 — Clinical Foundation

**Status: ✅ COMPLETE**

### Pre-Phase 2 Gate (must all be ✅ before continuing)

- [x] Clinician dashboard opens without crash
- [x] Clinical Intervention Panel loads (GET `/api/pro/clients/:id/interventions` returns 200)
- [x] Provider can save interventions (PUT endpoint authenticated and working)
- [x] Selections persist on page refresh (304 cached — confirmed in logs)
- [x] Full reload retrieves persisted interventions
- [x] No console errors
- [x] No React errors

### Foundation Components

| Component | Status | Notes |
|---|---|---|
| `provider_clinical_interventions` DB table | ✅ | conditionKey, severity, notes, escalationFlag, isActive, timestamps |
| GET `/api/pro/clients/:id/interventions` | ✅ | Auth fixed — uses `authUser` field |
| PUT `/api/pro/clients/:id/interventions` | ✅ | Auth fixed — upsert with deactivation on `severity: "none"` |
| `ClinicalInterventionPanel` UI | ✅ | Tabbed (GI / Nutrition / Weight & Risk), severity pills, escalation banner, active summary |
| Protocol Envelope integration | ✅ | `buildInterventionPrompts()` — all 16 conditions wired to AI directives |
| AI prompt definitions (all 16 × 4 severities) | ✅ | `interventionPromptBuilder.ts` — hardLimits + optimization + patientSummary |
| Provider effect preview in panel | ✅ | Inline "what this changes" bullets appear when condition is active |
| `ClinicianClientDashboard` crash fix | ✅ | `resolvedClientUserId` TDZ bug fixed |
| `prod.ts` route parity | ✅ | `clinicalInterventionsRouter` mounted in both `routes.ts` and `prod.ts` |

---

## Phase 2 — Recommendation Pack Validation

**Status: ⏳ Not Started**

> For each intervention, verify that every AI feature behaves correctly when that intervention is active.
> Mark each cell ✅ when confirmed passing, 🔲 when not yet tested, ❌ when failing.

### GI Symptoms

| Condition | Meal Builder | Weekly Board | Recipe Scan | Restaurant Guide | Shopping List | Coach's Corner |
|---|---|---|---|---|---|---|
| Nausea (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Nausea (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Nausea (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Vomiting (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Vomiting (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Vomiting (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Constipation (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Constipation (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Constipation (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Diarrhea (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Diarrhea (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Diarrhea (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Early Fullness (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Early Fullness (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Early Fullness (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Reduced Appetite (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Reduced Appetite (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Reduced Appetite (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Reflux (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Reflux (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Reflux (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Food Aversion (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Food Aversion (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Food Aversion (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |

### Nutrition & Metabolic

| Condition | Meal Builder | Weekly Board | Recipe Scan | Restaurant Guide | Shopping List | Coach's Corner |
|---|---|---|---|---|---|---|
| Poor Hydration (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Poor Hydration (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Poor Hydration (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Low Protein (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Low Protein (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Low Protein (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Low Calories (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Low Calories (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Low Calories (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Lean-Tissue Risk (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Lean-Tissue Risk (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Lean-Tissue Risk (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Fatigue (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Fatigue (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Fatigue (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Blood Glucose Concerns (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Blood Glucose Concerns (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Blood Glucose Concerns (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |

### Weight & Medication Management

| Condition | Meal Builder | Weekly Board | Recipe Scan | Restaurant Guide | Shopping List | Coach's Corner |
|---|---|---|---|---|---|---|
| Rapid Weight Loss (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Rapid Weight Loss (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Rapid Weight Loss (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Transitioning Off Medication (mild) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Transitioning Off Medication (moderate) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| Transitioning Off Medication (severe) | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |

---

## Phase 3 — System-Wide Wiring

**Status: ⏳ Not Started**

> Verify that ONE intervention selection changes behavior in ALL of the following systems.

| Feature | Reads Protocol Envelope | Honors Interventions | Tested |
|---|---|---|---|
| Create a Dish | ✅ (via protocolEnvelope) | 🔲 | 🔲 |
| Chef's Kitchen | ✅ | 🔲 | 🔲 |
| Snack Creator | ✅ | 🔲 | 🔲 |
| Beverage Creator | ✅ | 🔲 | 🔲 |
| Craving Creator | ✅ | 🔲 | 🔲 |
| Fridge Rescue | ✅ | 🔲 | 🔲 |
| Weekly Meal Board | ✅ | 🔲 | 🔲 |
| Holiday Feast | ✅ | 🔲 | 🔲 |
| Recipe Scan | 🔲 | 🔲 | 🔲 |
| MacroScan | 🔲 | 🔲 | 🔲 |
| Restaurant Guide | 🔲 | 🔲 | 🔲 |
| Fast Food Guide | 🔲 | 🔲 | 🔲 |
| Shopping List | 🔲 | 🔲 | 🔲 |
| Saved Meals | 🔲 | 🔲 | 🔲 |
| Coach's Corner | 🔲 | 🔲 | 🔲 |

---

## Phase 4 — Clinical Governance

**Status: ⏳ Not Started**

> Every protocol needs supporting documentation and evidence.

### Per-Protocol Documentation Checklist

| Condition | Clinical Purpose | AI Behavior | Evidence Sources | Contraindications | Version | Review Date |
|---|---|---|---|---|---|---|
| Nausea | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Vomiting | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Constipation | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Diarrhea | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Early Fullness | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Reduced Appetite | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Food Aversion | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Reflux | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Poor Hydration | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Low Protein | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Low Calories | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Lean-Tissue Risk | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Fatigue | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Blood Glucose Concerns | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Rapid Weight Loss | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |
| Transitioning Off Medication | 🔲 | 🔲 | 🔲 | 🔲 | 1.0 | — |

---

## Phase 5 — End-to-End Validation

**Status: ⏳ Not Started**

> A protocol is only "production-ready" when every row below is ✅.

### Validation Suite Template (per condition)

**Meal Generation**
- [ ] Meal size adjusts correctly for the severity level
- [ ] Macro profile matches the intervention directive
- [ ] Prohibited foods are absent
- [ ] Appropriate foods are present

**Recipe Scan**
- [ ] Warnings appear when a scanned meal conflicts with active intervention
- [ ] Alternative suggestions are appropriate

**Restaurant Guide**
- [ ] High-conflict options are ranked lower
- [ ] Better-tolerated options appear first

**Shopping List**
- [ ] Ingredient choices reflect the intervention protocol

**Weekly Meal Board**
- [ ] Generated weekly plan honors the intervention

**Coach's Corner**
- [ ] Guidance explains adjustments in patient-friendly language
- [ ] No contradictory advice

---

## Phase 6 — Specialty Expansion

**Status: ⏳ Planned**

> Once the engine is proven through Phases 2–5, new specialties add new protocols — not new architecture.

| Specialty | Status |
|---|---|
| GLP-1 / Weight Loss | ✅ (Phase 1 foundation built) |
| Oncology Support | ✅ (existing separate system) |
| Diabetes | ✅ (existing separate system) |
| Anti-Inflammatory | ✅ (existing separate system) |
| Pregnancy | ✅ (existing separate system) |
| Performance Nutrition | ✅ (existing separate system) |
| Cardiology | ⏳ Planned |
| Renal | ⏳ Planned |
| Bariatrics | ⏳ Planned |
| Pediatrics | ⏳ Planned |
| Functional Medicine | ⏳ Planned |

---

## Definition of "Done" — Per Protocol

A protocol is only complete when ALL of the following are checked:

- [ ] **Database** — condition stored and retrievable
- [ ] **API** — GET and PUT endpoints authenticated and working
- [ ] **Clinician UI** — severity selection visible, saves immediately, shows effect preview
- [ ] **Protocol Envelope** — intervention loaded and injected into AI directive hierarchy
- [ ] **AI prompt integration** — hardLimits and optimization defined for all 4 severities
- [ ] **Provider effect preview** — panel shows what will change when condition is selected
- [ ] **App Library documentation** — purpose, AI behavior, contraindications documented
- [ ] **Medical references** — supporting evidence sources listed
- [ ] **System-wide validation** — all 7 AI features tested with this intervention active
- [ ] **End-to-end test** — automated test confirms behavior before and after intervention

---

*Last updated: July 23, 2026 — Phase 1 complete.*
*Maintained by: Engineering team. Update after each phase milestone.*
