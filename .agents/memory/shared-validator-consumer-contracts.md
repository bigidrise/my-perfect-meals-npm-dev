---
name: Shared validator consumer contracts
description: Regression-protection rule for shared safety and nutrition validation infrastructure.
---

A shared validator is not considered safe merely because its own unit tests pass. Every protected feature that transforms data into that validator must have a consumer contract test, and those contracts must run in the normal validation gate.

**Why:** A validator can correctly fail closed while a feature-specific adapter accidentally drops valid nutrition or evidence fields. Validator tests remain green even though the user-facing feature rejects valid generated results.

**How to apply:** For changes to Human Food, nutrition normalization, generated-meal schemas, clinical filters, or other shared food validation, run both the shared contracts and each registered consumer suite. Consumer tests must cover field preservation, partial survival, genuine fail-closed rejection, and no fabrication.