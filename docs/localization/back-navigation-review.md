# Platform-wide back navigation — Development review

## Scope

The founder explicitly required every page's back controls to follow the
selected interface language, not only the Diabetic Builder example.

- Connected ordinary back/return labels across consumer, professional, business,
  Academy, companion and administrative pages to the existing EN/ES resources.
- Connected shared Builder headers, Academy controls, onboarding footers,
  coming-soon returns and wizard-modal back controls.
- Included named destinations, icon-only accessible names, and desktop/mobile
  variants. Spanish now says **Centro de GLP-1**, not **Hub GLP-1**.
- Unknown labels and user-provided titles remain original. Dynamic Biometrics
  destinations are restricted to their existing system-owned source list.
- Routes, history callbacks, permissions and clinical wording are unchanged.
  No saved customer records were rewritten. No Production publication occurred.

## Verification

- `node scripts/check-back-navigation.mjs` inspected **779** production-client
  TSX sources with zero static navigation findings. Tests/mocks and unimported
  retired legacy sources are excluded; importing a legacy source into the active
  client is itself a finding.
- **155 tests passed across seven focused suites**, including real mounted
  language changes, shared Builder controls, callback preservation, registered
  navigation resources and concept-generation regression checks.
- The client production bundle built successfully.
- The release type gate remains **failing**: it reported 109 diagnostics, but
  their exact location-sensitive fingerprint differed from the reviewed
  baseline. The baseline was not refreshed or weakened. An equal count is not
  proof that the diagnostic sets are equivalent.
- The static scan is not authenticated visual acceptance of every route or a
  declaration that all Spanish localization is complete.

## Adjacent My Perfect Menu correction

The supplied failure's server diagnostics reported repeated `cuisine_mismatch`
rejections and zero provider failures. The label matcher did not recognize
ordinary Spanish cuisine adjectives as their English equivalents. Added bounded
EN/ES equivalence and instructed generation to preserve the supplied cuisine
metadata label without relabeling a genuinely different cuisine.

Contrastive tests retain rejection of different, broader, missing and unknown
cuisines. Allergy, dietary, clinical and final-result checks remain in place.
The missing Diabetic Builder display label was also connected to Spanish.
No live paid meal-generation run or successful recipe persistence is claimed.
