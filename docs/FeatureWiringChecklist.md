# Feature Wiring Checklist

This document tracks whether features are properly wired and functional. A feature is only considered "complete" when all wiring checkpoints are verified.

---

## Clinical Advisory System V1

### User-Facing (Macro Calculator)

| Component | Exists | Wired | Where Executes | Who Triggers |
|-----------|--------|-------|----------------|--------------|
| MetabolicConsiderations component | YES | YES | `client/src/pages/MacroCounter.tsx` | User interaction |
| Advisory toggle persistence | YES | YES | `localStorage` via `clinicalAdvisory.ts` | On toggle change |
| Delta calculation | YES | YES | `calculateAdvisorySuggestions()` in `clinicalAdvisory.ts` | On render |
| Preview dialog | YES | YES | Internal component state | "Preview Changes" button |
| Apply confirmation | YES | YES | `onApplyAdjustments` callback | "Apply" button |
| Macro target update | YES | YES | `setMacroTargets()` in `dailyLimits.ts` | Save button |

### Clinician-Facing (ProCare Dashboard)

| Component | Exists | Wired | Where Executes | Who Triggers |
|-----------|--------|-------|----------------|--------------|
| ClinicalAdvisoryDrawer | YES | YES | `client/src/pages/pro/ProClientDashboard.tsx` | Clinician interaction |
| Advisory toggle persistence | YES | YES | `proStore` via `proData.ts` | On toggle change |
| Delta calculation | YES | YES | `calculateSuggestions()` in drawer | On render |
| Stage changes button | YES | YES | Internal component state | "Stage Changes" button |
| Apply to Targets button | YES | YES | `onApplySuggestions` callback | "Apply to Targets" button |
| Audit logging | YES | YES | Console log + `createAuditEntry()` | On apply |

---

## Shared Clinical Advisory Module

**File:** `client/src/lib/clinicalAdvisory.ts`

| Function | Purpose | Used By |
|----------|---------|---------|
| `ADVISORY_DEFINITIONS` | Condition definitions with delta percentages | MetabolicConsiderations, ClinicalAdvisoryDrawer |
| `calculateAdvisorySuggestions()` | Compute gram deltas from targets | MetabolicConsiderations |
| `aggregateDeltas()` | Sum multiple condition deltas | MetabolicConsiderations |
| `loadUserAdvisory()` | Load user toggles from localStorage | MetabolicConsiderations |
| `saveUserAdvisory()` | Save user toggles to localStorage | MetabolicConsiderations |
| `createAuditEntry()` | Create audit log entry | ClinicalAdvisoryDrawer |

---

## Hub Coupling Framework

| Module | File | Wired | Triggers |
|--------|------|-------|----------|
| diabeticHubModule | `server/services/hubCoupling/hubModules/diabetic.ts` | YES | Meal generation for diabetic users |
| glp1HubModule | `server/services/hubCoupling/hubModules/glp1.ts` | YES | Meal generation for GLP-1 users |
| antiInflammatoryHubModule | `server/services/hubCoupling/hubModules/antiInflammatory.ts` | YES | Meal generation for anti-inflammatory diet |
| competitionProHubModule | `server/services/hubCoupling/hubModules/competitionPro.ts` | YES | Meal generation for competition prep |

---

## NOT WIRED (Deferred)

| Feature | Status | Notes |
|---------|--------|-------|
| Post-Hysterectomy condition | NOT WIRED | Documented in ProductEvolutionLedger. Requires V2 implementation. |
| Dyslipidemia condition | NOT WIRED | Documented in ProductEvolutionLedger. Requires V2 implementation. |
| Copilot explanation nodes | PLANNED | Not yet added to Macro Calculator or ProCare Dashboard |

---

## Verification Steps

Before marking Clinical Advisory as complete:

1. [ ] Toggle a condition in Macro Calculator
2. [ ] Verify preview shows correct delta values
3. [ ] Confirm "Apply" updates displayed macros
4. [ ] Save macros and verify they persist
5. [ ] Toggle condition in ProCare Dashboard
6. [ ] Verify Stage → Apply flow works
7. [ ] Check console for audit log entry
8. [ ] Confirm no auto-application occurs
