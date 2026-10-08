---
name: Shared Neon and workspace release boundary
description: Development and Production are separate workspaces sharing external Neon; publishing Development does not release Production.
---

Development and production use the same external Neon database; this project does not use Replit's managed database. Do not suggest proving database isolation between the two or raise it as a blocker or follow-up.

**Why:** The user explicitly confirmed the shared Neon arrangement and asked us to stop revisiting the database question.

**How to apply:** Treat the arrangement as settled project context. Do not initiate database investigation or changes unless a future request explicitly requires them.

For explicitly approved additive, Development-only clinical storage, "Development-only" gates the migration command and application access, not the physical schema: new tables exist on shared Neon while food reads remain unchanged. Do not substitute a requirement for a separate Development database after that approval.

**Why:** Requiring independent branch isolation contradicted the confirmed shared-database arrangement and delayed an approved additive migration.

**How to apply:** State the shared-schema consequence before the write, keep changes additive and runtime-gated, and require separate approval before any food-read cutover or destructive data operation.

Development and Production are separate Replit workspaces. Publishing this Development workspace does not update the Production workspace; approved code must be promoted through GitHub, synced into the Production workspace, verified there, and only then published there.

**Why:** An incorrect suggestion to publish Development during an urgent billing incident would not have delivered the repair action to the separate Production workspace.

**How to apply:** Inspect branch and release scope before proposing a GitHub promotion; never describe this workspace's Publish action or deployment URL as the live Production release. The shared Neon data can be inspected read-only here, but Production runtime failures require evidence from the Production workspace.

The user identifies `https://my-perfect-meals-npm-dev-1.replit.app` as the Development workspace's public URL, not the separate Production app.

**Why:** The user clarified this distinction after initially calling a screenshot from that URL a Production issue.

**How to apply:** Distinguish the published Development app from the Development preview and the separate Production workspace. Verify current deployment metadata rather than inferring workspace scope from a public `.replit.app` URL.