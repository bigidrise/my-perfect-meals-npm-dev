---
name: Universal Modal System
description: The architecture, rules, and gotchas for the app's modal system. Read before creating or editing any modal.
---

# Universal Modal System

## The Rule
Only `client/src/components/ui/universal-modal.tsx` may import `DialogContent`. Every other modal must use one of the 6 typed components exported from that file.

## Root Cause Fixed
`dialog.tsx` previously had `grid gap-4` in its base class. Tailwind's compiled CSS source order means `grid` always wins over a consumer's `flex flex-col` override — silently breaking layout without any error. **Fix:** removed `grid gap-4`. Base class is now layout-neutral.

## The 6 Types (in universal-modal.tsx)
| Type | Use Case | Width | Scroll |
|---|---|---|---|
| ConfirmationModal | Delete/yes-no | max-w-sm | None |
| FormModal | Edit/create forms | max-w-md | Body |
| PickerModal | Meal/food pickers | max-w-2xl | Body; filterBar prop sticks |
| InformationModal | Help/explanations | max-w-md | Body |
| WorkflowModal | Large editors | max-w-4xl, h-[90vh] | Body |
| WizardModal | Multi-step flows | max-w-lg | Body; progress bar sticks |

## Critical CSS Rules
- **min-h-0**: ModalBody always needs this. Without it, a flex child won't shrink below content height, defeating `overflow-hidden` on the parent.
- **sm:max-w anti-pattern**: `sm:max-w-md` means NO max-width on portrait mobile. Always use `max-w-md w-[calc(100vw-2rem)]`.
- **Scroll-on-container**: `overflow-y-auto` on DialogContent causes the header to scroll away. Always use `flex flex-col overflow-hidden` on the container + inner `flex-1 overflow-y-auto min-h-0`.

## Lazy Rendering
All 6 types use `{open ? children : null}` in the body — heavy modals don't mount until opened.

## MealPremadePicker
LOCKED under Meal Picker Lockdown Protocol (Nov 24 2025). No UI structure changes without explicit user approval.

**Why:** This architecture decision eliminates an entire class of layout bugs and makes modal behavior consistent and predictable across all 56 modals.

**How to apply:** Before creating any new modal, import from `@/components/ui/universal-modal` not `@/components/ui/dialog`. See `UNIVERSAL_MODAL_SYSTEM.md` for the full guide including QA checklist.
