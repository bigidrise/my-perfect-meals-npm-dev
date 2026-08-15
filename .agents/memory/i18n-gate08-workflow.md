---
name: GATE_08 localization ratchet workflow
description: How the hardcoded-string ratchet is computed and the pitfalls when migrating components to i18n
---

# GATE_08 localization ratchet workflow

- GATE_08 reads static reports, not live code: regenerate `scripts/i18n-audit-report.json` (`npx tsx scripts/i18n-audit.ts`) AND `scripts/i18n-reachability-report.json` (`npx tsx scripts/i18n-reachability-audit.ts`) before running `scripts/i18n-phase0-validate.ts`, or the count won't move.
- The baseline in `docs/localization/hardcoded-baseline.json` is only auto-written on first run; after a successful decrease, update it manually to lock the new ceiling.
- GATE_03 fails on empty locale values. CJK/RTL word order sometimes makes a segmented key ("before/mid/after" around `<strong>`) naturally empty — give it a small real word instead (e.g. zh "按钮", ja "設定で").
- Clinical strings in `docs/localization/clinical-registry.json` must stay hardcoded during migration batches (GATE_07); skip them and note it.
- Parallel-subagent migration pattern that worked: each subagent edits only its component files and writes keys+13 translations to `scripts/i18n-new-keys/<slug>.json`; parent merges all scratch files into the 14 locale files in one script (no concurrent locale-file edits). Then verify every `t("...")` key in edited files exists in en.json — subagents occasionally reference keys they forgot to emit.

**Why:** first batch (task moving 1439→1280) hit all of these.
**How to apply:** any future GATE_08 reduction batch.
