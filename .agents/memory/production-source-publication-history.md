---
name: Production source and publication history
description: Why a clean Production checkout diverges again and the boundaries for a permanent correction.
---

Treat GitHub Production as source authority. Preserve genuine local application work and return it through the reviewed GitHub process before replacing a diverged workspace history.

**Why:** The owner explicitly prohibited discarding unique Production fixes to recover a fast-forward pull. Publication history and application corrections can coexist on the same local branch.

**How to apply:** Compare actual source content, not only commit counts or patch identities. Preserve the current snapshot before synchronization. Generated changes are not permission to discard other files in the same checkpoint.

Do not promise that ignoring generated build metadata alone will prevent divergence. Replit publication checkpoints can be empty commits, and Agent checkpoints can capture source-tree build mutations.

**Why:** History inspection established that a previously clean synchronization was followed by build metadata changes and platform-tagged publication commits, including commits with identical parent/child file trees.

**How to apply:** A permanent correction must both keep builds from changing tracked source and isolate publication/checkpoint history from the source-mirror branch. The publication arrangement remains a recommendation until tested and approved; do not assume that automatic platform checkpoints can be disabled.

## Owner-controlled release standard

Commit and push verified, approved, Production-intended Development work to reviewable GitHub feature or release branches. Obtain explicit owner approval before merging into GitHub Production, deploying, publishing, or enabling Production feature flags.

**Why:** The owner explicitly established this standard on 2026-11-20, replacing the earlier automatic-promotion instruction: “Build in Development, verify it, push approved work to GitHub, and let me control when it goes live.”

**How to apply:** Preserve local work before reconciliation. Exclude unfinished experiments, secrets, temporary files, backup files and generated release noise from new release changes. Do not force-push, bypass branch protection or modify the separate Production workspace.

Production-intended features must have appropriate automated regression coverage, a verified Production build, documented configuration and a reviewable GitHub release path. Do not add Development-only restrictions or default-off Production feature flags unless the owner explicitly requests them. The owner controls what gets merged into Production and what gets published. Security, authentication, entitlements, clinical safeguards and account isolation remain enforced in every environment.

**Why:** The owner rejected Development-only dead ends and silent loss of completed functionality during deployment, then repeated: “When we write code and we put something in, don't block it from production ever again. I will control what gets produced, what goes to production, and what gets published, not you.”

**How to apply:** Distinguish genuinely unintended Development dependencies from explicit owner-approved Development-only holds. Preserve those holds and unrelated experiments until separately authorized; do not enable broader experimental flags just to release a narrow feature.

## Mandatory Production parity

All approved My Perfect Meals features and interface improvements must function
in both Development and Production. Development is where changes are made and
tested, not a restriction on where approved functionality may run.

**Why:** The founder repeated this as a mandatory rule after approved interface
improvements differed between Development and the published application.

**How to apply:** Never place approved features, layouts, buttons, styling or
functionality behind `isDevelopmentRuntime`, `import.meta.env.DEV`,
`NODE_ENV === "development"` or equivalent restrictions unless the founder
explicitly requests Development-only runtime behavior. Never add Production-off
flags without explicit authorization. Preserve security, clinical safety,
credentials, infrastructure and environment-specific service configuration.
Report existing restrictions affecting the requested feature and resolve them
when authorized. Permission to modify only the Development workspace never
means permission to restrict the runtime. Verify accessibility and behavior
under Production runtime conditions before declaring release readiness; a
Development-only pass is insufficient. Do not push, merge, deploy, publish or
modify Production infrastructure without explicit founder approval.

For release-parity investigations, compare merged source with the assets
actually served, not source or environment flags alone.

**Why:** A published shopping stylesheet lacked contrast and safe-area changes
that were already present in merged source, while a separate merged Recipe Maker
layout really was guarded by Development runtime conditions.

**How to apply:** Distinguish unpromoted source changes, stale compiled assets,
actual runtime restrictions and browser caching using direct evidence. Do not
claim a rebuild fixes a true runtime gate or that removing a gate fixes missing
release source. Test expectations from an older implementation do not establish
current Production parity.

## Released Shopping Product Options

Shopping Product Options must be available by default in Development and Production,
including its governed lookup and persistence. Do not restore opt-in release flags
or couple it to the broader metadata-store or Grocery Coach experimental switches.

**Why:** After pulling the merged release, the owner found the button absent in
Production and explicitly required removing the off-by-default behavior, then
pushing and merging the correction into GitHub Production.

**How to apply:** Preserve subscription checks, authentication, account isolation,
ingredient eligibility and safety/evidence validation. Keep unrelated experiments
under their existing holds. Build and restart requirements for older compiled
artifacts are not feature activation requirements.

## Commit-hook checkout isolation

When a Git hook creates a linked checkout, clear inherited `GIT_INDEX_FILE` for
its worktree operations, but keep the original index when reading the staged diff.

**Why:** Git passed `.git/index` into the commit hook. Inside the linked checkout,
`.git` is a file, so checkout creation failed before validation could execute.

**How to apply:** Keep the staged-source integrity checks active; do not bypass
the hook to work around this environment problem.
