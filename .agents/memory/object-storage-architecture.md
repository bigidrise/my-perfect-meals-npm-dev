---
name: Object Storage verification boundaries
description: Historical signed-URL failures, authoritative environment context, and limits of no-write readiness checks.
---

Resolve storage through the application's current environment authority; never treat historical bucket IDs or provider failures in memory as current configuration.

**Why:** An earlier SDK fallback recovered failures involving disconnected buckets and a signed-URL sidecar. That incident does not establish today's active Production bucket or prove that S3 remains broken. Production and Development now deliberately have different storage authority.

**How to apply:** Inspect current resolution code and gather fresh, bounded read-only evidence. Do not switch buckets, change secrets, create replacement buckets, or retry legacy sidecar workarounds based only on historical notes.

Release verification without storage-write approval must distinguish configuration/read readiness from upload durability.

**Why:** The owner prohibited unnecessary storage writes during release review. The existing full-health canary creates an object even though its request is a GET; a missing legacy S3 capability field is not proof of a storage outage.

**How to apply:** Use a genuinely read-only probe, fail explicitly on invalid configuration or SDK read errors, and state whether only metadata/list access was tested. Do not claim uploads or full object download were verified without exercising them under separate authorization.
