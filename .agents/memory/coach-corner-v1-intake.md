---
name: Coach's Corner v1 intake
description: Behavioral intake for Coach's Corner reuses existing coaching_profiles columns until the Behavioral Variables spec is locked.
---

Coach's Corner (rebrand/expansion of the old "Coach Check-In") ships its v1 vertical slice
(dashboard card → welcome → intake questions → save → completion) by mapping all questions onto
the 5 existing flat `coaching_profiles` columns: `coachingStyle`, `accountabilityPref`,
`motivations[]`, `lifestyleFlags[]`, `biggestChallenges[]`.

**Why:** The full Behavioral Variables / Intake Specification (richer taxonomy of behavioral
signals) was intentionally deferred — the user wanted a working vertical slice before more
architecture docs. Inventing new schema for this ahead of that spec would create drift.

**How to apply:** When the Behavioral Variables spec is finalized, replace
`server/services/ace/coachCornerQuestions.ts` and the mapping logic in
`server/routes/coachCorner.ts` — don't patch them incrementally — and add real columns then. Also
note: `coachProfileCompletedAt` (timestamp) on `coaching_profiles` marks intake completion; use it
to drive the two-state dashboard card (`CoachCornerCard.tsx`).
