# Ask Chef navigation: final release candidate

## Scope and authority

This candidate preserves the existing enabled Ask Chef experience and all
approved navigation/continuity corrections. It adds no customer functionality,
runtime gate, dependency, migration, or environment change.

The founder controls feature availability, GitHub promotion, the separate
Production workspace, and publishing independently. Nothing was pushed, merged,
published, or changed in that workspace.

This turn changes test fixtures, a dedicated test setup, and release
documentation only. It does not change the application runtime implementation.

## Availability and security

The founder's written policy authorizes FALSE to hide a feature AND prevent
customer access. TRUE must expose the same approved functionality in either
supported runtime. The existing middleware conforms to that policy:

- `requireAskChefAvailability` checks only whether the existing
  `VITE_COACHES_CORNER_ENABLED` value is exactly `"false"`.
- With TRUE, it calls the next handler without changing the request, response,
  navigation, AI instructions, or conversation state.
- With FALSE, it returns HTTP 404 / `CHEF_UNAVAILABLE` before authentication,
  database work, model calls, or protected handlers.
- It protects the engine router, navigation/receipt router, and legacy
  Coach's Corner router. It is not a global application middleware.
- TRUE does not grant authentication, subscriptions, destination permissions,
  access to another member's conversation, or an exemption from clinical safety.
- Keeping this middleware prevents direct API use of an intentionally unavailable
  feature. Removing it solely because FALSE denies access would weaken that
  availability boundary.
- A 404 prevents an unavailable feature being exposed through these handlers;
  it is not a replacement for authentication, CSRF or resource ownership checks.
- Nonliteral spellings are not parsed as false. Preserve the documented
  lowercase `"true"` / `"false"` values.

The client applies the same availability decision to navigation entries and
`/coach-corner/*` route registration. A manually entered hidden URL does not
instantiate the feature route. The SPA may still return an HTML shell with HTTP
200; that is not authenticated access to Ask Chef. The API guard independently
enforces FALSE.

### Independent build and runtime delivery

Inspection of this workspace confirmed `VITE_COACHES_CORNER_ENABLED="true"` in
its Development and Production environment configurations. Neither was changed.

- Vite reads the client value at build time through `import.meta.env`.
  Changing customer-visible routes/entries requires rebuilding and releasing
  the client assets; restarting an old client build cannot change that value.
- The server reads `process.env` on each request, but its process environment
  comes from startup configuration. A configured value change requires restarting
  or republishing the relevant server process to receive it.
- An already-published application does not change because a workspace setting
  or local build changed. Updating the published deployment is a separate
  founder-controlled action.
- Both stages must receive the intended value. A FALSE server with a TRUE
  client displays an entry whose APIs deny access; the reverse hides the client
  routes while leaving authenticated APIs available.
- Existing unset defaults are unchanged: the Production client is visible unless
  explicitly false; Development requires true; the API guard continues unless
  explicitly false. No second availability flag was added.

With the reviewed TRUE configuration, neither stage disables the approved
experience. The separate Production workspace's effective environment was not
inspected, changed, or certified.

## Remaining Development-only differences

`server/services/coaching/coachingContext.ts` still uses `developmentEvidence`
for corner profile/evidence fields, local date/time interpretation, prescription
qualification, some history/intake queries, and the `memberEvidence` prompt
projection. `renderSnapshotForPrompt` also selects that projection only in
Development.

This is a real customer-facing nutrition-context difference, not complete
platform-wide parity. It is documented rather than rewritten here. No specific
approved navigation workflow was found to depend on that alternate evidence
representation. Navigation state loading, current selections, offer acceptance,
verified handoffs and receipts use their approved paths in both runtimes.
This candidate makes no claim that all nutrition-evidence behavior is identical.

Feature Intelligence's generated explanations, current-screen context and
experimental tool narrowing remain behind their existing explicitly authorized
Development-only experiment controls. They are not activated or made navigation
release dependencies. Additional Development diagnostic detail is nonfunctional.

## Exact proposed promotion scope

The complete allowlist is
[ask-chef-navigation-candidate-files.txt](ask-chef-navigation-candidate-files.txt).
It contains 64 paths: the approved navigation implementation and tests, scoped
test-harness changes, and release documentation.

Comparison base: cached `origin/production` at
`c5a96894c`. Reviewed source HEAD before this turn: `a5de7024f`.
Neither remote was fetched and neither ref was moved.

The existing branch has ten commits after that cached Production base:

```text
4ff201fbd  Release approved Ask Chef navigation corrections
2e5efed64  Update coaching services and memory documentation
32bc87946  Implement chef navigation authority and add meal builder tests
83a6a0367  Implement chef navigation authority and add recovery test suite
c5a799fb7  Implement conversation clearing functionality and add associated tests
1c4c1695a  Implement navigation authority and chef-founder handoff logic
1b20cf6c6  Refactor chef coaching conversation logic and update response handling
fda7604b8  Implement chef navigation authority and update coaching continuity logic
09c7ed1cc  Add research release sequence to agent memory index
a5de7024f  Refactor coaching engine services and update related component logic
```

This is NOT authorization to promote those commits unfiltered. The candidate
is the allowlisted file diff plus this turn's test/documentation changes, not a
whole-branch merge. A scoped candidate patch is generated separately under the
ignored `generated-artifacts/ask-chef-release/` directory.

Excluded:

- All `.agents/memory/**` changes, including the unrelated Business reference
  consolidation and its main-index rewrite. Agent policy notes can remain local
  without becoming application-release dependencies.
- `artifacts/mockup-sandbox/src/.generated/mockup-components.ts`.
- Uploaded founder instructions, generated build/test output, and unrelated
  workspace configuration.

This avoids reverting anyone's unrelated local work, changing branches, staging
changes, or rewriting commit history. A future GitHub candidate must use the
scoped allowlist/patch; pushing the full existing branch would carry exclusions.

## Verification method

The final regression command includes all changed test suites in the allowlist
plus the existing navigation contract suite, in one Jest invocation.
`chefReleaseProduction.setup.ts` replaces the normal Jest setup that otherwise
forces NODE_ENV=test. Ordinary fixtures inherit Production; paired runtime and
diagnostic tests retain explicit Development controls. JSDOM preloads React's
development renderer solely for act(), then loads application modules under
Production configuration. These component checks are not a production-browser
rendering or physical iOS claim.

Provider and database dependencies are synthetic/mocked; receipt SQL uses its
existing isolated test machinery. No real-account messages, shared-database
mutations, paid model calls, or live Production process were needed.

The build checks compile the Production Vite client and Production server and
verify the built release manifest. They intentionally omit the build-version
writer: this is a verification build, not a customer-release cut or publication.
Safety and root release-type checks retain their existing compiler settings
and reviewed baseline.

Initial expanded checks exposed obsolete tests requiring older Production
wording, knowledge, care-history persistence and fallbacks. Only those test
expectations were corrected to the already-approved behavior; the application
was not altered to make stale expectations pass.

### Final results

One complete final invocation passed **26/26 suites and 1,167/1,167 tests**,
including every changed test suite in the candidate and the existing navigation
contract suite. No failures or skipped tests were reported.

The exact argv is recorded in
`generated-artifacts/ask-chef-release/regression-command.json`; the machine
results are in `jest-results.json` in that directory.

| Check | Result |
| --- | --- |
| Complete release-candidate regression | PASS: 26 suites, 1,167 tests |
| Production Vite client build | PASS |
| Production server build | PASS |
| Built release manifest verification | PASS; existing release identity retained |
| Safety TypeScript | PASS |
| Root release TypeScript gate | PASS; unchanged reviewed 110-diagnostic baseline |
| Production and Development TRUE/FALSE availability controls | PASS in isolated tests; client direct-route registration also reviewed |
| Live signed-in FALSE browser configuration | Not performed; existing TRUE configuration was not changed |

Existing Vite large-chunk/server bundle-size and ts-jest deprecation warnings
remain non-failing. No dependency, compiler setting or diagnostic baseline was
changed to suppress them.

## Assessment

**GO for preparing the scoped GitHub release candidate for founder review.**
There is no demonstrated navigation dependency requiring expansion into the
member-evidence rewrite, and the retained availability middleware does not block
the approved TRUE experience.

This assessment applies to the 64-path candidate, not an unfiltered branch push.
The current branch still contains unrelated historical changes; the generated
scoped patch excludes them without rewriting history.

This is not a claim that the founder-only checks below passed, that the separate
Production workspace was verified, or that publication was authorized. No
automatic runtime gate was added to enforce this report.

## Founder-only signed-in acceptance

Using an account with the required destination access:

1. Ask to plan the week, explicitly select My Perfect Menu, and tap the action.
   Expect `/foods-i-enjoy` without another permission question.
2. Say "Take me to my shopping list" and tap the action. Expect
   `/shopping-list-v2`.
3. Request a protein shake, accept the offer with "yes", then say "open it"
   before tapping. The same valid Beverage Creator action should remain
   available; tapping it should reach `/lifestyle/beverage-creator`.
4. Return after that navigation. An unrelated yes must not resurrect the
   performed offer. A new explicit request may produce a new action.
5. At the dessert choice, verify whole pie goes to `/craving-desserts`, small
   treat goes to `/craving-creator`, and bare yes requests a choice. Reload
   during the pending choice and verify continuity.
6. Select Meal Builders and ask "Where is my builder?" in that established
   context. Expect the `/builders` entry, never an inferred clinical builder.
7. Reload a conversation with a fresh pending offer; verify continuity. Clear
   that conversation and verify unrelated conversations remain intact.
8. On the founder's iOS device, verify the action is above the safe area,
   tappable, reaches the intended page, and preserves the chat on return.

These live-model/device checks remain founder acceptance, not asserted automated
successes. They do not justify introducing another runtime release gate.
