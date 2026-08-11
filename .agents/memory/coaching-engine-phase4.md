---
name: Coaching Engine Phase 4 — Observability + Conversational UI
description: Phase 4A wired all consumption events client-side; Phase 4B built the full CoachsCorner conversational interface replacing the situation-picker.
---

## Phase 4A — Consumption event wiring (COMPLETE)

**What was done:**
- `server/routes.ts` — `barcodeUserId` hoisted OUTSIDE inner NDE try block so it's in scope for post-response emission; product_scan_completed fired after `res.json()`.
- `server/routes/coachingEngine.ts` — POST /activity-event endpoint added; sourceFeature cast via `as import(...).SourceFeature | undefined`; `SourceFeature` field in `EmitActivityEventParams` made optional.
- `client/src/lib/coachEvents.ts` — uses `apiRequest` (not raw fetch) so auth headers are automatic; `emitCoachEvent()` is fire-and-forget via `.catch(() => {})`.
- Consumption events wired in:
  - `SocialRestaurantGuide.tsx` → `restaurant_meal_added_to_macros`
  - `BeverageCreator.tsx` → `beverage_added_to_macros`
  - `CravingDessertCreator.tsx` → `dessert_added_to_macros`
  - `GeneratedMealCard.tsx` (handleAddToMacros) → `meal_added_to_macros`

**Why:** Usage ≠ consumption is the governing rule. "Add to Macros" = confirmed consumption; generating = usage only.

## Phase 4B — Conversational UI (COMPLETE)

**What was done:**
- `client/src/pages/CoachsCorner.tsx` — NEW: full conversational coaching page.
- `client/src/components/Router.tsx` — `/coach-corner/home` now loads `CoachsCorner` (was `CoachCornerHome`).

**CoachsCorner architecture:**
- Status gate: fetches `/api/coach-corner/status`; if `completed === false` → redirects to intake.
- Conversation loading: chain of three queries: status → conversation → messages (each `enabled` on prior result).
- Local message state: populated from DB on first successful load via `messagesInitialized` ref guard; never re-fetches.
- Coach response rendered as flowing prose — `whatIFound`, `whatItCouldMean`, `todayPlan.why+items`, `learningOpportunity` merged into ONE seamless message. NO section labels ever shown.
- Gear icon → ProfileSheet: shows all 15 questions with current answers; each row expandable inline to edit; single-select closes immediately; multi-select shows "Done" button; optimistic local state update + PATCH mutation.
- PATCH /api/coach-corner/profile: accepts `{ answers: { [questionId]: value } }`; does NOT update `coachProfileCompletedAt`.

**Why:** Chat is not Coach's Corner. The engine is Coach's Corner. Chat is the interface to it. Situational framing in the UI would train users to think of the engine as a query tool rather than an ongoing coaching relationship.

## Remaining Phases

- **Phase 5:** Long-term memory, action plans, follow-up workers
- **Phase 6:** Product Intelligence / Supplement Intelligence (tenant-aware recommendation policy with 3 modes: `independent`, `brand_catalog_only`, `analysis_only`)
