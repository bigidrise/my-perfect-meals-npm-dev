---
name: Guided Journey authority
description: Current page-explanation scope; earlier task-completion direction is superseded.
---

## Current direction — supersedes the earlier scope below

Page explanations only: enter a page, show its explanation, dismiss it, use the
existing page, and reopen the explanation through Help/Guide. "Don't show this
again" suppresses that page's automatic explanation.

Each entrance explanation must describe only the current page: onboarding,
then the Macro Calculator, then the user's Meal Builder. Do not preview the
entire journey or explain later tools in the onboarding introduction.
Automatically show the current page's explanation, retaining Guide as a way
to reopen it. At calculator completion, the user requests a Next Step button
leading to their Meal Builder; its introduction covers creating meals,
duplicating meals, and shopping for groceries.

**Why:** The user emphasized limited attention and asked for one thing at a time,
with no preview of the next tool inside the calculator introduction.

**How to apply:** Use this as the intended experience for diagnosis and future
approved changes, not permission to implement it. Preserve saved onboarding,
nutrition calculations, and builder authority; diagnose the existing handoffs
before modifying them.

**Why:** The user corrected the project direction: they want instructions in front
of existing pages, not monitoring of meal creation, plan saving, or task completion.

**How to apply:** Reuse the existing explanation modal and account-scoped preference
patterns. No requirement to finish a meal, no waiting for server board confirmation,
and no automatic redirects to another tool. Do not touch underlying functionality.
Leave Copilot and ElevenLabs alone unless separately approved. The current approval
now includes extending the existing General Nutrition guidance to the other
Meal Builders.

**Why:** The user confirmed, "I liked what I saw" and that they reached the Meal
Builder through the existing flow, then requested the other builders. They have
not yet reviewed the shopping page.

**How to apply:** Preserve the accepted guidance and dark modal presentation.
This approval extends builder guidance, not the underlying nutrition workflows
or shopping functionality; do not treat the user's success report as proof of
every untested builder or server authorization path.

The user explicitly chose both personal and professional client builders for
the guidance expansion.

**Why:** They selected "Personal and professional client builders" after the
personal-only and client-specific scopes were explained.

**How to apply:** Keep professional page explanations tied to the exact selected
client and organization. Never reuse the practitioner's personal setup as client
progress or turn guide dismissal into target, meal, or clinical completion.

First-login guidance should be prominent written guidance with one main action
leading to existing onboarding, plus a smaller Skip and Don't Show Again option.
Copilot remains an optional assistant, not the primary onboarding experience.
The approved Development experiment belongs at the onboarding entrance, not only
on the signup welcome page.

**Why:** The user explicitly limited the next work to "One welcome screen. One
button. One test. Then you decide whether it's right," rather than another seven
changes or guessing why existing guidance is missed.
The user chose the onboarding entrance to cover both signup and unfinished-setup
login paths while retaining the existing legal welcome.

**How to apply:** Examine actual first-login order and competing prompts before
changing presentation. Preserve native legal acknowledgements, navigation and
onboarding. Test the single Development experiment on desktop and phone before
applying the pattern elsewhere. Do not delete Copilot or cancel ElevenLabs.

Nonessential release announcements must not compete with the welcome's primary
action. Defer their display without acknowledging or deleting them.

**Why:** Browser verification showed the release banner covering the welcome
footer; dismissing the banner could also close the introduction.

**How to apply:** Keep that announcement out of the welcome while it is visible,
then let the unchanged announcement return afterward.

## Earlier direction — historical, not authority to continue building it

Guided Journey is an optional task-completion experience, not a mandatory tour:
explain an existing activity, let the person perform it, recognize its saved
result, and offer the next eligible activity.

**Why:** The founder wants a simple first experience while retaining the existing
11-step onboarding, calculator, native workflow buttons, and sophisticated
nutrition/access enforcement underneath.

**How to apply:** Do not replace onboarding, change formulas, switch Builders,
override native redirects, add clinical decisions, or count a generated recipe,
Favorite, cached draft, or dismissed explanation as a saved plan. Failed evidence
reads mean unknown. Guidance preferences are separate from task completion.

Personal, professional, and organization journeys must share an extensible engine
but use their own authoritative evidence and exact subject/workspace identity.
Personal Clinical access never establishes professional authorization. Free users
must not be required to complete paid meal planning or purchase an upgrade.

**Why:** The product brief explicitly requires those separate product worlds and
effective-capability branching without weakening readiness or consent controls.

**How to apply:** Expand through scope-specific adapters. Keep unsupported
subjects or Builders unresolved instead of substituting actor progress or
General Nutrition. Obtain separate approval before adding the visible journey
or enabling automatic presentations; the foundation approval alone does not
authorize those changes.

Keep preferences, the Dashboard card, first modals, and workflow/Builder
connections as separate, testable Development changes. Initial preferences use
account-scoped, versioned local storage without new database tables.

**Why:** The user confirmed the foundation-only approach was the desired result
and explicitly requested one controlled change at a time.

**How to apply:** Do not widen a preferences approval into visible guidance.
Replay changes explanations only, preserves a disabled-automatic choice, and
never resets saved work. Clearly state device-local persistence limitations.
Review the project-wide type baseline before Production, without folding
unrelated diagnostic repairs into these Development changes.

The Dashboard card is the control center, not the walkthrough: show saved
progress and let users continue manually. Manual explanations require separate
approval from automatic launch and workflow connections. Manual setup must preserve a deliberate guidance pause and automatic-off
choice; only explicit Resume resumes guidance.

**Why:** The user explicitly distinguished the card from explanatory modals and
required gaps to be reported rather than filled through an unapproved expansion.

**How to apply:** Unknown evidence/eligibility never authorizes navigation.
Recheck current account and authoritative progress before an existing destination;
retain native onboarding redirects and Builder assignments. Do not introduce
repair workflows or substitute unsupported Builders to make the card advance.

Manual explanations and replay are not a finished Guided Journey or evidence of
Production readiness. Presentation must yield to existing critical interactions;
unknown native/headless arbitration gaps must be reported, not filled through
unapproved changes to those workflows.

**Why:** The user approved explanation presentation only, explicitly distinguishing
it from later onboarding/target completion connections and the supported Builder
connection. They require a gap report rather than broad critical-workflow changes.

**How to apply:** Keep launch manual until separately approved. Replay never resets
operational work, enables disabled automatic guidance, or turns modal events into
completion. Preserve all native actions, redirects and authorization checks.

Onboarding/target completion offers a manual Next Step, not another automatic
popup or redirect. A successful target write must be confirmed independently of
biometric writes; previous valid targets, including zero carbohydrates, still
count without forced recalculation.

**Why:** The user approved activity handoffs only on the condition that there are
no competing redirects or additional popups. Native workflows must retain control.

**How to apply:** Treat save events as wake-ups, never evidence. Confirm current
server-backed results, and discard temporary submitted-value comparisons once
confirmed so later valid server updates are not pinned to stale numbers. Unknown
confirmation does not authorize success. The approved personal General Nutrition
Builder connection remains Development-only and manual; other Builder, household,
professional/organization, automatic-presentation and Production expansions require
separate approval.

Saved-plan handoffs must reopen the confirmed board's planning week, not assume
today's board. A successful legacy/in-memory response is not persisted plan evidence.

**Why:** The user requires an actual saved meal and an exact place to find it,
including existing saved plans, while prohibiting changes to native saving behavior.

**How to apply:** Recheck the current actor, subject, namespace and week against
canonical persisted evidence before offering completion or navigation. Report
unreliable native save paths rather than converting their HTTP success into proof
or repairing them without separate approval.

For the initial setup page introductions, automatic presentation should be
completion-driven: show on each return while the page's work is incomplete;
after successful completion, show only through Guide. Dismissing the introduction
is not completion. This includes onboarding and the Macro Calculator.

**Why:** The user clarified that an account abandoned during onboarding must
receive the explanation again on return, and that later profile or macro changes
are voluntary revisits. Prior seen/opt-out suppression does not match this
requested initial-setup behavior.

**How to apply:** Diagnose against authoritative saved completion, not browser
tour-seen flags. Close the modal for the current visit without immediately
reopening it. This clarification was diagnosis-only, not authorization to change
the application, expand to other pages, or release to Production. Subsequent
implementation approval is limited to Development onboarding and the Macro
Calculator using existing Quick Tours; recurring tools and Production remain
outside that approved scope.

The user explicitly confirmed that successfully saving nutrition targets—not
permanently dismissing an explanation—is the Macro Calculator completion
milestone. They want user-clicked Next/Next Step handoffs from completed
onboarding to the calculator, and from saved targets to the assigned Meal
Builder, with each destination presenting its own readable introduction.
Automatic introductions should have user-controlled on/off settings, with
manual Guide access retained. Hiding Copilot's automatic introductions is only
under consideration, not approved.

**Why:** The user wants explanations customers notice and dismiss before using
the tool, rather than relying on engagement with the existing Copilot.

**How to apply:** Preserve existing saving and authorized destination rules.
Keep initial setup completion distinct from recurring tool guide preferences.
The later focused setup approval does not authorize recurring tool changes or
hiding Copilot. Preserve its settings; avoid competing explanation overlays.

All three Guided Journey stage explanation modals should match the platform's
dark modal backgrounds with white text, not bright white cards.

**Why:** The user requested consistency with existing delete and other modals,
and described the bright white cards as hard on the eyes.

**How to apply:** Keep the shared stage presentation dark, including inset
cards and button states, without changing progression or modal behavior.

The user defines onboarding and initial Macro Calculator targets as the two
mandatory personal setup activities. The final onboarding Next action should
complete saved onboarding and advance only on success. Afterward, personal
information changes belong in Edit Profile, not a repeat onboarding flow;
the Macro Calculator remains available for voluntary target updates.
Recurring Meal Builder introductions may be turned off at any time without
generating or saving a meal. Possible mandatory Business setup is separate,
unspecified scope.

**Why:** The user distinguishes required initial setup from explanations for
optional repeat-use tools.

**How to apply:** Treat this as the requested product behavior, not evidence that
all existing access gates enforce it. Never equate a Next click alone with
successful persistence, and do not add completion gates to recurring tools.

The user reiterated that a blank first onboarding step must receive the
introduction on entry; merely having an account or another workspace must not
make unfinished personal setup appear finished.

**Why:** The user still saw only the first question after child-overlay tests
passed. A clean synthetic client did not exercise the page-level conditions
that can prevent the introduction from mounting.

**How to apply:** Verify the actual page entrance as well as the modal, including
unrelated memberships and remembered browser context. Respect explicit global
automatic-off, but show that state visibly with an accessible way to turn guides
back on. Do not infer the user's exact browser suppression cause from a fixture
pass or a read-only account check.

Verify the underlying calculator question sequence, not merely that its
introduction opens. Browser settings are drafts, not saved-target evidence, and
another account's or a legacy browser-wide late step must not skip first setup.

**Why:** The user received the correct welcome but landed directly in starch
planning with a numeric preview before answering the calculator questions. The
explanatory handoff then reopened the same late calculator step.

**How to apply:** Include stale-browser progress in entrance verification and
walk the questions through results, starch and confirmed saving. Protect existing
targets and replacement confirmations; explanation visibility alone does not
prove calculator readiness. Do not offer an "open calculator" handoff while
already performing that initial calculation.
