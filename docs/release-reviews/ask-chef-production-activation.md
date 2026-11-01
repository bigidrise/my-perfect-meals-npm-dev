# Ask Chef — approved Production integration activation

## Scope

Owner explicitly approved Production visibility and the new Ask Chef conversation experience, formerly Chef's Corner.

- Workspace: separate Production Replit; deployment metadata identifies the existing Production application.
- Branch: `integration/all-approved-development-20261031`.
- Starting integration: `771f98614`.
- No merge into `production`, push, deployment, publication, migration, native-project change, or unrelated feature activation.

## Exact activation changes

1. **Visibility:** `client/src/features/coachCornerFlag.ts` now uses the small shared Ask Chef release policy. Production builds show Ask Chef with `VITE_COACHES_CORNER_ENABLED` unset. Development retains its existing explicit opt-in. An explicit `"false"` remains a **visibility-only** rollback; it does not restore the former assessment or disable server APIs.
2. **Frontend experience:** `client/src/lib/chefCornerExperience.ts` now returns the released conversation experience independently of `import.meta.env.DEV`. Existing guarded welcome/intake/complete links enter conversation; the dashboard and shared chat render the conversational presentation rather than the assessment.
3. **Backend dispatch and bootstrap:** `server/routes/coachingEngine.ts` and `server/services/coaching/engine.ts` recognize Production as an explicitly released conversation environment. Eligible new and existing members do not need the old intake; bootstrap does not query the assessment or surface its legacy due follow-up. Stored conversation ownership and structured-message restoration are unchanged.
4. **Conversation context and safe actions:** the corner adapter emits validated feature IDs in Production, not legacy route strings. The existing reviewed conversation capability descriptions and platform/interface knowledge now apply in Production too.
5. **Navigation:** `/api/coach/navigation` operates in Production with an explicit Pro guard **before** its unchanged destination-specific guards and allowlist validation.
6. **No environment switch:** the application remains `NODE_ENV=production`. No `.replit`, stored environment variable, deployment configuration, or other feature gate was changed.

The shared policy enables only Ask Chef's reviewed conversation environment. It does not globally make Production behave like Development. Historical internal names such as `getDevelopmentPlatformKnowledge` remain for compatibility; their Ask Chef gate now includes Production.

## Entitlements, permissions and safeguards

- Existing real `requireAuth` and `requireProAccess` protect message, bootstrap, conversation/history, older messages, plans, completions, follow-ups and deletion APIs.
- Navigation now also requires Pro access at entry. Free and ordinary Essential members cannot obtain Ask Chef navigation responses even for otherwise accessible destinations.
- Clinical destinations still require Clinical access; hydration still requires its purchased entitlement; Menu, Builder and other destinations retain their own independent guards.
- Established family, founder, authorized provider and temporary full-access cases remain governed by the existing middleware. No replacement personal-plan-only policy was introduced.
- Shared `/api/coach/activity-event` remains an authenticated, subject-owned **platform activity collector**, used outside Ask Chef by other member workflows. It is not a conversational/provider capability and was deliberately not turned into a paid-only logging API.
- Subject authorization, conversation ownership, medical safety escalation, unsupported/Coming Soon destination rejection, grounded intent, creator-request validation and no-automatic-navigation/generation rules remain intact.
- Pregnancy Coach, pairing, Development test enrollment and unrelated experimental features retain their existing restrictions.

## Listings

- **Dashboard:** existing `COACHES_CORNER_ENABLED` card now renders in Production. The conversational card uses Ask Chef branding and the existing navigation routes.
- **App Library:** existing `Learn.tsx` `chefs-corner` entry normalizes legacy titles to Ask Chef and now selects the conversation/no-questionnaire description.
- **Pro subscription listings:** both `PLAN_FEATURES.premium` and consumer SKU `mpm_premium` already include the Ask Chef conversational benefit. Their tests pass; no pricing, plan entitlement or Clinical inheritance changes were needed.

## Verification

### Regression tests

**35 suites, 928 tests passed; 0 failed.**

- Entire Ask Chef conversation safety suite runs in **both Development and Production**.
- Entire destination navigation permission suite runs in **both Development and Production**.
- New and existing eligible Production members can message and restore saved conversation without assessment lookups.
- Production invokes the conversational engine, not the legacy structured assessment engine.
- Production reasoning/history/action contracts, clinical escalation, current entitlement matrix, unauthorized actors, unknown destinations and disallowed transfers are covered.
- Frontend conversation, branding, App Library/entry wiring, pricing copy, authentication/session/CSRF, current clinical authority, GLP-1, pregnancy and the prior grocery/native regressions passed.
- Obsolete tests asserting that Production must stay disabled were updated to the explicitly approved release contract. No tests were skipped or safety assertions removed.

### Production build proof

Executed the full release build with:

```sh
env -u VITE_COACHES_CORNER_ENABLED \
  NODE_ENV=production NODE_OPTIONS=--max-old-space-size=4096 \
  npm run release-check
```

Separately compiled and executed the **actual frontend visibility and experience modules** with `PROD=true`, `DEV=false`, and the visibility override undefined. Both evaluated to enabled. This verifies the code, not a mocked flag fixture.

The emitted `client/dist/assets/CoachsCorner-DpkdbLvn.js` contains the new “Ask Chef anything” conversational interface. The Production client and server builds completed.

### Running safe Production preview

Restarted the existing safe-start workflow once after the builds. Captured startup evidence confirms automatic migrations, seeding, recovery, schedules, workers and deferred release maintenance remained suppressed, and full initialization completed.

The running preview reports `ok: true`, `initialized: true`, `initError: null`, and billing enforcement enabled. Anonymous `/api/coach/bootstrap` and `/api/coach/conversation` return **401** with the active conversation revision header, proving the newly loaded Production router is present and authentication is not bypassed.

### Final release results

- Strict safety TypeScript check: **passed**.
- Root strict TypeScript release gate: **passed against the unchanged reviewed 118-diagnostic baseline**; no refresh, suppression or claim of zero legacy debt.
- Full release validation: **exit 0; 13 passed, 0 warnings, 0 failed**.
- No skipped regression tests.
- The unauthenticated screenshot of `/coach-corner/home` rendered the expected sign-in landing page without an application crash; it did not verify signed-in chat.

Detailed assertion identities, the normalized full release log, build-mode proof and sanitized readiness evidence are retained in `ask-chef-production-activation/`.

## Verification boundaries and release state

Signed-in screens and live paid-model responses were not exercised in a real member session. UI and authorization verification used real components/routers with isolated fixtures; no test conversations were written to shared Neon and no paid AI generation was initiated by verification.

The approved activation is in the integration source/build and safe workspace preview. The **published Production application has not been replaced**. Production branch refs remain unchanged.

**Remaining blockers identified by this scoped review: none.** The real-member/live-model verification boundary above remains explicit; this is not publication approval.

No merge, push, deploy or publish was performed.
