---
name: Integration and activation boundaries
description: Why Development source merges require whole-subsystem compatibility review without silently activating experiments.
---

Review automatically merged dependencies and environment gates, not only explicit Git conflicts. A source integration is not permission to activate Development-only experiments, change the reviewed type baseline, or run shared-database migrations.

**Why:** An incoming image wrapper can use the same approved model identifier yet reject Production execution behind a Development activation gate. Retaining only conflicted call bodies can also leave missing helpers or dangling imports in automatically merged consumers.

**How to apply:** Preserve the coherent authorized Production subsystem unless its replacement is approved and compatible. Trace excluded bootstrap/authentication modules through their consumers. Report dormant feature gates and failing release checks explicitly rather than treating a successful source merge or smaller diagnostic count as release approval.

Entitlement verification and feature activation require separate authorization. Ask Chef's Production visibility and conversational experience now have explicit owner approval; this is not approval for other Development-only experiments.

**Why:** The owner initially required Ask Chef to remain off during entitlement audits, then separately approved its Production activation. Correct pricing copy or passing access tests alone never authorized that transition.

**How to apply:** Preserve unrelated environment gates, the Pro/Clinical paywall, destination-specific permissions, clinical safeguards, and established family/provider access. Do not activate Ask Chef by making Production behave globally like Development. Its released entry must open conversation rather than the former assessment.
