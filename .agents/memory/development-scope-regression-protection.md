---
name: Development scope and regression protection
description: Founder-required scope approval, additive changes, and customer-journey evidence for MPM development.
---

Every MPM development task must have a defined scope. Add only the requested change; do not subtract or change existing functionality unless those changes are discussed and approved first. Necessary out-of-scope changes must be explained and approved before implementation.

**Why:** The founder explicitly required this after a loading/reliability change exposed a different Shopping presentation and existing customer actions remained unavailable.

**How to apply:** Before implementation, document existing behavior, the precise authorized additions and affected components/actions/data contracts. Identify regression coverage proving both old and new workflows. Preserve recommendations, buttons, data handling and workflows when the request concerns only shimmer. Verify the actual customer journey rather than relying only on button rendering or unit tests; report unavailable verification honestly. A diagnosis or plan is not implementation authorization.

Shopping acceptance must cover ordinary incomplete recommendation-to-catalog identity, not only artificial perfect-match fixtures. An available handler is not proof that the customer can see and use Choose Product. Verify the primary shopping-row label after confirmation and reload.

**Why:** The founder rejected completion after real Product Options still lacked Choose Product despite a passing exact-match fixture journey.

**How to apply:** Exercise the actual review-only renderer with recommendations that omit package/variant details. Do not relax source-identity or clinical rules to make the button work. Distinguish a suggested name from an explicitly reviewed source product, retain confirmation and uncertainty, and report genuinely unavailable choices plainly.
