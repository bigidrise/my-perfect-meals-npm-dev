---
name: Integration and activation boundaries
description: Why Development source merges require whole-subsystem compatibility review without silently activating experiments.
---

Review automatically merged dependencies and environment gates, not only explicit Git conflicts. A source integration is not permission to activate Development-only experiments, change the reviewed type baseline, or run shared-database migrations.

**Why:** An incoming image wrapper can use the same approved model identifier yet reject Production execution behind a Development activation gate. Retaining only conflicted call bodies can also leave missing helpers or dangling imports in automatically merged consumers.

**How to apply:** Preserve the coherent authorized Production subsystem unless its replacement is approved and compatible. Trace excluded bootstrap/authentication modules through their consumers. Report dormant feature gates and failing release checks explicitly rather than treating a successful source merge or smaller diagnostic count as release approval.

Entitlement verification and feature activation require separate authorization.

**Why:** The owner explicitly requested pre-release paywall corrections while requiring Ask Chef to remain off. Correct pricing copy or a passing access matrix is not activation approval.

**How to apply:** Keep existing environment gates intact during entitlement audits. Treat eligible-tier access as conditional on a later approved activation, and preserve existing family and provider/client access rather than replacing those policies with a personal-plan-only rule.
