---
name: Email-case duplicate safety
description: Development users can contain duplicate addresses that differ only by capitalization.
---

Email identity updates must target the exact user ID (or exact stored email), not a case-insensitive email predicate, because the development database permits distinct rows whose emails differ only by capitalization.

**Why:** A case-insensitive subscription update matched both a lowercase test account and a separately stored capitalized trainer account; the unintended row had to be restored immediately.

**How to apply:** Resolve and verify the target user ID first, then update by primary key. Treat email casing as an account-selection hazard until uniqueness is normalized.

Every email-addressed invitation flow must also resolve the authenticated recipient by user ID, reject duplicate normalized-email candidates, and compare normalized addresses only after uniqueness is established. Do not let a code or token select one legacy case variant.

**Why:** A forwarded invitation or case-insensitive address check can grant membership, access, or trial state to the wrong legacy account.

**How to apply:** Reject duplicate identity groups at invitation creation and acceptance; only perform the access, membership, trial, or invite-status mutation after the unique recipient has been verified.