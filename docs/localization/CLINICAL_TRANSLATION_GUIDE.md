# Clinical Translation Guide — Controlled Review Workflow

This guide explains how the 138 protected clinical strings (see
`docs/localization/clinical-registry.json`) are translated safely. These strings
cover diabetes/GLP-1, medication, allergy/safety, lab/biometric, pregnancy, and
pediatric guidance. **A mistranslation here is a patient-safety issue**, so they
are excluded from automated migration and must pass a human clinical review
before shipping in any locale.

## The three roles

| Role | Responsibility |
|---|---|
| **Translator** | Produces candidate translations (may start from AI candidates) |
| **Clinical reviewer** | A qualified medical translator / clinician who approves or rejects each candidate |
| **Engineer** | Applies only approved translations to locale files and opens the `[clinical-translation]` PR |

## The workflow (one locale at a time)

### 1. Generate the review manifest

```bash
npx tsx scripts/i18n-clinical-translate.ts --locale es
```

This creates/updates `docs/localization/clinical-review/es.review.json` with one
entry per protected string. Re-running is safe: existing reviewer decisions are
preserved, and a decision is reset to `pending` only if the English source text
changed since it was reviewed.

Optionally generate AI candidate translations for pending, empty entries
(requires `OPENAI_API_KEY`):

```bash
npx tsx scripts/i18n-clinical-translate.ts --locale es --propose
```

AI output is **only a starting point** — it never ships without clinical approval.

### 2. Translator fills / refines candidates

The translator edits `proposedTranslation` for each entry. Rules:

- Never soften or omit warnings (e.g. "⚠️ Allergy Alert" must remain an alert).
- Preserve clinical terms (GLP-1, HbA1c, BMI) unless the locale has an
  established medical equivalent.
- Preserve `{{placeholders}}` and emoji exactly.
- If unsure, leave a question in `notes` for the reviewer.

### 3. Clinical reviewer decides

For each entry the reviewer sets:

```jsonc
{
  "key": "createwithchefmodal.allergy_alert",
  "sourceText": "⚠️ Allergy Alert",
  "proposedTranslation": "⚠️ Alerta de alergia",
  "status": "approved",              // or "rejected"
  "reviewer": "Dr. A. García, MD (medical translator)",
  "reviewedAt": "2026-08-14T00:00:00Z",
  "notes": null                       // rejection reason if rejected
}
```

- `status: "approved"` requires `reviewer` and `reviewedAt` to be filled.
- `status: "rejected"` sends the entry back to the translator; fix
  `proposedTranslation` and reset `status` to `pending` for re-review.

### 4. Engineer ships approved translations

Only entries with `status: "approved"` may be copied into
`client/src/i18n/locales/<locale>.json`, and the locale value must match
`proposedTranslation` **exactly**. Include the `[clinical-translation]`
annotation in the PR title/description — this is a governance/process
requirement verified by human code reviewers; the automated enforcement of the
manifest contents itself is GATE_07 (below).

### 5. GATE_07 enforcement

`npx tsx scripts/i18n-phase0-validate.ts --ci` fails the build if:

- a protected clinical string was changed or removed from its **source file**
  without regenerating the registry through the controlled process
  (source-integrity check — this protects strings that are still hardcoded and
  not yet migrated to i18n keys);
- the registry contains a duplicate key mapped to different source texts;

and, in any locale:

- a clinical key is translated (differs from the English source) but has **no
  manifest entry**, or the entry is not `approved`;
- an approved entry is missing `reviewer` / `reviewedAt`;
- the approval is **stale** (English source text in the registry changed since
  the review);
- the locale value does **not exactly match** the approved `proposedTranslation`;
- `en.json` contains a clinical key whose value differs from the registry source.

A clinical key whose locale value is identical to the English source
(untranslated passthrough) is allowed — it simply hasn't been translated yet.

## Changing an already-approved translation

Edit the manifest entry (new `proposedTranslation`, `status: "pending"`), get it
re-approved, then update the locale file. GATE_07 blocks any locale change that
drifts from the approved manifest value.

## Changing the English source string

Changing a protected string in code changes the registry on regeneration
(`npx tsx scripts/i18n-clinical-registry.ts`). The next manifest regeneration
resets all locale decisions for that key to `pending` — every locale must be
re-reviewed. This is intentional.

## File map

| File | Purpose |
|---|---|
| `docs/localization/clinical-registry.json` | Source of truth: 138 protected strings |
| `scripts/i18n-clinical-translate.ts` | Generates/updates per-locale review manifests |
| `docs/localization/clinical-review/<locale>.review.json` | Review manifest per locale |
| `scripts/i18n-phase0-validate.ts` (GATE_07) | CI enforcement |
| `client/src/i18n/locales/*.json` | Where approved translations land |
