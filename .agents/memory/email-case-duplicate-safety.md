---
name: Email-case duplicate safety
description: Development users can contain duplicate addresses that differ only by capitalization.
---

Email identity updates must target the exact user ID (or exact stored email), not a case-insensitive email predicate, because the development database permits distinct rows whose emails differ only by capitalization.

**Why:** A case-insensitive subscription update matched both a lowercase test account and a separately stored capitalized trainer account; the unintended row had to be restored immediately.

**How to apply:** Resolve and verify the target user ID first, then update by primary key. Treat email casing as an account-selection hazard until uniqueness is normalized.