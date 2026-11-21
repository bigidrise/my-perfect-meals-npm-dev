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

Production-intended features must have appropriate automated regression coverage, a verified Production build, documented configuration and a reviewable GitHub release path. Do not add unconditional Development-only restrictions to such features; staged availability needs an independently configurable Production flag with its purpose explained. Security, authentication, entitlements, clinical safeguards and account isolation remain enforced in every environment.

**Why:** The owner rejected Development-only dead ends and silent loss of completed functionality during deployment.

**How to apply:** Distinguish genuinely unintended Development dependencies from explicit owner-approved Development-only holds. Preserve those holds and unrelated experiments until separately authorized; do not enable broader experimental flags just to release a narrow feature.
