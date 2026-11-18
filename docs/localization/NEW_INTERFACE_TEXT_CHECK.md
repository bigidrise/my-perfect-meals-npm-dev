# New interface-text localization check

## Commands and enforcement

```sh
npm run test:i18n:new
npm run validate:i18n:new
npm run validate:i18n:new -- --base <available-ancestor-commit> --json
npm run validate:i18n:phase0
```

The new standalone check is also **GATE_09** in the existing Phase 0 validator and
runs in the localization GitHub workflow, with its regression tests. Full checkout
history is fetched. The existing pre-push Phase 0 invocation therefore includes
it; existing clinical, type and release gates have not been removed or relaxed.
This is validation tooling only, not an app boot or deployment.

Exit status: **0** = no new unresolved findings in the stated scope; **1** = new
interface, connection or review findings; **2** = comparison/configuration/parser
failure. A passing incremental check says nothing about inherited failing gates
or whole-platform Spanish completion.

## Comparison contract and adoption

`new-interface-text.json` pins the full commit immediately before adoption.
By default compare that snapshot against current filesystem contents, including
committed changes since adoption, staged/unstaged changes and untracked,
non-ignored application source. Deletions do not introduce text. Renames are
conservatively treated as a new owner, so moving old English can require review.

An explicit `--base` may select an available ancestor of HEAD at or after the
adoption commit (for example a reviewed PR target). Use the actual intended
review base, not HEAD just to obtain a clean result. No implicit `HEAD~1`,
shallow-history fallback, successful empty rescan or baseline regeneration exists.
Unavailable, invalid, pre-adoption or unrelated bases fail closed. Fetch the
necessary history; do not reset adoption to hide findings. Changing adoption is
a reviewable policy change, not routine maintenance or translation progress.

Matching is a **per-owner multiset of semantic findings**, not a total string
count or line-number baseline. Removing one unrelated English sentence does not
offset adding another. Adding an extra occurrence still fails. Mere line
movement does not. Existing unresolved items remain the responsibility of the
unchanged historical gates and the completed inventory; this task does not
waive or repair them.

## Findings and actual text ownership

- **interface:** new literal JSX text, display props (including placeholder,
  accessible names, modal/menu title/body), conditional/fallback/template copy,
  selected notification producers and direct DOM text assignments. Connect it
  at the owner; shared layout wrappers do not translate caller prose.
- **missing-connection:** recognized translation call lacks nonempty EN/ES
  resources, plural forms or matching interpolation; English `defaultValue`
  alone is not a Spanish connection.
- **review:** potential configuration/copy-array/copy-variable text or dynamic
  translation key/namespace. Establish caller and data ownership. This is not a
  confirmed visible-customer defect, but it does require a decision before pass.
- **protected-review:** new/changed clinical/legal wording detected by existing
  registry text or conservative keywords, including new resource-only wording.
  Use the existing controlled clinical/legal approval process. This check never
  translates it, edits a review manifest or automatically declares it approved.

Literal data/configuration is deliberately not assumed to be interface copy.
For example a recipe object's `title` is review-needed; rendered `meal.title`
is runtime content and not automatically a translation target. Technical
attributes, routes, identifiers, quantities and a narrow set of exact product
names/units are non-targets. Generated meals, clinician notes, user messages,
brand evidence and saved history must not be translated by a broad wrapper.
Server message/configuration producers are review-needed; this is not authority
to translate their safety decisions or machine reason codes.

## Translation and resource connections

The parser recognizes imports/aliases of `useTranslation` and `useConsumerCopy`,
destructured translator aliases, object `.t` calls and imported i18n `.t`.
Bindings retain their lexical namespace rather than guessing from every hook
in the file. Consumer source-phrase keys use the additive consumer namespace
where the current helper actually does so. Explicit `ns` and `ns:key` are
supported. Dynamic keys/namespaces are review-needed.

Count calls resolve EN/ES `_one`/`_other` forms without demanding a nonexistent
base leaf. Spanish-only extra categories such as `_many` are permitted and their
interpolation is checked. Resource-only changes are also compared. The reader
statically parses legacy EN/ES JSON and the existing additive resource objects,
including allowlisted startup/approved spreads. **No application/resource code
is executed.** Changed spread or derived resource-construction shapes fail
closed until the static reader is extended with tests.

This measures EN/ES only and does not pad sibling languages with English.
Existing other-language checks remain independently enforced. Key presence and
placeholder parity do not establish natural translation quality or correct
semantics; human review and bounded rendering still matter.

The existing exact standard-action connection is recognized only for direct
string children of imported shared Button/AlertDialogAction/Cancel/Toast
controls that actually use it. `asChild`, spread props, nested markup,
PillButton, arbitrary titles and accessible props are not granted that bypass.

## Narrow review exceptions

The initial exceptions list is empty. Prefer an explicit translation connection
over an exception. An exception is allowed **only** for a `review` finding, not
confirmed interface text, a missing resource or protected wording. Entries
require:

```json
{
  "owner": "client/src/path/to/owner.ts",
  "kind": "property:title",
  "text": "Exact normalized source text",
  "disposition": "non-target",
  "sourceSha256": "<SHA-256 of the entire exact source file>",
  "reason": "Substantive explanation of why this is authored data, not interface copy.",
  "evidence": "docs/localization/reviewed-decisions.md"
}
```

This is a schema example, not a shipped exemption. No wildcard owners/text,
duplicate entries or missing evidence files are allowed. Hash changes make the
decision stale and fail the check. Evidence must document human-reviewed
ownership. Dynamic translation calls need `bounded-connection` disposition
with the actual bounded keys/namespaces and their EN/ES proof; they cannot use
a technical/data exemption. Applied decisions remain visible in output.
Source hashes and review documentation are engineering safeguards, not a
substitute for code review or clinical approval.

## Limits and verification scope

The guard parses changed non-test `.ts/.tsx/.js/.jsx` application source under
client/src, server and shared. It does not perform a runtime reachability audit.
Ignored files, test fixtures, generated/legacy source, CSS-generated content,
arbitrary helper aliases, complex dataflow/concatenation, HTML/email templates
outside those source roots and runtime/provider output are not fully covered.
New custom wrappers should have explicit tests and reader support rather than
an unreviewed blanket exemption. Inline style/script JSX bodies are excluded as
technical source, not mislabeled interface text.

There are no network/database/provider calls, app imports, account operations,
translations or baseline/report writes. No browser run or server restart is
needed for this offline tooling. The downstream approved food-interface batch
owns English/Spanish desktop/mobile rendering verification.
