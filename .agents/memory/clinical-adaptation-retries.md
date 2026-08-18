---
name: Clinical adaptation retry activation
description: Clinical (diabetic/GLP-1) generator behavior must key off server-resolved context, not client dietType
---

**Rule:** Any generator-side clinical behavior (extra retries, adaptation passes, macro ceilings) must activate from the server-authoritative `clinicalGenerationContext` produced by the chef budget resolver (the same signal the route's post-gen clinical macro gate uses) — never from the client-selected `dietType` alone. Client dietType and server glp1Targets are additional activation sources.

**Why:** The route gate fires for profile-confirmed diabetic/GLP-1 users on EVERY builder, regardless of the diet the client sends. If generator adaptation only checks client dietType, a diabetic user with a non-diabetic builder gets no adaptation retries and hits the gate rejection — exactly the mismatch a code review rejected.

**How to apply:** Activate generator-side clinical behavior from the same server-resolved signal the post-gen clinical gate uses (single shared activation helper), never from client dietType alone. Keep the route gate fail-closed as the final safeguard with a graceful constraint-outcome response.
