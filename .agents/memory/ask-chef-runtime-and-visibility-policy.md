---
name: Ask Chef runtime and visibility policy
description: Founder separates Development workspace work, runtime parity, customer availability, and release permission.
---

Working in the Development workspace does not mean implementing functionality
restricted to Development at runtime. Approved Ask Chef conversation, navigation
and continuity functionality must work in Development and Production when the
feature is enabled. Do not add another broad release flag or activation system
unless technically necessary and explicitly justified.

**Why:** The founder clarified that the original request was to hide Coach's
Corner/Ask Chef from customers during development, not to restrict its internal
corrections to a Development runtime.

**How to apply:** Keep feature visibility/access separate from functional
behavior and from authorization to transfer code or publish. Other platform
changes must remain independently releasable while Ask Chef is hidden. Preserve
authentication, subscriptions, clinical safeguards and legitimate experiments.
Never declare approved functionality complete if it remains disabled under
Production runtime conditions without explicit founder authorization.

This correction's approval is for Development-workspace implementation and
verification only, not a push, merge, Production workspace change, publication,
or change to the current published visibility state.

**Why:** The founder explicitly retained those release boundaries.

**How to apply:** Report residual experimental restrictions and verification
limitations. Do not equate a hidden menu item with denied direct-route/API access.
