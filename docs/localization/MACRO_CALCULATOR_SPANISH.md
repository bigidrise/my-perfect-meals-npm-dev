# Macro Calculator Spanish

## Delivered scope

Development presentation changes for `/macro-counter`, preserving English and the
existing language preference. Spanish is connected at explicit source-owned
render bindings, not through DOM replacement or rewriting stored records.

Coverage includes:

- Entry, guided steps, returning-user forms, goals, structure, body tendencies,
  biological sex, age, measurements and activity choices.
- Daily results, macro rows, starch meal counts and timing, preview and applied
  states, loading/saving controls and application-authored notifications.
- Waist education and risk panels, metabolic/hormonal explanations and adjustment
  confirmations, body composition and its measurement-entry sheet.
- Recalculation and target-replacement confirmations, calculator tours and the
  reachable Guided Journey explanations and next-step controls.
- Scientific sources, medical-information descriptions and the existing
  Hydration evidence registry's source-owned scope/rule descriptions.

Proper names, formal source citations, user-authored records and canonical
values remain authoritative. Translation does not change formulas, risk levels,
clinical rules, meal counts, measurement preferences or final-save requirements.

Calculator narration is paused. Its page-specific hooks cannot synthesize or
preload audio. Shared Copilot chrome and automatic page explanations do not mount
on the calculator; its open/toggle entry points also reject that path. Written
guidance, typed inputs and existing tutorial playback remain available. This
report does not claim completion of a separate application-wide Copilot pause.

## Verification

- Eight new isolated rendering/contract tests passed.
- Seventeen existing saved-setup and calculator-resume checks passed.
- Actual body-composition controls retained entered values across EN/ES switching,
  with the same canonical method, numeric values, source and timestamp payload.
- Source-owned literal bindings have Spanish entries; resource checks preserve
  numerical tokens and interpolation placeholders.
- Expanded metabolic and waist-risk content, preview controls and the scientific
  sources sheet were rendered in isolated UI fixtures.
- Copilot mounting/reopening was checked across navigation; paused narration
  made no network, synthesis or microphone request.
- All 332 numeric AST literals in the calculator match the pre-change source.
- Canonical printed AST hashes match for `buildMacroTargetsFromResults`,
  `saveWaistToBiometrics`, `saveBiometricsToProfile` and `saveEstimatedBodyFat`.
- The final client build and `git diff --check` passed.
- The existing application workflow was restarted in its configured safe mode;
  the development route returned HTTP 200.

## Release boundary and limits

The strict release type gate did **not** pass. It reported 109 diagnostics, the
same count as the reviewed baseline, but with a different fingerprint. One
confirmed pre-existing diagnostic, the unresolved `Method` type in the
body-composition sheet, moved from line 166 to line 168. The full diagnostic set
has not been certified byte-for-byte identical. No baseline, compiler setting
or release check was changed to accept this result.

UI verification used synthetic, isolated fixtures: no real account, acceptance,
nutrition target or shared Neon record was created or changed for testing. An
unauthenticated preview capture showed the initial loading screen, not an
authenticated visual walkthrough of the calculator. No publication occurred.
