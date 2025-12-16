# Meal Builder Walkthrough - Required Data-TestID Attributes

This document lists the required `data-testid` attributes for Phase C.1 walkthrough scripts across all 5 meal builders.

## ⚠️ SCRIPT STATUS: DORMANT

**All 5 meal builder walkthrough scripts are currently DORMANT** (marked `uiReady: false`) and will not launch until the UI team implements the required data-testid attributes and custom events listed below.

When a user attempts to launch these walkthroughs, Copilot will respond: "This walkthrough requires UI updates that are still in progress. Please check back soon!"

## Overview

All meal builders (Weekly, Diabetic, GLP-1, Anti-Inflammatory, Beach Body) share the same 11-step walkthrough flow and require identical `data-testid` attributes in their UI components.

## Required Attributes (17 Total)

### Step 1: Introduction
- `weekly-builder-header` - Main header/title area of the meal builder page

### Step 2-5: Meal Slot Targets
- `meal-slot-breakfast` - Breakfast meal slot (clickable to open meal creator)
- `meal-slot-lunch` - Lunch meal slot (clickable to open meal creator)
- `meal-slot-dinner` - Dinner meal slot (clickable to open meal creator)
- `meal-slot-snack` - Snack meal slot (clickable to open meal creator)

### Step 2-5: Meal Filled Event Emitters
These elements must emit a custom "filled" event when a meal is added:
- `meal-filled-breakfast` - Breakfast slot indicator (emits `filled` event when meal added)
- `meal-filled-lunch` - Lunch slot indicator (emits `filled` event when meal added)
- `meal-filled-dinner` - Dinner slot indicator (emits `filled` event when meal added)
- `meal-filled-snack` - Snack slot indicator (emits `filled` event when meal added)

### Step 6: Daily Totals
- `daily-totals-card` - Daily macros summary card
- `daily-totals-ready` - Totals ready indicator (emits `ready` event when calculations complete)

### Step 7: Duplicate Menu
- `duplicate-button` - Button to initiate day duplication

### Step 8: Duplicate Days Selection
- `duplicate-days-panel` - Panel/modal for selecting days to duplicate to
- `duplicate-days-selected` - Selection indicator (emits `chosen` event when days are selected)

### Step 9: Confirm Duplication
- `duplicate-confirm-button` - Button to confirm and execute duplication

### Step 10: Shopping List
- `send-week-to-shopping` - Button to send week's meals to shopping list
- `shopping-week-sent` - Shopping list sent indicator (emits `done` event when completed)

## Implementation Notes

### Event Emitters
Elements with `waitForEvent` must dispatch custom events:

```typescript
// Example: When user adds a meal to breakfast slot
const breakfastFilledElement = document.querySelector('[data-testid="meal-filled-breakfast"]');
if (breakfastFilledElement) {
  breakfastFilledElement.dispatchEvent(new CustomEvent('filled'));
}
```

### Event Types
- `filled` - Dispatched when a meal is successfully added to a slot
- `ready` - Dispatched when calculations/processing completes
- `chosen` - Dispatched when user makes a selection
- `done` - Dispatched when an action successfully completes

### UI Pages Requiring Updates

1. **Weekly Meal Board** (`/weekly-meal-board`)
2. **Diabetic Menu Builder** (`/diabetic-menu-builder`)
3. **GLP-1 Menu Builder** (`/glp1-menu-builder`)
4. **Anti-Inflammatory Menu Builder** (`/anti-inflammatory-menu-builder`)
5. **Beach Body Meal Board** (`/beach-body-meal-board`)

## Testing Walkthrough Scripts

To test if data-testid attributes are correctly implemented:

1. Navigate to any meal builder page
2. Say "show me the weekly meal builder walkthrough" (or use Copilot)
3. Verify SpotlightOverlay highlights each element in sequence
4. Verify auto-advance triggers when waitForEvent fires

## Phase C.1 Script Files

- `client/src/components/copilot/walkthrough/scripts/WeeklyMealBuilderScript.ts`
- `client/src/components/copilot/walkthrough/scripts/DiabeticMealBuilderScript.ts`
- `client/src/components/copilot/walkthrough/scripts/GLP1MealBuilderScript.ts`
- `client/src/components/copilot/walkthrough/scripts/AntiInflammatoryMealBuilderScript.ts`
- `client/src/components/copilot/walkthrough/scripts/BeachBodyMealBuilderScript.ts`

---

**Last Updated:** Implementation complete - awaiting UI integration
**Related:** Phase C.1 Spotlight Walkthrough System
