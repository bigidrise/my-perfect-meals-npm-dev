# Clinical repair diagnostic fingerprint review

The root strict check still contains 109 pre-existing diagnostics. This repair does not suppress them, remove files from the check, or add a diagnostic allowlist.

The historical source at `41186c8ad4b797a6137064dd7505775f9e22492f` was compiled with the current TypeScript dependencies, the validator's stable development build-version exports, and a 4 GB Node heap. The snapshot includes imported scripts and configuration, not only the root include directories.

That source reproduced the reviewed baseline exactly:

- Count: **109**
- SHA-256: `86ce5ce161a64df58b5ca6a635861672941ab3282d1b385e75bf5342fb9e11e9`

The unmodified release validator then captured the complete current compiler output:

- Count: **109**
- SHA-256: `28071d5435443b552aa67e30f900f4ea098077a89671a7aab5f0433fe8ed89b3`
- Added or removed full diagnostic messages, including multiplicities: **none**

Message equivalence was not treated as sufficient proof. Every current diagnostic's source line was mapped through the actual zero-context Git source diff back to its reviewed location. No diagnostic fell inside edited source. Reconstructing and sorting the complete raw diagnostic set produced the exact previous reviewed SHA-256.

Only two diagnostic locations moved, both in `client/src/components/pro/ProClientFolderModal.tsx`:

| Current line | Reviewed line | Change |
|---|---|---|
| 995 | 992 | Three inserted lines before unchanged diagnosed code |
| 1584 | 1581 | The same three-line displacement |

Columns, messages, file identities, and diagnostic multiplicities were unchanged. The baseline fingerprint was updated only after this exact reconstruction succeeded; the count remains 109. This is a reviewed location-only reconciliation, not acceptance of new TypeScript errors.

`scripts/review-clinical-type-fingerprint.mjs` retains the complete compiler evidence and performs message and source-location comparisons. Its historical snapshot must reproduce the expected baseline before it can authorize any equivalence claim. For this review, the evidence was retained temporarily under `/tmp/clinical-type-review-5IpMZe`.
