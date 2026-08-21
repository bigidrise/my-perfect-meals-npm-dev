---
name: Authenticated API vs client cache identity
description: Separate server-derived ownership from client-side identity needed to prevent stale account data during account switching.
---

Authenticated API requests must derive record ownership from the session or token and must not send a caller-controlled user ID. That does **not** mean the client can discard the current account ID: it remains necessary as local UI and cache identity.

**Why:** Removing the local identity from a component dependency or React Query key can let sensitive data fetched for account A remain rendered or cached after a switch to account B, even when the server correctly rejects cross-account API access.

**How to apply:** Keep the account ID out of request URLs and bodies unless it is an explicitly authorized delegated selector. Include it in local query keys, remount or reset account-scoped components on changes, cancel or reject stale async responses, and scope browser storage holding account-specific state.