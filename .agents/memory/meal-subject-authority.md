---
name: Meal subject authority
description: Governs whose nutrition context applies when one person creates food for another.
---

**Rule:** Resolve dietary, allergy, clinical, and nutrition context for the person being fed. Treat the authenticated account as the actor, not automatically as the nutrition subject.

**Why:** Parent, caregiver, and professional workflows can otherwise leak the actor's personal restrictions or specialty settings into a child or client's meal.

**How to apply:** Carry explicit actor and subject identities through generation. Use subject-authoritative profiles and resolvers, while accepting actor-entered information only when it explicitly describes the subject's current meal request. Never fabricate compliance evidence for dimensions the server cannot independently validate.