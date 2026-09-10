---
name: Paid organization workspace visibility
description: Payment and login visibility rules for self-service Business organizations.
---

A self-service Business organization must not appear as an open workspace during authentication while its billing state is pending. Users start organization purchase from More, complete checkout, and only then receive an active organization workspace.

**Why:** Showing an unpaid setup record beside an existing paid organization makes the unpaid record look real, can route users back to checkout, and can hide their paid workspace.

**How to apply:** Workspace discovery, saved-selection recovery, and post-login routing must prefer active paid organizations and exclude pending-billing Business records. Keep pending records recoverable internally without presenting them as open workspaces.