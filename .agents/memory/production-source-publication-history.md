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

Prepare verified, approved, Production-intended Development work for a reviewable GitHub release path. Do not push, merge, deploy, publish, or modify Production infrastructure without explicit founder approval.

**Why:** The owner explicitly established this standard on 2026-11-20, replacing the earlier automatic-promotion instruction: “Build in Development, verify it, push approved work to GitHub, and let me control when it goes live.”

**How to apply:** Preserve local work before reconciliation. Exclude unfinished experiments, secrets, temporary files, backup files and generated release noise from new release changes. Do not force-push, bypass branch protection or modify the separate Production workspace.

All approved My Perfect Meals features and interface improvements must function in both Development and Production. Development is where changes are made and tested, not a restriction on where approved functionality may run.

Never wrap approved features, layouts, buttons, styling, or functionality in `isDevelopmentRuntime`, `import.meta.env.DEV`, `NODE_ENV === "development"`, or equivalent Development-only conditions unless the founder explicitly requests Development-only runtime behavior. Never introduce Production-off feature flags or environment restrictions for approved functionality without explicit authorization.

Preserve existing security, clinical safety, credentials, infrastructure, and environment-specific service configurations, including authentication, entitlements and account isolation.

**Why:** The founder explicitly made Production parity mandatory: “Development is where changes are made and tested. It is not a restriction on where those features may run.” Permission to modify only the Development workspace must never be confused with permission to restrict functionality to the Development runtime.

**How to apply:** Before completing any task, verify that approved functionality is accessible under Production runtime conditions. Appropriate regression coverage, a verified Production build, documented configuration and a reviewable release path remain required. A feature working only in Development is not complete or release-ready; it must also pass Production-runtime verification. Report existing environment restrictions affecting the feature and resolve them when authorized. Preserve explicit founder-approved Development-only runtime holds and unrelated experiments until separately authorized; do not enable broader experimental flags just to release a narrow feature.

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
