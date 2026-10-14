---
name: Signup email and username identity
description: Distinct full email addresses remain independent identities even when their local parts match.
---

Treat the complete normalized email address as the unique email identity.
Matching email prefixes never authorize merging, linking, or changing existing
accounts. A collision in an automatically assigned internal username must not
prevent a different email address from registering.

**Why:** The user explicitly required independent registration for different
domains with the same email prefix, while preserving existing credentials,
roles, subscriptions, usernames, and relationships.

**How to apply:** Preserve database uniqueness as the signup authority. Keep
username allocation separate from email identity and keep duplicate-email
outcomes distinct from username collisions. Preserve the atomic account and
invitation-claim creation boundary when retrying; do not broaden retries to
unrelated failures or modify existing accounts to accommodate a signup.
