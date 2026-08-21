---
name: Safe-area modal layout — minimal blast radius rule
description: Safe-area/spacing fixes must not restructure flex/overflow/scroll architecture. The correct pattern for iOS safe area in a modal is inline paddingTop style only.
---

# Safe-area modal layout — minimal blast radius rule

## The rule

**Spacing, padding, and safe-area fixes must not restructure `flex`, `grid`, `width`, `overflow`, or scroll architecture unless the existing structure makes the fix impossible.**

If broader restructuring is necessary, stop and explain why before changing it.

## The correct safe-area pattern for modals

To clear the iPhone notch/status bar inside a modal that uses `rawLayout=true` on `UniversalDialog`:

```jsx
<div
  className="... existing-classes ..."
  style={{
    paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
    paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
  }}
>
```

This is ALL that is needed. Do not add `flex flex-col`, `h-full`, `overflow-hidden`, or nested scrollable divs to achieve safe-area spacing.

**Why:** `h-full` inside a flex container with no definite height causes width computation to break on mobile browsers. The dialog can end up wider than the screen while showing zero JS errors.

## What went wrong (reference incident — August 2026)

A safe-area requirement for `InspirationCaptureModal` was implemented by also adding `flex flex-col overflow-hidden h-full` to the inner container and wrapping phase content in `flex-1 overflow-y-auto min-h-0`. This caused the modal to render wider than the screen on portrait mobile — only usable in landscape. Zero JS errors, zero TS errors. Only visible on a real phone.

**Fix:** Remove the flex restructuring. Keep only the inline paddingTop/paddingBottom style. The `overflow-y-auto` for scrolling stays on the `UniversalDialog`'s outer container (which was already there before the change).

## When touching modal layout

1. Do not add `h-full` to an inner div inside a flex container with `max-h` (not explicit `h`) constraint.
2. Do not wrap phase content in `flex-1 min-h-0` unless the parent has a definite height.
3. The existing `overflow-y-auto` on `UniversalDialog`'s className is sufficient for scrolling the whole modal.
4. Safe area = inline style on the content div. That's it.

**Why:** These patterns have visible effects only on real portrait-mobile viewports, not in desktop browser preview. The agent cannot visually verify them — only Playwright with mobile viewport sizes can.

## How to suppress the built-in X and add a Trash2 instead

```tsx
// In UniversalDialog:
<UniversalDialog showCloseButton={false} ...>

// In the header row (absolute right-0):
<button
  onClick={() => onOpenChange(false)}
  className="absolute right-0 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
>
  <Trash2 className="h-4 w-4" />
</button>
```

`showCloseButton` is accepted by `DialogContent` in `dialog.tsx` (line 37) and passed through `UniversalDialog` in `universal-modal.tsx`.
