---
name: Performance Nutrition System
description: Sport-specific fueling protocol — architecture, routes, AI layer wiring, and component paths.
---

## Rule
"performance-nutrition" in `specialtyConditions` activates the performance block in universalMedicalGuidance. The `performanceContext` JSONB blob on the users table holds the protocol fields.

**Why:** Follows the pregnancy-support additive modifier pattern so medical guardrails always override sport-specific directives.

**How to apply:** Adding a new training type: extend `trainingMap`, `NUTRIENT_PRIORITIES` in hub, and `TYPE_LABELS` in DashboardNew/Hub. The enum validation list in `server/routes/performanceNutrition.ts` (POST /setup) must also be updated.

## Key wiring
- Boot migration: `server/index.ts` and `server/prod.ts` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_context jsonb`
- Route: `/api/performance/setup` (POST), `/api/performance/context` (GET), `/api/performance/ask` (POST) — `server/routes/performanceNutrition.ts`
- Mounted: `app.use("/api/performance", requireAuth, performanceNutritionRouter)` in both `routes.ts` and `prod.ts`
- Profile: `performanceContext: (user as any).performanceContext ?? null` in the `/api/user/profile` response
- AI: `server/services/universalMedicalGuidance.ts` — `performanceNutritionContext` interface field + inline guidance block using carb strategy resolver
- Envelope: `server/services/protocolEnvelope.ts` — loads performanceContext from JSONB, builds performanceNutritionCtx, returns both `performanceNutrition` bool and `performanceContext` object
- Frontend hub: `client/src/pages/PerformanceNutritionHub.tsx` at route `/performance`
- Setup modal: `client/src/components/PerformanceSetupModal.tsx` — 5 steps: primaryGoal, trainingType, frequency (+ 2-a-days toggle), cardioFocus, trainingPhase
- Dashboard card: `client/src/pages/DashboardNew.tsx` — shown when `user.performanceContext?.primaryGoal` is set
- Lifestyle landing: `client/src/pages/LifestyleLandingPage.tsx` — card navigates to `/performance`
- `usePageTitle` must be imported from `@/contexts/PageTitleContext`, NOT `@/hooks/usePageTitle` (that path doesn't exist)

## Display rename (NOT internal namespace)
- Display name: "Performance Nutrition Builder" everywhere user-facing
- Internal: `BUILDER_NS.BEACH_BODY`, route `/beach-body-meal-board`, DB field `beach_body` — all UNCHANGED
