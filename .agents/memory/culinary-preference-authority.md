---
name: Culinary preference authority
description: Defines source-aware enforcement for profile palate guidance and explicit current-request culinary intent.
---

Saved current-profile and legacy-profile culinary values are generation personalization, not hard requirements for one dish. Only values sourced from the explicit current request may independently trigger final-validation rejection or bounded repair.

Normalize non-actionable sentinels according to each field’s vocabulary before prompt construction. For heat and broad flavor, `unsure` and defensive `unknown` are unavailable. Heat `none` remains a known no-spicy-heat value, distinct from null or missing evidence.

**Why:** Profile values such as heat `none` and broad flavor `unsure` were being mislabeled as authoritative requests, causing valid dishes to fail and producing impossible repair instructions.

**How to apply:** Preserve value provenance through HFC, retain actionable profile values in generation prompts, enforce only request-sourced culinary values in final validation, and keep evidence vocabularies aligned with enforceable values. Safety, dietary, clinical, protocol, and explicit cuisine authority remain unchanged.