# Paywall Upgrade Modal Coverage Matrix

Subscription-tier denials must open the standard upgrade modal before the user chooses whether to visit pricing. Authentication, safety, clinical eligibility, professional authorization, and disabled-feature denials keep their own non-marketing handling.

| Feature | Entitlement | Minimum tier | Blocked-user behavior | Frontend enforcement | Backend enforcement | Basic/shared infrastructure preserved |
|---|---|---|---|---|---|---|
| Grocery Coach | `grocery_coach` | Pro | Feature-specific Pro modal; pricing only after the user selects View Plans | Shopping List action guard | `requireProAccess` | Shopping list remains available by its own entitlement |
| My Perfect Hydration Center | `hydration_center` | Pro | Feature-specific Pro modal; dismissal stays on the current screen; direct `/hydration` links show the same gate | Biometrics action plus direct-route entitlement guard | `requireProAccess` on personal advanced Center endpoints | `/api/water-logs`, Basic Hydration Tracking, consistency/coaching/GLP-1/nutrition-summary consumers, and professional authorization services remain separate |

## Hydration acceptance boundary

- Free and Essential retain Basic Hydration Tracking in Biometrics.
- Pro and Clinical receive My Perfect Hydration Center.
- Payment does not activate numeric guidance or override `TRACK_ONLY`, `PLAN_WITHHELD`, `NEEDS_REVIEW`, clinical policy, consent, relationship authorization, MFA, education, organization isolation, or professional role restrictions.
- Stable `/hydration`, `/api/hydration/*`, data identifiers, and legacy “Hydration Hub” voice/search aliases remain unchanged.