---
name: Create a Dish expansion isolation
description: Durable architecture boundary for ingredient expansion across creator phases.
---

**Rule:** Ingredient expansion is a typed, catalog-first capability owned exclusively by `create_a_dish`; it may call shared technique and governance systems but must not modify generic creator behavior.

**Why:** Create a Dish shares its generation endpoint with Craving Creator. Adding broad-ingredient behavior to the shared prompt or generic route branch would silently change other creators and create a second source of food-governance decisions.

**How to apply:** Keep recognition, culinary compatibility, AI gap validation, and Surprise Me resolution behind the dedicated expansion contract. Treat outputs as culinary intent only, re-resolve authoritative context during generation, and preserve shared Development/production route parity.

Generation must revalidate every option ID and compatibility against current server data. Intent evidence is checked on the exact final recipe payload after bounded repair, creator transformation, formatting, and universal food validation; earlier candidates are not sufficient proof.

**Rule:** Phase 2 structured intent carries only Form/Cut, Texture, and Flavor. Cooking Method and Cuisine remain authoritative through their existing controls. Active selections are hard generation constraints, and generic variety may vary only unselected dimensions.

**Why:** Soft prompt wording plus generic method/flavor variation caused three otherwise-valid candidates to ignore selected intent and all fail the final evidence gate. Hidden Method/Cuisine fields also allowed stale client state to reactivate removed controls.

**How to apply:** Reject extra structured-intent dimensions at the server boundary, sanitize client intent construction, place active culinary intent above profile defaults, and keep the final evidence gate strict.