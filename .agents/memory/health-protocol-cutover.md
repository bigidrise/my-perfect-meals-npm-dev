---
name: Health protocol cutover boundary
description: Why source-aware clinical protocol reads need an all-surface, review-gated cutover.
---

Do not treat ambiguous legacy health entries as verified current medication or silently let a partially migrated food tool make a weaker decision. Keep the existing protections in place until reviewed source/status records, explicit deactivation paths, and every relevant food surface are ready for a coordinated cutover. An unresolved claim must not quietly become an unguarded meal.

**Why:** The same clinical behavior can currently originate from Builder choice, profile arrays, lab decisions, or provider assignment. Disabling only one source or switching only one tool can silently change what food the platform permits, while old data cannot establish whether a medication is still current.

**How to apply:** Use additive, reversible migration stages and compare old/new decisions before enabling authoritative reads. Preserve source-specific history and require an explicit review outcome for ambiguous or ended-owner claims; do not use a Builder as the master medical switch.

During the DEV user-control stage, keep source-backed support choices shadow-only and visibly distinguish them from existing meal-generation settings. Treat an enabled old Anti-Inflammatory preference as something to confirm, not as permission to activate the new claim; never treat an old GLP-1 meal setting as evidence of current medication use.

**Why:** A one-way or bidirectional profile dual-write would let unrelated legacy saves revive a discontinued source or make the new switch appear to change meals before every food surface is migrated together.

**How to apply:** Preserve explicit source ownership and history while the old controls remain in place. Do not assume a control's description proves its food-generation effect; trace and test the actual behavior before defining parity. A future cutover must specify the atomic reconciliation, rollback, and all-surface safety plan before removing the temporary separation.

Keep the existing clinical/specialty architecture as the authority for clinical supports. The new personal support list is limited to GLP-1 current-state intent while it remains non-authoritative for food. Edit Profile has one ordinary Anti-Inflammatory preference control (the existing preference), not a second source-backed toggle; do not claim that preference changes current food until its effect is verified and reconciled with the Builder and clinical inflammation state. Keep Phase 1 provenance/history without treating registry entries as new user-facing products.

**Why:** The later reconciliation found that a 12-choice Phase 1 catalog duplicated MPM's existing Clinical Labs domains and specialty supports. The old Anti-Inflammatory preference's meal effect was not proven, and two same-named controls with different behavior were misleading.

**How to apply:** Do not restore generic Diabetes, Heart, Kidney, Liver, Thyroid, Hormone, Menopause, Perimenopause, Metabolic, or Oncology personal switches. Preserve their existing clinical selections, lab/provider authority, and food paths. A future cutover still requires reviewed source-backed reads and all-food-surface parity. Do not interpret GLP-1 support alone as current medication use.

Onboarding retains its existing clinical/specialty choices for current meals. A separate GLP-1 nutrition-support intent may be offered, but it must not impersonate or replace any clinical choice. The support list is an explicit, narrower allowlist than the protocol registry; clinical diagnoses, medication status, and safety-critical protocols are not created by a preference toggle.

**Why:** Earlier specialty selections already affect live meals, while the GLP-1 support intent is only a shadow preference. Automatically reconciling one into the other would fabricate medical evidence or silently change live food behavior; duplicate support buttons confused users.

**How to apply:** Preserve the old clinical write and keep GLP-1 personal intent independent in onboarding. Turning it off must retain history and leave provider, lab, and medication sources untouched. Reconcile Anti-Inflammatory deliberately instead of adding a second ordinary control.