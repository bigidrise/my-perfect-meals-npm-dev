# Remaining localization review: bounded batches

**Status: review preparation only. No finding is approved or suppressed.**

## Authoritative evidence

`release-review-findings.csv` is a byte-identical preservation of the existing
568-finding queue, not a regenerated inventory.

SHA-256:
`7431049705d29e263fbd57724c633c9db4ad04760a75bb449b6243d6d1b18c5e`

`release-review-classification.csv` joins to that queue using `finding_id`,
the 1-based data-row ordinal. It preserves each source location, a digest of the
complete original row, the evidence category, source hashes and the bounded
ownership evidence. Consult the original row for its exact text and validator
reason. The classification index is review evidence, not gate configuration.

| Evidence category | Findings | Meaning |
| --- | ---: | --- |
| A: verified unchanged protected wording | 30 | Eight exact Production EN/ES reuses and 22 unchanged canonical citation/name findings; not new clinical approval. |
| B: matching approved localized-content record established | 0 | No matching written approval established in the inspected manifests; no assertion that external approval could never exist. |
| C: ordinary dynamic ownership demonstrated | 19 | Closed/guarded producers and exact EN/ES bindings demonstrated; no clinical-content approval inferred. |
| D: unresolved content or ownership | 517 | 383 protected-content findings and 134 dynamic-origin findings remain open. |
| E: supported scanner binding false positives | 2 | The parameter translator is explicitly forwarded from the existing copy hook. |
| Total | 568 | Every original row retained. |

The 134 unresolved dynamic-origin rows comprise 130 without complete ownership
evidence and four with demonstrated binding but clinical-content holds:
436, 440, 443 and 490. In particular, row 490 includes the claimed app-wide
30g starch cap and preservation of medical/allergy protections. A finite list
does not approve those claims.

The protected queue covers 233 distinct exact EN/ES pairs. Duplicate resource and
connection findings do not require independent translations, but every source
binding still needs evidence. The six clinical explanations are additional
source-integrity holds, not six more rows in this 568-row register.

## Proposed review order — no implementation authorized

### Batch 1: two narrowly supported scanner corrections

Rows **350 and 351**:
`client/src/components/ProtocolVisibilityPanel.tsx:22–23`.

The parameter is typed as the `useConsumerCopy` translator at line 17.
The component obtains it at line 33 and forwards it at line 38. Both literal
interpolation keys have EN/ES values. Review only this helper/caller contract;
do not recognize arbitrary parameters named `t` as translators.

### Batch 2: 19 ordinary ownership records, in three small groups

- Shared display/measurement/chart owners: **211, 363, 420, 430, 431**.
- Grocery, grammatical fragments and calculator display producers:
  **433, 434, 438, 442, 453, 475**.
- Training and Biometrics interface choices:
  **525, 526, 530, 539, 540, 541, 546, 548**.

The classification index supplies each exact call location, finite keys or
guarded-domain proof, and current source hashes. Preserve unknown-record
passthrough, canonical method names and all separate clinical wording reviews.
Do not use these 19 records to approve their containing files.

### Batch 3: 30 unchanged protected-source findings

Review eight existing-locale reuses separately from the 22 canonical
citation/name findings. Verify exact Production source/value lineage and
current owner/resource hashes. Unchanged canonical English passthrough is not a
Spanish medical translation. Existing shipped wording is not evidence of a
qualified clinician's approval.

Use source-specific reviewed reuse/passthrough dispositions only after the
appropriate owner review. Do not move protected keys into ordinary namespaces.

### Batch 4: 383 protected-content findings

Deduplicate identical EN/ES pairs for review workload, while retaining every
resource and connection row. Group by topic/owner in groups of at most 8–12
distinct pairs, not one automatic approval.

Separate actual clinical explanations, numeric/product safety claims and
clinically meaningful translations from navigation/tier labels. Qualified
clinical review is required for substantive clinical content; a pure-label
determination must be explicit and source-specific. Bibliographic references
alone are not approval of the product's explanatory text.

### Batch 5: 134 still-open dynamic-origin findings

Review the four clinical-content holds separately. Review the remaining 130 by
producer/callback family, with no more than 8–12 calls per decision.

For every call, establish its finite producer or explicit guarded domain, all
live translator callers, exact resources, unknown-value behavior and subject
ownership. For example, some shared Guided Journey callers omit the optional
translation callback and default to identity. A translated calculator caller
does not establish coverage for those callers. Do not blanket-translate saved,
user-authored or external clinical notes.

## Gate implementation boundary

Existing `new-interface-text.json` exceptions are exact-source records for
`review` findings, not a route around `protected-review`. Before using bounded
connection records, verify producer/caller and resource dependencies as well as
the consumer source hash.

The source disposition validator currently supports retired references and
unchanged dictionary-owned labels, not substantive reviewed replacements.
After genuine qualified approval, a separately authorized, tested extension
could bind the six replacement decisions and protected resource approvals to
their exact source/text/translation hashes. Preserve the registry identities,
adoption baseline, thresholds and all existing clinical checks.

**Current release result remains unchanged:** seven recorded Phase 0 failures
and one warning. Neither this index nor a preservation commit clears that gate.

## GitHub access and founder-only recovery steps

Authenticated GitHub API access currently reports `permissions.push: true`
for `bigidrise/my-perfect-meals-npm-dev`. No interactive login is needed on
that evidence; actual Git transport success must still be verified.

If Git reports an authentication/authorization failure:

1. Open Replit's **Git pane** and its GitHub connection/authorization control.
2. Complete the browser-based GitHub sign-in using the account with repository
   write access; authorize access to `bigidrise/my-perfect-meals-npm-dev`.
3. If GitHub restricts repository or organization access, have the repository
   owner grant that existing account access before retrying.
4. Return to the workspace. Verify repository permissions without printing
   credentials: `gh api repos/bigidrise/my-perfect-meals-npm-dev --jq '.permissions.push'`.
5. Recheck the remote branch tips, then use only the authorized reconciliation
   push. Do not create a PAT, paste a token into chat, alter original branches,
   bypass validation or force-push.

Official guidance:
https://docs.replit.com/build/code/connect-your-repository
and https://docs.replit.com/build/code/manage-repository-access .
