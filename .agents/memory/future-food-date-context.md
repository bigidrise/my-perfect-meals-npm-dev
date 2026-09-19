---
name: Future food date context
description: Date-specific food generation must use one destination date across all authoritative resolvers.
---

When a food is generated for a selected future date, bind that date to Human Food Context, daily nutrition, medication/GLP-1 context, and every other date-sensitive resolver.

**Why:** Passing the destination date only to meal-budget logic can make final validation compare a future meal against today's remaining targets or clinical state.

**How to apply:** Derive one validated local-date value at the request boundary and pass it through every authoritative context and validation call used by that generation.