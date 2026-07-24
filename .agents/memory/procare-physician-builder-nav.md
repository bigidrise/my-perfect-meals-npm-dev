---
name: ProCare physician builder navigation rule
description: Physician builder buttons in ProClientDashboard must use /pro/clients/:id/builder-route — hub pages null out proClientId causing saves to hit the wrong user's board.
---

## Rule
All physician builder navigation in `ProClientDashboard.tsx` must use:
```
setLocation(`/pro/clients/${clientId}/glp1-builder`)
setLocation(`/pro/clients/${clientId}/diabetic-builder`)
```
Never navigate to `/glp1-hub`, `/diabetic-hub`, or any other client-facing hub page.

**Why:** `GLP1MealBuilder.tsx` and `DiabeticMealBuilder.tsx` detect the pro context via `useRoute("/pro/clients/:id/glp1-builder")`. If the URL doesn't match that pattern (e.g., physician landed on `/glp1-meal-builder` via the hub), `proClientId` is null. The `useWeeklyBoard` hook then saves to `PUT /api/weekly-board?bt=glp1` (the client route), which writes to the authenticated user's own `week_boards` row — NOT the patient's. The patient never sees the physician's plan.

**How to apply:** Any time a new physician builder button is added to `ProClientDashboard.tsx`, use the direct pro route. Confirmed in server logs: `PUT /api/weekly-board` (no `/pro/`) = broken, `PUT /api/pro/weekly-board/:clientId` = correct.

**Double-write:** The pro route handlers in `proWeekBoard.ts` correctly double-write to both the builder namespace (`glp1`) AND the `''` (client-facing) namespace via `if (builderType) { await upsertWeekBoard(clientUserId, weekStartISO, saved, ''); }`. This is the mechanism by which the client's weekly board receives the physician's plan.

**Trainer builders work** because `TrainerClientDashboard.tsx` already navigates via `setLocation(`/pro/clients/${resolvedClientUserId}/${entry.proRoute}`)` — the client ID is always embedded in the URL.
