---
name: Macro Calculator type sync rule
description: Any rename of UserType or BodyType values must be applied in 3 places simultaneously or the compute API silently 400s.
---

## Rule

When renaming or adding a value to `UserType` or `BodyType` in `MacroCalculator.tsx`, you MUST update all three of:

1. `server/routes/macroCalculatorRoutes.ts` — the `VALID_USER_TYPE` and `VALID_BODY_TYPE` allowlists
2. `server/services/macroCalculatorEngine.ts` — the `UserType` and `BodyType` type exports
3. `server/services/macroCalculatorEngine.ts` — any logic branches (`calcProtein`, `applyBodyTypeTilt`) that switch on the value

**Why:** The server validator runs before the engine and returns 400 on unknown values. On the client, `results` is only set on a successful compute response. Most of the "done" (return-visit) view is gated on `results`, so a 400 collapses the whole page to just the unconditional input cards — looks like UI sections disappeared, no visible error.

**How to apply:** Any future rename of these type values — do a global grep for the old string before committing and confirm all three server files are updated.
