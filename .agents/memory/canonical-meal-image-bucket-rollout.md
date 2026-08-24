---
name: Canonical meal-image bucket rollout
description: Canonical meal-image bucket policy and the development workspace permission constraint.
---

Permanent meal-image writes and returned URLs must use
`replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491`. Only the retired
`e02a723e` and `2a68d585` IDs may remap to it on reads; unknown IDs must remain
unchanged.

**Why:** A development startup probe on 2026-08-24 showed the code correctly
targeting the canonical bucket, but the workspace service account lacked
`storage.objects.create` permission. Code-level URL remapping cannot repair a
missing Replit Object Storage attachment or IAM binding.

**How to apply:** Do not claim real meal-image upload certification until the
canonical bucket is attached/authorized for the development workspace and a
write-read canary succeeds. Keep storage configuration changes separate from
source-only repair work.