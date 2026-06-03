---
name: Clinical Labs Phase 5 — Architecture
description: 7 new lab columns, hormone/thyroid subtype resolver pattern, migration approach, and key design decisions for the clinical labs expansion.
---

## New DB Columns (applied via scripts/migrate-clinical-labs-phase5.ts)
Seven columns added to `clinical_labs` table:
- `reverse_t3` — ng/dL, thyroid T4→T3 conversion marker
- `estradiol` — pg/mL, menopause/perimenopause
- `progesterone` — ng/mL, luteal phase marker
- `shbg` — nmol/L, sex hormone binding globulin (informational)
- `lh` — mIU/mL, luteinizing hormone
- `fsh` — mIU/mL, follicle-stimulating hormone (primary menopause marker)
- `dhea_s` — µg/dL, adrenal androgen (hormone-optimization trigger)

## Migration Approach
**drizzle-kit is NOT installed** as a local binary. The `drizzle.config.ts` schema list was incomplete.
- For column additions: write a `.ts` script in `scripts/` and run with `npx tsx scripts/<name>.ts`
- `drizzle.config.ts` was updated to include all 30+ schema files so future pushes work

## Resolver Architecture (additive modifier pattern)
Three resolver types, all in `server/services/resolveProtocolFromLabs.ts`:
1. `resolveProtocolFromLabs()` — primary protocol (single highest-priority signal)
2. `resolveThyroidFromLabs()` — additive: returns `ThyroidLabSignal` with `subtypeConditions: Array<'hypothyroid'|'hyperthyroid'|'hashimotos'>`
3. `resolveHormoneFromLabs()` — additive: returns `HormoneLabSignal` with `conditions: Array<'hormone-optimization'|'menopause'|'perimenopause'>`

**Why additive:** Thyroid/hormone conditions co-exist with the primary protocol. They don't displace the primary; they layer on top. Same as the existing thyroid-support pattern.

## Thresholds (from `shared/clinical/protocolDecision.ts` LAB_THRESHOLDS)
- Hormone optimization: totalT < 300 ng/dL OR freeT < 5 pg/mL OR DHEA-S < 70 µg/dL (AUA/Endocrine Society)
- Menopause: FSH > 40 + E2 < 20 (NAMS/ACOG)
- Perimenopause: FSH 10–40 OR E2 20–50 OR Progesterone < 2 (NAMS/Endocrine Society)
- Hypothyroid subtype: TSH > 4.5 + (fT4 < 0.8 OR fT3 < 2.3 OR rT3 > 25) (ATA/AACE)
- Hyperthyroid subtype: TSH < 0.4 + (fT4 > 1.8 OR fT3 > 4.2) (ATA/AACE)
- Hashimoto's subtype: TPO Ab > 9 OR TgAb > 1 (maps from existing isAutoimmune flag)

## Recommendation Acceptance Flow
Additive conditions (thyroid-support, hashimotos, hypothyroid, hyperthyroid, hormone-optimization, menopause, perimenopause) use `additiveOnlyConditions` check in the `/recommendation` POST handler — they do NOT switch the meal builder; they only add to `specialtyConditions` array.

Primary protocols (liver, kidney, cardiac, metabolic, etc.) switch builder to `anti_inflammatory`.

## HormoneRecommendationModal
Not yet built. Hormone signals are currently recorded as `advisory` status and shown via toast only. A dedicated modal should be added in a future pass to match the thyroid modal pattern.

## labProtocolOwnership.ts
`getLabDrivenConditions()` now evaluates three separate panels (thyroid, hormone, primary) from the most recent lab record that contains values for each respective panel.

## SHBG
Currently informational only — no independent threshold trigger. Included in DB schema and UI but not used in resolver logic.
