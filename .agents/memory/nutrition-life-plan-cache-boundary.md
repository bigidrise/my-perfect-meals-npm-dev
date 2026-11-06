---
name: Nutrition Life Plan cache boundary
description: Why dashboard baseline targets and day context have distinct freshness and day semantics.
---

The dashboard's macro pills are saved baseline targets, never Performance effective-day or remaining targets. Cache the stable plan separately from hydration, glucose, pregnancy week, care-team notices, and today's Performance description. Preserve the existing self-summary authorization and clinical envelope rather than substituting specialist endpoints for the changing fields.

**Why:** A combined zero-freshness request delayed baseline display behind day-specific work, while using a specialist endpoint would change access and target semantics. The current Performance description uses the server-local weekday; changing that clock while splitting the API could silently alter what day the user sees.

**How to apply:** When adding plan mutations, classify whether they change saved baseline authority, day context, both, or neither. Keep baseline revalidation bounded for external changes. Treat a future user-timezone change as a separate reviewed behavior change, not as a cache optimization.

The founder wants the Dashboard Life Plan section, title, and layout to appear immediately, with member-specific information populated independently afterward. Never show invented nutrition numbers or another member's cached information while waiting.

**Why:** The founder supplied this as the preferred approach to investigate for visibly delayed Dashboard rendering, while requiring a report and approval before implementation.

**How to apply:** Evaluate static presentation separately from personalized-data readiness. This product direction does not authorize implementation, broader caching changes, or relaxed nutrition freshness.