---
name: Saved support compatibility
description: Established support settings must survive unrelated consumer health edits without permitting new legacy activation.
---

Unrelated consumer health edits must retain already-established Therapeutic Support and Performance Nutrition settings even when this form no longer offers their activation controls. Retention is not permission to activate those legacy settings on another account.

**Why:** Valid Oncology and Production specialty-profile saves were rejected because the profile also carried established support flags outside the endpoint's current self-selection list.

**How to apply:** Resolve retention from the fresh, locked server-side record, never from client claims. Preserve established flags when omitted by an unrelated form; reject requested legacy flags absent from the authoritative record. Retention applies in both Development and Production; it must not depend on Oncology symptom feature gates. Production retention must leave Oncology context untouched. Keep clinical ownership and Development-only oncology gates unchanged.
