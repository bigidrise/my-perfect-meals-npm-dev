# Production feature activation audit

Reviewed Production source: `67a964474f6ab5effd915fc9bc9ffa027d8e3aa9`.
Reviewed integration source: `06ddb7169`.
No flag, environment setting, member entitlement, or runtime feature activation was changed.

## Existing availability versus incoming enhancements

| Feature | Existing eligible-member Production page | Integrated Production behavior |
| --- | --- | --- |
| Ask Chef / Coach's Corner | The outer `COACHES_CORNER_ENABLED` flag requires `VITE_COACHES_CORNER_ENABLED === "true"`. Current Production environment metadata reports that key unset, including no secret with that name. The page is therefore hidden in the configured Production build. | The incoming conversation experience independently returns `import.meta.env.DEV` from `isChefConversationEnabled()`, so it remains disabled even if the outer flag were enabled. Legacy page fallback and server intake rules remain unchanged. |
| My Perfect Getaway | `/lifestyle/my-perfect-getaway` exists in both versions, behind `ClinicalGuard` / `isClinicalOrAbove`. This is an existing page, not a Development-only route. | The existing experience remains available to eligible members. New reliability/evidence handling, venue-meal UI, venue-context persistence and related controls are gated off by the client and server Development predicates. Some shared venue-discovery changes are not gated; the entire source improvement must not be described as wholly disabled. |
| Restaurant Guide | `/social-hub/restaurant-guide` exists in both versions, behind `ProGuard` / `isProOrAbove`. | The existing page and ungated serving presentation remain available. New server reliability, venue-context acceptance, evidence requirements, result-shape and diabetic filtering branches remain Development-only. |
| Find Meals Near Me | `/social-hub/find` exists in both versions, behind `ProGuard` / `isProOrAbove`. | The existing finder and ungated serving presentation remain available. New server authentication/profile/evidence completeness, verified-venue, nutrient completeness and empty-result branches remain Development-only. |

These are source/configuration availability findings, not an authenticated live-member acceptance test. Effective-access exceptions continue to be determined by the existing entitlement helpers. Marketing copy listing Ask Chef is not proof that the feature is enabled.

## Exact changes required for a separately approved activation

### Ask Chef

1. Explicitly enable the existing outer `VITE_COACHES_CORNER_ENABLED` build flag only after approval.
2. Replace the hardcoded Development return in `client/src/lib/chefCornerExperience.ts:3` with an explicit, default-off approved conversation release policy. This controls `Router.tsx` conversation entries, `CoachsCorner.tsx`, and concierge bubble/action presentation.
3. Apply the matching server policy to the concierge branches in `server/services/coaching/engine.ts` at lines 454, 751, 791, 1078, 1143, 1296 and 1510.
4. Apply the same approved policy to the corresponding intake/profile/conversation branches in `server/routes/coachingEngine.ts`, including the Production intake condition at line 60. Preserve the legacy fallback when the policy is off.
5. Replace only the feature-specific Development rejection in `server/routes/coachingNavigation.ts:30`. `/api/coach/navigation` otherwise remains 404 in Production. Keep `requireAuth`, destination-specific entitlement checks, and destination-page guards.
6. Preserve all clinical, subscription and identity checks. Do not enable unrelated Development endpoints or globally set Production `NODE_ENV` to `development`.

### My Perfect Getaway

1. Replace the feature-specific client predicate at `client/src/pages/lifestyle/MyPerfectGetaway.tsx:119` with an explicit, default-off approved reliability policy.
2. Enable the matching server reliability policy at `server/routes/getaway.ts:43`.
3. Coordinate the venue-meal handoff with Restaurant Guide's `getawayVenue` acceptance branch at `server/routes/restaurants.ts:124`; a client-only activation would not enable that server contract.
4. Retain Clinical page eligibility, authenticated subject context, venue identity, evidence qualification and authoritative safety validation.

### Restaurant Guide

1. Coordinate the feature-specific Development conditions in `server/routes/restaurants.ts` at lines 124, 358, 383, 462, 477, 537, 551, 554 and 584.
2. Enable the corresponding restaurant-generation reliability policy currently represented by `development` at `server/services/restaurantMealGeneratorAI.ts:363`.
3. Decide image request behavior separately from reliability activation: `skipImages` at `server/routes/restaurants.ts:347` is also environment-dependent. Keep the approved Production Flare subsystem; do not activate the excluded image experiments.
4. Leave `server/routes/restaurants.ts:913` and other diagnostic/debug endpoints Production-disabled. Do not globally replace environment checks.

### Find Meals Near Me

1. Coordinate the feature-specific conditions in `server/routes/mealFinder.ts` at lines 87, 187, 193, 276 and 308.
2. Coordinate `server/services/mealFinderService.ts:351` and `:372` with the shared restaurant-generator policy above. Otherwise an empty verified venue search can still fall back to illustrative AI venues.
3. Review image-request switches at `server/services/mealFinderService.ts:400` and `:475` separately; preserve the existing approved image implementation.
4. Keep Pro page eligibility, current-subject context and final clinical validation. Do not substitute a global environment-mode change for feature-specific approval.

All listed changes are requirements for a future approved activation, **not changes performed by this review**. Selecting names for new default-off release policies, setting their values and validating signed-in Production behavior remains separate work.
