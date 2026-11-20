# Targeted clinical source-integrity review

This review covers the 14 previously identified source-integrity mismatches
only. It is not medical certification, clinical translation approval, or
permission to remove registry entries. No medical advice, Spanish clinical
translation, safety enforcement, physician precedence, or feature gate was
changed by this recovery.

## Two source-encoding corrections

The two `MedicalSourcesInfo.tsx` entries at stored lines 190 and 836 protected
`GI Symptom Management — Reflux &amp; Diarrhea`. The former JSX entity rendered
an ampersand; the current source-key translation call uses the literal string
`GI Symptom Management — Reflux & Diarrhea`, which renders the same English.

Only these two entries' source text was normalized from the JSX entity to the
literal ampersand, in both the grouped and flat registry representations.
No source copy or translation was edited. Keys, categories, entry counts,
source files and other registry metadata remain unchanged. This is a
source-serialization repair, not approval of a clinical wording change.
The medical title and the rest of `MedicalSourcesInfo.tsx` remain unchanged.

## Historical review of the remaining twelve mismatches

Stored line numbers below identify the existing registry entries, not current
source positions. This table records the initial review. The bounded approval
and current disposition are recorded below; all registry identities are retained.

| Source and stored line | Protected text | Finding and disposition |
| --- | --- | --- |
| `AcademyLandingPage.tsx:551` | Clinical Deep Dives | The entire Coming Soon Specialize section was removed in the existing Academy cleanup. No active replacement for this heading. Keep registry entry pending controlled retirement approval. |
| `AcademyLandingPage.tsx:565` | Diabetes Nutrition | Topic chip removed with that section. Do not reintroduce the retired product section merely to satisfy the scanner; keep entry pending retirement approval. |
| `AcademyLandingPage.tsx:566` | GLP-1 Support | Topic chip removed with that section. Keep entry pending retirement approval; do not change active GLP-1 behavior. |
| `Learn.tsx:1363` | Real-time diabetic meal adjustment | Existing GlucoseGuard documentation now says “Glucose-aware meal context across the platform.” This is a substantive product/clinical claim change, not a translation or encoding fix. Hold for clinical/source-owner reconciliation. |
| `Learn.tsx:1369` | GlucoseGuard is for diabetics only. It reads your actual blood glucose level (mg/dL) from the Diabetic Hub and adjusts meal generation based on your current glucose state. | Existing replacement describes glucose awareness across meal builders and creation tools. Do not restore an older claim or approve a newer claim automatically. Hold exact wording for qualified review. |
| `Learn.tsx:1382` | Starch Guard is about weight management and limiting high-glycemic carbs. GlucoseGuard is about real-time glucose monitoring for diabetics. Most users don | The registry originally captured a truncated apostrophe-delimited fragment. The current full paragraph also substantively changes the distinction to logged glucose context across the platform. Truncation does not justify approving the replacement. Hold. |
| `academy/AcademyHome.tsx:39` | Diabetes Nutrition | Existing Academy cleanup removed the unused SPECIALIZE array. Keep entry pending controlled retirement approval. |
| `academy/AcademyHome.tsx:40` | GLP-1 Support | Removed from the same unused array. Keep entry pending controlled retirement approval. |
| `physician/DiabeticMenuBuilder.tsx:1216` | Diabetes Hub | Navigation now resolves `diabeticBuilder.backLabel`; the exact English value “Diabetes Hub” remains in `locales/en.json`, with Spanish in the corresponding catalog. This is moved source ownership, not changed medical advice. Keep entry until the controlled registry process can verify dictionary ownership rather than insert a dead literal/comment. |
| `profile/EditProfilePage.tsx:1165` | Protocol Controlled by Your Physician | Existing replacement says “Clinical Protocol Review Required” and covers physician-directed or earlier assignments. Exact old text also remains in the English dictionary but is not the current banner. Hold the changed claim for source-owner/clinical review; do not alter lock enforcement. |
| `profile/EditProfilePage.tsx:1339` | Metabolic Medication Support — Nutritional Guidance Only | Existing health-protocol cutover replaced this with “Existing GLP-1 meal-generation guidance.” Hold the changed product/clinical explanation; preserve current activation and physician restrictions. |
| `profile/EditProfilePage.tsx:1341` | not a substitute for your prescribing doctor's guidance | Removed with the older GLP-1 explanation, whose numeric/clinical claims were replaced by a legacy-setting explanation and instruction to follow the clinician. Do not silently restore the old paragraph or certify the replacement. Hold for qualified review. |

## Evidence and limits

Git history identifies the Academy removal in `e7d713478`, GlucoseGuard
documentation replacement in `7a0aaab96`, physician-banner replacement in
`ba8da4e60`, and GLP-1 explanation replacement in `09b4732a4`. These references
establish provenance, not clinical approval.

No registry regeneration was promoted into the candidate. A separate generator
execution in an ignored output directory confirms that the workflow's generator
still builds; its newly generated registry is not the reviewed authority and
must not replace the protected candidate registry.

## Founder-approved bounded source reconciliation

The founder subsequently approved final bounded release-gate corrections,
including controlled retirement of obsolete references and exact source
ownership, while explicitly withholding approval of the six substantive
clinical explanations.

`release-source-dispositions.json` records exactly five already-removed Academy
references as retired and the unchanged Diabetes Hub navigation label as
dictionary-owned. It does not delete registry entries, regenerate the registry,
translate clinical prose, or approve clinical claims. Each disposition is tied
to its exact registry identity, source text and full current source-file SHA-256.
Any source change requires renewed review. A reintroduced retired literal fails;
dictionary ownership requires the exact English value, a Spanish value and a
recognized, bound translation call. Ordinary active component coverage is unchanged.

### Six explanations still held, unchanged

| Current location | Current wording | Why qualified review is still required |
| --- | --- | --- |
| `client/src/pages/Learn.tsx:1431` | Glucose-aware meal context across the platform | The feature-scope claim replaced a narrower diabetic adjustment claim; provenance is not clinical approval. |
| `client/src/pages/Learn.tsx:1437` | GlucoseGuard is a glucose-awareness feature available across the platform's meal builders and creation tools. When you log a blood glucose reading, the app can show your latest reading and pass that glucose context into meal generation. | Requires confirmation of actual supported surfaces and a clear distinction between logged context, monitoring and treatment. |
| `client/src/pages/Learn.tsx:1450` | Starch Guard is about weight management and limiting high-glycemic carbs. GlucoseGuard is about displaying and using logged glucose context across the platform. The two features can work together when a user's profile supports them. | Substantive replacement of the protected Starch Guard/GlucoseGuard distinction, despite the old registry's truncated apostrophe fragment. |
| `client/src/pages/profile/EditProfilePage.tsx:1364–1366` | Clinical Protocol Review Required — Your clinical settings include physician-directed or earlier clinical assignments. Contact your care team for review before changing them. | The banner now covers physician-directed and earlier assignments. A reviewer must confirm the explanation accurately describes authority/lock behavior. |
| `client/src/pages/profile/EditProfilePage.tsx:1571` | Existing GLP-1 meal-generation guidance | Changed explanation of a legacy medication-related setting; its meaning needs qualified/source-owner reconciliation. |
| `client/src/pages/profile/EditProfilePage.tsx:1572–1573` | This older profile setting currently affects meal generation, including alongside a Diabetic Builder. It does not prove current medication use. Your separate nutrition support choice below does not yet change today's meals. Follow your clinician's guidance where applicable. | Replaced an older prescribing-clinician disclaimer and related guidance; review must confirm medication identity, builder interaction, support-choice semantics and disclaimer adequacy. |

No disposition is granted to these six entries. They continue to fail clinical
source-integrity validation. The aggregate guard's other protected/dynamic
findings also remain subject to their existing review requirements.
