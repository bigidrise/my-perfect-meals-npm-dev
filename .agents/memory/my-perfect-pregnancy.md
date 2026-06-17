---
name: My Perfect Pregnancy — Architecture
description: Architecture decisions for the pregnancy support feature — data model, protocol integration pattern, safety rules, and file locations.
---

## Pattern
Additive Modifier — NOT a Primary Protocol. Pregnancy support is layered on top of existing meal generation. Activated when "pregnancy-support" appears in the user's `specialtyConditions` array. Does not replace the primary builder.

## Data Model
Three new columns on `users` table (boot migrations in both server/index.ts and server/prod.ts):
- `pregnancy_stage` (text) — manual stage override: "trying-to-conceive" | "trimester-1" | "trimester-2" | "trimester-3" | "breastfeeding" | "postpartum"
- `pregnancy_due_date` (text, ISO YYYY-MM-DD) — source of truth for auto-derived trimester/week
- `pregnancy_support_context` (jsonb) — stores { symptoms, trackingMode, isBreastfeeding, activatedAt, updatedAt }

## Protocol Envelope Integration
- `pregnancySupport: boolean` and `pregnancySupportContext` added to `UserProtocolEnvelope` interface
- Server-side derivation in `protocolEnvelope.ts`: when `trackingMode !== "manual"` and `dueDate` is set, calculates `weekOfPregnancy` and `currentTrimester` from dueDate math
- `buildGuestEnvelope` defaults: `pregnancySupport: false, pregnancySupportContext: null`
- `pregnancySupportContext` passed to `buildUniversalConditionGuidance` in `universalMedicalGuidance.ts`
- Prompt builder uses `await import(...)` (dynamic) inside the async `buildUniversalConditionGuidance` function

## File Locations
- Prompt builder: `server/services/guardrails/prompt/pregnancySupportPromptBuilder.ts`
- Validator: `server/services/guardrails/validators/pregnancySupportValidator.ts`
- Coach route: `server/routes/pregnancyCoach.ts` — mounted at `/api/pregnancy` (requires auth)
- Hub page: `client/src/pages/MyPerfectPregnancyPage.tsx`
- Setup modal: `client/src/components/PregnancySupportSetupModal.tsx`
- Route: `/lifestyle/my-perfect-pregnancy` in Router.tsx

## API Endpoints
- `POST /api/pregnancy/ask` — Pregnancy Coach chat (requireAuth)
- `POST /api/pregnancy/setup` — saves stage, dueDate, symptoms, trackingMode, isBreastfeeding (requireAuth)

## Safety Architecture
- Hard-blocked ingredients set in `pregnancySupportPromptBuilder.ts` (PREGNANCY_HARD_BLOCKED_INGREDIENTS)
- Post-generation validator in `pregnancySupportValidator.ts` — checks forbidden language patterns + ingredient blocks
- Mandatory FDA/CDC/EPA/ACOG food safety block injected into every pregnancy-aware prompt
- Forbidden language patterns: outcome guarantees, prevention claims, supplement dosing

## **Why Additive Modifier:**
Pregnancy co-exists with other conditions (cardiac, renal, thyroid, etc.). Making it an additive modifier means all existing medical protocols remain active simultaneously, which is clinically correct.

## Entry Points
- Onboarding: `OnboardingV3.tsx` — "🩷 My Perfect Pregnancy" pill with disclosure block
- Edit Profile: `EditProfilePage.tsx` — same pill + disclosure block in Specialty Health Protocol section
- Lifestyle Landing: `LifestyleLandingPage.tsx` — card after featured kitchens section, free for all users
