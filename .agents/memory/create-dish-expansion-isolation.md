---
name: Create a Dish expansion isolation
description: Durable architecture boundary for ingredient expansion across creator phases.
---

**Rule:** Ingredient expansion is a typed, catalog-first capability owned exclusively by `create_a_dish`; it may call shared technique and governance systems but must not modify generic creator behavior.

**Why:** Create a Dish shares its generation endpoint with Craving Creator. Adding broad-ingredient behavior to the shared prompt or generic route branch would silently change other creators and create a second source of food-governance decisions.

**How to apply:** Keep recognition, culinary compatibility, AI gap validation, and Surprise Me resolution behind the dedicated expansion contract. Treat outputs as culinary intent only, re-resolve authoritative context during generation, and preserve shared Development/production route parity.

Generation must revalidate every option ID and compatibility against current server data. Intent evidence is checked on the exact final recipe payload after bounded repair, creator transformation, formatting, and universal food validation; earlier candidates are not sufficient proof.