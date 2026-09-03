---
name: Stateless Human Food retries
description: Approved privacy and authority boundary for retries and rerolls in human food generation.
---

Human Food Context is immutable and request-local. Internal generation, validation, repair, and retry attempts reuse the exact resolved object, while rejected-candidate history lives only in request-local execution state.

**Why:** Cross-request receipts would duplicate sensitive health and nutrition context, create key-management and cleanup obligations, and risk serving stale state after meals, allergies, or clinical protocols change.

**How to apply:** Treat every later user reroll as a new authenticated request and resolve canonical context again. Run request preflight scans on raw user input before appending resolved context or safety prompt blocks, or stored restrictions can be mistaken for requested ingredients. Never accept identity, resolved context, clinical state, nutrition state, fingerprints, or provenance from the client. Never fall back to generic food when critical context cannot be resolved.