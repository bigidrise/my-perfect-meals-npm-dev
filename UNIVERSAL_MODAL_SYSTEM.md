# Universal Modal System

> **A modal is a container, not a layout.**
>
> `DialogContent` is the shell that holds your UI — it is never the place where you also _build_ the UI.

---

## The One Rule

**No new modal may be created by importing `DialogContent` directly.**

The only file in this codebase allowed to import `DialogContent` is:

```
client/src/components/ui/universal-modal.tsx
```

Every other modal **must** import one of the six typed components:

| Type | Import |
|---|---|
| Confirmation | `import { ConfirmationModal } from "@/components/ui/universal-modal"` |
| Form | `import { FormModal } from "@/components/ui/universal-modal"` |
| Picker | `import { PickerModal } from "@/components/ui/universal-modal"` |
| Information | `import { InformationModal } from "@/components/ui/universal-modal"` |
| Workflow | `import { WorkflowModal } from "@/components/ui/universal-modal"` |
| Wizard | `import { WizardModal } from "@/components/ui/universal-modal"` |

This becomes enforceable in code review. The goal: **"Why does this modal work but that one doesn't?" becomes impossible.**

---

## Philosophy

### Why This System Exists

The app accumulated 56 independently-evolved modals. Each author solved layout, scroll, and mobile behavior ad hoc. The result: layout drift, the `grid` base-class conflict, inconsistent mobile behavior, and headers that scroll away.

The root cause: people treated `DialogContent` as a canvas:

```tsx
// ❌ What caused the drift — DialogContent as a layout surface
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
  <div className="flex-1">...</div>
  <div className="flex justify-end">...</div>
</DialogContent>
```

The fix: `DialogContent` is the shell. The system controls its layout. The consumer provides content.

```tsx
// ✅ The new model — DialogContent is the container, FormModal owns the layout
<FormModal open={open} onOpenChange={setOpen} title="Edit Profile" footer={<SaveButton />}>
  <div className="space-y-4">...</div>
</FormModal>
```

### The `grid` Base-Class Bug (Now Fixed)

The Radix `DialogContent` primitive in `dialog.tsx` previously had `grid gap-4` in its base class. Tailwind's compiled CSS order means `grid` always wins over a `flex` override from the consumer's `className`. This silently broke every modal that tried to use `flex flex-col` for its layout.

**Fix applied:** `grid` and `gap-4` are removed from `dialog.tsx`. The base class is now layout-neutral.

---

## The Six Types

### 1. `ConfirmationModal`

**Use for:** Delete confirmation, save prompts, dangerous-action warnings, yes/no questions.

**Layout:** `max-w-sm`. No scroll body. Footer stacks on mobile.

```tsx
<ConfirmationModal
  open={open}
  onOpenChange={setOpen}
  title="Delete this meal?"
  description="This action cannot be undone."
  footer={
    <>
      <button onClick={() => setOpen(false)}>Cancel</button>
      <button onClick={handleDelete} className="bg-red-600 text-white ...">Delete</button>
    </>
  }
>
  <p>The meal "Grilled Salmon" will be permanently removed.</p>
</ConfirmationModal>
```

---

### 2. `FormModal`

**Use for:** Edit profile, create client, settings panels, short-to-medium forms.

**Layout:** `max-w-md`, `max-h-[90vh]`. Header sticks. Body scrolls. Footer sticks.

```tsx
<FormModal
  open={open}
  onOpenChange={setOpen}
  title="Edit Profile"
  footer={<button onClick={handleSave}>Save</button>}
>
  <form className="space-y-4">
    <Input label="Name" ... />
    <Input label="Email" ... />
  </form>
</FormModal>
```

---

### 3. `PickerModal`

**Use for:** Meal pickers, recipe pickers, food search, library browse.

**Layout:** `max-w-2xl`, `max-h-[90vh]`. Header sticks. Optional `filterBar` sticks below header. Body scrolls.

```tsx
<PickerModal
  open={open}
  onOpenChange={setOpen}
  title="Choose a Meal"
  filterBar={
    <div className="flex gap-2 pb-2 overflow-x-auto">
      {categories.map(c => <PillButton key={c}>{c}</PillButton>)}
    </div>
  }
>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {meals.map(meal => <MealCard key={meal.id} meal={meal} />)}
  </div>
</PickerModal>
```

---

### 4. `InformationModal`

**Use for:** Help dialogs, how-it-works explanations, onboarding tips, feature announcements.

**Layout:** `max-w-md`, `max-h-[90vh]`. Header sticks. Body scrolls. Optional footer sticks.

```tsx
<InformationModal
  open={open}
  onOpenChange={setOpen}
  title="How Fridge Rescue Works"
>
  <div className="space-y-3 text-sm">
    <p>Fridge Rescue scans your available ingredients...</p>
  </div>
</InformationModal>
```

---

### 5. `WorkflowModal`

**Use for:** Multi-section editors — RecipeEditorPro, CulturalRecipeEditor, FamilyRecipeEditor.

**Layout:** `max-w-4xl`, `h-[90vh]` (near-full-screen on portrait mobile). Header sticks. Body scrolls. Optional footer sticks.

```tsx
<WorkflowModal
  open={open}
  onOpenChange={setOpen}
  title="Add Cultural Recipe"
>
  <form className="space-y-6 pb-4">
    {/* complex multi-section form */}
  </form>
</WorkflowModal>
```

---

### 6. `WizardModal`

**Use for:** Multi-step onboarding, professional certification, medical intake, questionnaires.

**Layout:** `max-w-lg`, `max-h-[90vh]`. Sticky progress bar below header. Body scrolls. Back/Next/Complete footer always sticks.

```tsx
<WizardModal
  open={open}
  onOpenChange={setOpen}
  title="ProCare Certification"
  step={currentStep}
  totalSteps={4}
  onBack={() => setStep(s => s - 1)}
  onNext={() => setStep(s => s + 1)}
  onComplete={handleComplete}
  isLastStep={currentStep === 3}
  nextDisabled={!stepIsValid}
>
  <StepContent step={currentStep} />
</WizardModal>
```

---

## Shared Primitives

Both `ModalBody` and `ModalFooter` are exported for edge cases where a typed component's defaults don't fit (e.g., a custom WorkflowModal with a two-pane layout).

```tsx
import { ModalBody, ModalFooter } from "@/components/ui/universal-modal"
```

**`ModalBody`** — `flex-1 overflow-y-auto overscroll-contain min-h-0`. The `min-h-0` is non-negotiable: without it, a flex child refuses to shrink past its content height, defeating the `overflow-hidden` on the parent.

**`ModalFooter`** — `flex-col-reverse sm:flex-row sm:justify-end`. Column-reverse on portrait so the primary action is always at the top. Row on sm+.

---

## Migration Guide

### Migration Compatibility Layer

```
Raw DialogContent  →  Typed Modal Component
```

Old imports do not break immediately. The fix to `dialog.tsx` resolves the most critical bugs (the `grid` conflict) for all existing modals even without migration. Migrate modals to typed components as you touch them; do not batch-migrate without testing.

### Migrating a Modal

**Before (raw DialogContent):**
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function MyModal({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Settings</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {/* form fields */}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**After (typed component):**
```tsx
import { FormModal } from "@/components/ui/universal-modal"

export function MyModal({ open, onClose }) {
  return (
    <FormModal
      open={open}
      onOpenChange={onClose}
      title="Edit Settings"
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </>
      }
    >
      {/* form fields — body scroll is automatic */}
    </FormModal>
  )
}
```

### Choosing the Right Type

| Signal | Type |
|---|---|
| "Are you sure?" | `ConfirmationModal` |
| Form fields, settings | `FormModal` |
| Grid of selectable items | `PickerModal` |
| Read-only explanation or help | `InformationModal` |
| Large multi-section editor | `WorkflowModal` |
| Back / Next / progress | `WizardModal` |

---

## Performance Requirements

### Lazy Body Rendering

All six typed components use `{open ? children : null}` in the body. Heavy modals (e.g., those rendering large ingredient grids or query data) are not mounted until the modal is opened. The `Dialog` primitive itself handles the portal and animation; only the children pay a render cost.

**Rule:** Never put a top-level `useQuery` or expensive computation directly inside a modal component. Gate it behind `enabled: open` or defer it inside the child content.

---

## Accessibility Requirements

All six typed components inherit from Radix's `Dialog` primitive, which provides:

- `role="dialog"`, `aria-modal="true"` automatically
- Focus trap (focus stays inside the modal while open)
- Escape key closes the modal
- Focus returns to the trigger element on close
- `aria-labelledby` wired to `DialogTitle` automatically

**Required from modal authors:**
- Always provide a meaningful `title` prop — it becomes the accessible name.
- When `description` is provided, it becomes the accessible description.
- Do not suppress the `DialogTitle` (even visually hiding it is acceptable via `sr-only`).
- Ensure interactive elements within the modal body are reachable via Tab.

---

## QA Checklist — Required Before Any Migrated Modal Ships

Every modal migration must be verified against the following checklist:

| Scenario | Check |
|---|---|
| Portrait iPhone (375px) | ✅ Modal fills width, no horizontal scroll |
| Portrait iPhone, long content | ✅ Body scrolls, header visible, footer visible |
| Landscape phone | ✅ Modal fits within viewport height |
| iPad portrait | ✅ Correct max-width, not awkwardly narrow |
| Desktop (1280px+) | ✅ Modal centered, correct max-width |
| Keyboard: Tab | ✅ Focus moves through all interactive elements |
| Keyboard: Escape | ✅ Modal closes |
| Keyboard: Enter in form | ✅ Submits or advances (does not close unintentionally) |
| Focus trap | ✅ Tab does not leave the modal |
| Focus return | ✅ Focus returns to trigger on close |
| Scroll lock | ✅ Page behind modal does not scroll |
| Footer layout | ✅ Footer stacks correctly on portrait |
| No horizontal overflow | ✅ No `overflow-x: auto` visible at any viewport |

---

## Enforcement — Future Lint Rule

When the migration is complete, add an ESLint rule:

```js
// eslint-plugin-local or eslint-plugin-boundaries
{
  "no-restricted-imports": [
    "error",
    {
      "paths": [{
        "name": "@/components/ui/dialog",
        "importNames": ["DialogContent"],
        "message": "Import a typed modal from @/components/ui/universal-modal instead."
      }]
    }
  ]
}
```

This makes drift literally impossible — a new modal importing `DialogContent` is a CI failure.

---

## UniversalDialog Is the Only Supported Foundation

> UniversalDialog is the only supported modal foundation. New modal behaviors are added to the system — not implemented ad hoc in individual features.

If a new modal type is needed (e.g., a side-sheet, a bottom-sheet, a drawer), add it to `universal-modal.tsx` and document it here. Do not invent a new one-off pattern in a feature file.

---

## Migration Status

### Fixed by `dialog.tsx` Base Repair (All Existing Modals)

Removing `grid gap-4` from `dialog.tsx` fixes the CSS specificity battle for every existing modal. The `flex flex-col` overrides that previously lost to `grid` now take effect correctly.

### Phase 1 — Infrastructure (Complete)

| File | Change |
|---|---|
| `client/src/components/ui/dialog.tsx` | Removed `grid gap-4` from base class |
| `client/src/components/ui/universal-modal.tsx` | Created — 6 typed components |

### Phase 2 — Confirmed-Broken Modals (Fixed by Base Repair)

These modals already had `flex flex-col` in their className. They now work correctly as a side-effect of the base repair.

| Modal | Status |
|---|---|
| `ProClientFolderModal.tsx` | ✅ Fixed by base repair |
| `AdditionalMacrosModal.tsx` | ✅ Fixed by base repair |
| `ShoppingListPreviewModal.tsx` | ✅ Fixed by base repair |

### Phase 2b — Grid + sm:max-w Fixes (Complete)

| File | Change |
|---|---|
| `WeeklyOverviewModal.tsx` | `grid-cols-4` → `grid-cols-2 sm:grid-cols-4` |
| `QuickAddMacrosModal.tsx` | `sm:max-w-md` → `max-w-md w-[calc(100vw-2rem)]` |
| `PasteMacrosModal.tsx` | `sm:max-w-lg` → `max-w-lg w-[calc(100vw-2rem)]` |
| `MacroSummaryButton.tsx` | `sm:max-w-md` → `max-w-md w-[calc(100vw-2rem)]` |
| `ShoppingListSummaryButton.tsx` | `sm:max-w-lg` → `max-w-lg w-[calc(100vw-2rem)]` |

### Phase 3 — Workflow Modal Scroll Pattern (Complete)

These workflow modals previously had `overflow-y-auto` on the outermost `DialogContent` (causing the header to scroll away). Fixed by adding `flex flex-col h-[90vh] overflow-hidden` with an inner `flex-1 overflow-y-auto` scroll wrapper.

| Modal | Status |
|---|---|
| `RecipeEditorPro.tsx` | ✅ Header now sticks; body + form scroll |
| `CulturalRecipeEditor.tsx` | ✅ Header now sticks; body + form scroll |
| `FamilyRecipeEditor.tsx` | ✅ Header now sticks; body + form scroll |

### Phase 4 — Picker Modals (DialogContent ban enforced; PickerModal typed migration pending)

| Modal | Status | Notes |
|---|---|---|
| `MealPremadePicker.tsx` | 🔒 LOCKED | Protected under Meal Picker Lockdown Protocol (Nov 24 2025). No UI structure changes allowed without explicit approval. |
| `AthleteMealPickerDrawer.tsx` | 🟡 rawLayout | `DialogContent` import removed; uses `UniversalDialog rawLayout`. Migrate to `PickerModal` in next pass. |
| `CompetitionMealPickerDrawer.tsx` | 🟡 rawLayout | Same — migrate to `PickerModal`. |
| `SnackPickerDrawer.tsx` | 🟡 rawLayout | Same — migrate to `PickerModal`. |
| `ReplaceMealMenu.tsx` | 🟡 rawLayout | `DialogContent` import removed; uses `UniversalDialog rawLayout`. Migrate to `WorkflowModal`. |

### Phase 5 — Remaining Modals (DialogContent ban enforced; rawLayout cleanup ongoing)

**Enforcement state:** Every file in `client/src` now uses a typed component from `universal-modal.tsx` — no file imports `DialogContent` directly except `universal-modal.tsx` and `command.tsx`. The ESLint `no-restricted-imports` rule makes this a hard CI failure going forward.

**rawLayout cleanup:** ~15 component files still use `UniversalDialog rawLayout` (they removed the `DialogContent` import violation, but haven't completed the upgrade to fully-typed components). These are flagged by the new `no-restricted-syntax` ESLint rule (warn). Files being phased out: `ProtocolDowngradeModal`, `ThyroidRecommendationModal`, `ProtocolRecommendationModal`, `GuestUpgradePromptModal`, `TierUpgradeModal`, `WorkspaceSelectionModal`, `UpgradeLockModal`, `InspirationCaptureModal`, `ExportPhysicianReportButton`, `CreateWithChefModal`, `SnackCreatorModal`, `ProClientFolderModal`, `QuickTourModal`.

**rawLayout policy:** `rawLayout` is an escape hatch for complex modals with custom sticky-header structures that cannot be expressed through typed component props. It is **not** a migration default. Currently documented exceptions (lint rule suppressed):

| File | Reason |
|---|---|
| `BreakfastMealsHub.tsx` | Custom sticky meal-detail header with complex multi-section layout |
| `MealHubFactory.tsx` | Same pattern as BreakfastMealsHub |

Any new use of `rawLayout` outside these files is flagged by the ESLint `no-restricted-syntax` rule (warn). Overrides require explicit justification in code review.

---

## Glossary

| Term | Meaning |
|---|---|
| **Layout drift** | Each modal independently solving layout, scroll, and mobile sizing — creating inconsistent behavior across the app. |
| **`grid` conflict** | The `grid` base class in `dialog.tsx` taking precedence over consumer `flex` overrides due to CSS source order. |
| **`min-h-0` rule** | A flex child must declare `min-height: 0` to be allowed to shrink below its content height. Without it, `overflow-hidden` on the parent has no effect. |
| **sm:max-w anti-pattern** | Using `sm:max-w-*` means the modal has NO max-width on portrait mobile — it expands to 100% viewport width with no gutters. Always use `max-w-*` + `w-[calc(100vw-2rem)]`. |
| **Scroll-on-container** | `overflow-y-auto` on `DialogContent` itself causes the header to scroll out of view. Always use an inner `<div className="flex-1 overflow-y-auto min-h-0">` with `overflow-hidden` on the container. |
