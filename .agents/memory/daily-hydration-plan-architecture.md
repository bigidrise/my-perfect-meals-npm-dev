---
name: Daily Hydration Plan architecture
description: Confirmed modeling principles and implementation gate for MPM hydration intelligence.
---

MPM hydration must be a server-authoritative domain split into immutable intake events, versioned effective daily plan revisions, and recomputable daily state. All features consume this one resolved state; GLP-1, performance, pregnancy, future dysautonomia/POTS, clinician instructions, and preferences contribute typed inputs rather than independent calculators.

**Why:** Separate hydration calculations and browser-owned totals cannot safely resolve restrictions, explain historical behavior, synchronize across devices, or support clinical review.

**How to apply:** The product owner has affirmed the nonclinical scope lock: one authority, immutable factual history, explicit unknowns, typed plan states, no averaged conflicts, authenticated/auditable access, lossless migration, and disabled Phase 1 infrastructure. Task #1472 remains implementation-blocked until the exact engineering blueprint is separately reviewed and approved; external review blocks activation of individual clinical rules, not generic inactive infrastructure. Preserve every plan revision, policy version, and effective interval; mid-day policy/clinician changes create a superseding revision rather than rewriting history.