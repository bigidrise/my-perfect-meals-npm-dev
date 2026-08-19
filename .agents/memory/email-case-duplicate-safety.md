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

Route-level regression coverage for this rule must seed actual case-variant user rows and exercise the invitation handler, not only the pure resolver.

**Why:** Resolver-only tests cannot detect a later ordering regression that lets a route create membership, extend a trial, or mark a token accepted before checking the duplicate group.

**How to apply:** When changing an email-addressed acceptance path, run database-backed requests for both legacy case variants and assert the relevant membership, trial, and invitation records remain unchanged; retain one unique-account acceptance as the control case.