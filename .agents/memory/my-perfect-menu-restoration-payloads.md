---
name: My Perfect Menu restoration payloads
description: Full-body restoration and failure-semantics rules for persisted concept sets.
---

My Perfect Menu remount restoration must receive a complete authoritative JSON representation for both the effective Builder and persisted concepts. Conditional HTTP responses with no body are incompatible with rebuilding cleared in-memory state.

**Why:** A repeated Builder round trip exposed a bodyless cache revalidation response that left the remounted page empty even though the persisted set still existed.

**How to apply:** Keep restoration endpoints narrowly non-cacheable/full-body, preserve server persistence as authority, and never interpret an unusable or failed restoration request as proof that a category is empty or permission to generate replacements.