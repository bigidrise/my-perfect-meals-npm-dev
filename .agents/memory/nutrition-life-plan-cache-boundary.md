---
name: Nutrition Life Plan cache boundary
description: Why dashboard baseline targets and day context have distinct freshness and day semantics.
---

The dashboard's macro pills are saved baseline targets, never Performance effective-day or remaining targets. Cache the stable plan separately from hydration, glucose, pregnancy week, care-team notices, and today's Performance description. Preserve the existing self-summary authorization and clinical envelope rather than substituting specialist endpoints for the changing fields.

**Why:** A combined zero-freshness request delayed baseline display behind day-specific work, while using a specialist endpoint would change access and target semantics. The current Performance description uses the server-local weekday; changing that clock while splitting the API could silently alter what day the user sees.

**How to apply:** When adding plan mutations, classify whether they change saved baseline authority, day context, both, or neither. Keep baseline revalidation bounded for external changes. Treat a future user-timezone change as a separate reviewed behavior change, not as a cache optimization.

The founder wants the Dashboard Life Plan section, title, and layout to appear immediately, with member-specific information populated independently afterward. Never show invented nutrition numbers or another member's cached information while waiting.

**Why:** The founder explicitly authorized the smallest Development-only first-render correction for visibly delayed Dashboard rendering, without changing nutrition calculations, member-specific caching, API contracts, or clinical guardrails.

**How to apply:** Keep static presentation separate from personalized-data readiness, retain truthful loading/error/empty states, and never infer approval for broader caching changes, relaxed freshness, or Production release.