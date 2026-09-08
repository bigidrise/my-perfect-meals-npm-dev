---
name: Organization Location isolation
description: Governs multi-Organization and multi-Location access under one MPM identity.
---

Organization administration and Location operational access are separate grants. An active workspace is always one exact Organization and one Location that belongs to it, with current authorization to both; parent access alone never exposes Location people or clinical data.

**Why:** One identity may work across unrelated enterprises and Locations with different roles. Treating parent membership as inherited clinical access would create cross-Location and cross-enterprise privacy risk.

**How to apply:** Validate both grants server-side on every workspace-context resolution, fail closed for inactive or revoked access, auto-select only when exactly one authorized Location exists, and require explicit selection when more than one is available.