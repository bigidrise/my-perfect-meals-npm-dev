# Voice dependency audit — Development execution

## Result

Completed source-level dependency audit. The only runtime change is the explicitly
requested reversible hiding of Learn's READ/LISTEN group. No ElevenLabs/Copilot
integration, API key, environment flag, provider, microphone path or text feature
was removed or disabled. No live synthesis, transcription or provider billing
query was performed; no monetary savings are asserted.

## Current dependency map

| Surface | Current text/essential behavior | Narration path and trigger | Consequence of paid narration off |
| --- | --- | --- | --- |
| App Library `/learn` → `Learn.tsx` → shared `LibraryItem` | Educational sections, lists, links, expansion and default read mode | Each card's retained Listen calls `handleModeChange` → `useNarration` → `ttsService.speak` → `/api/tts`. Read mode does not synthesize on expansion. | Content remains readable. READ/LISTEN are now hidden for all cards, not deleted; this does not globally disable TTS. |
| Restaurant Guide / Restaurant Assistant `/social-hub/restaurant-guide` → `SocialRestaurantGuide.tsx` | Typed/voice-filled input, preferences, meal generation, results and cuisine/evidence guidance | `advanceGuided("generating")` → `useChefVoice` from `lib` → `VoiceManager.speak`; not-ready result triggers `preload()` and another speak. Other guided steps are explicitly silent. | Keep generation and results. Narration is supplementary; do not remove request handlers, food governance or microphone input. These two product names share this owner, not two independent narration engines. |
| Find Meals Near Me `/social-hub/find` → `SocialFindMeals.tsx` | Location/filter/search and food results; separate voice-input control | Generation-step script → same `lib/useChefVoice` / VoiceManager chain. | Keep restaurant search, location permissions and food evidence intact. |
| Restaurant Finder `/social-hub/restaurant-finder` → `RestaurantFinderPage.tsx` | Distinct place finder | No direct TTS/voice hook in this page's source; shared shell/manual Copilot can still be available. | Do not misidentify this separate page as the Restaurant Assistant narration owner. |
| Macro Calculator → `MacroCalculator.tsx` | Input/state transitions, prescriptions/targets, numeric calculations and saves | Different `components/chefs-kitchen/useChefVoice` → `ttsService`. Entry script after 500ms for a new guided setup unless muted; guided step and contest-prep scripts also call speak. `onListened` unlock runs before the async TTS request. | Preserve calculator logic, transitions, callbacks and written setup guidance. Existing automatic-education policy does not itself guard these direct guided-step TTS calls. |
| Manual Copilot → `CopilotSheet.tsx` | Written responses, navigation/actions, text-only reading/highlighting | Current `handleListenToResponse` explicitly calls `ttsService` only on Listen; no autoplay in that path. Its Read action is text-only. | Keep text, Read, actions and manual help. Avoid indefinite listening/loading indicators or audio-dependent close timers when disabled. |

The Learn change has no language or nutrition effect. Spanish educational content
remains a separate ordinary/protected wording task; hiding controls is not
translation or approval of the text.

## Shared paths and preload

1. `client/src/voice/VoiceManager.ts` has **two** outbound `/api/tts` calls:
   `preload()` sends `{text: " "}`, and `speak()` sends actual text. Blank-looking
   warm-up is still a provider request path and must be gated.
2. `client/src/lib/useChefVoice.ts` retries a `not_ready` speech result after
   preload. It also exports an explicit preload callback.
3. `client/src/voice/VoiceProvider.tsx` exposes `enableVoice()` as preload, and
   `useSpeak()` automatically enables on first use. `CoachCornerWelcome.tsx`
   also has an explicit `voiceManager.preload()` caller.
4. `client/src/lib/tts.ts` is the second shared client owner. It posts directly,
   independent of VoiceManager readiness. Failure returns a silent success and
   completion callbacks, not browser voice.
5. `client/src/components/elevenLabsClient.ts` contains another direct endpoint
   caller, currently behind its own **false** avatar flag. The avatar-specific
   flags are not a global kill switch for the other owners.
6. Both the Development and compiled server entry points call `registerRoutes`.
   The effective authenticated `/api/tts` route in `server/routes.ts` performs
   the sole directly discovered ElevenLabs network synthesis call. A separate
   disabled configuration router file is not proof that this effective route
   is disabled.
7. No runtime reference to `VITE_ELEVENLABS_ENABLED` or `VITE_OPENAI_ENABLED`
   was found in current client/server source. Secret names and type declarations
   alone do not establish a usable narration switch.

This is source-level call-graph evidence, not a claim that every trigger was
exercised in a live account or that a warm-up incurs a particular billing amount.

## Other audio must remain separate

- Browser SpeechRecognition is input, not ElevenLabs output. The restaurant/
  find-meals voice button and VoiceSessionController use distinct input paths.
  VoiceSessionController currently specifies `en-US`; this audit does not change
  recognition language or claim Spanish dictation was verified.
- `/api/voice/transcribe` uses OpenAI audio transcription; disconnecting
  ElevenLabs would not stop that provider path or text-generation costs.
- `useNarration` and legacy audio owners contain browser speech pause/resume/
  cancel handling. The two shared paid TTS implementations explicitly use
  ElevenLabs-or-silence; no system-voice fallback should be inferred from the
  browser control references.
- Studio participant voice/video capture, transcription jobs, journal audio and
  prerecorded educational videos are separate essential/authored media paths.
  Do not remove their controls, data or providers to turn off narration.

## Smallest reversible shutoff to approve later

**Recommended boundary:** one paid-narration setting, enforced at the existing
client request owners **and** the server synthesis boundary. Keep all integration
code and credentials.

- Gate `VoiceManager.preload()` and `speak()` before network/audio work. Return a
  terminal **disabled** outcome, not `not_ready`, so the hook does not warm up and
  retry. Cancel active audio/in-flight synthesis as appropriate.
- Gate `ttsService.speak()` before its request. Settle callback/state contracts
  without simulating successful audio playback or blocking written guidance.
- Retain the avatar guard and connect any future-enabled direct avatar caller to
  the same paid-narration policy; do not accidentally enable the avatar feature.
- Guard `/api/tts` before key access/provider fetch and expose truthful disabled
  availability. Stale/native clients must not be able to synthesize around the
  client gate. Authentication/CSRF protections remain intact.
- Make consumers handle disabled once. In particular, `useNarration.speakSection`
  currently advances recursively after a silent result: merely failing the
  server would still issue one request per section. A disabled result must stop
  the narration sequence instead of iterating through silent network failures.
- Preserve text-only Copilot Read, actions/navigation, written Learn content,
  Macro Calculator computation/step completion and restaurant generation.
  Audit busy-state, `onEnd`/unlock and auto-close contracts for a terminal disabled
  result. Do not substitute immediate audio-complete callbacks that unexpectedly
  close written guidance.
- Keep microphone/transcription, recorded media and provider-evidence handling
  outside this setting. No new voice architecture, general Copilot removal or
  secret deletion is needed.

This is a **proposal only**. None of the broader gate/result-contract/server
changes above has been implemented. Review and explicit approval are prerequisites.

## Verification required for that later patch

Use mocked fetch/provider tests to prove **zero `/api/tts` client requests** for
preload, not-ready retry, explicit narration, guided mount/generation and section
advance when off; prove **zero ElevenLabs calls** from direct server requests by
stale clients. Exercise enabled behavior with mocks to preserve reversibility.
Check callbacks, cancelled audio, text-only Read, navigation, calculator outputs,
restaurant results and microphone controls. One bounded user journey is sufficient
if browser interaction is warranted; no paid synthesis is needed to prove off.

## Changes and evidence in this execution

- Learn's shared control-group div now has `hidden` plus inline `display:none`.
  The inline style intentionally prevents its existing `flex` class from
  overriding the HTML hidden state. It removes these controls from visual,
  keyboard and assistive-technology interaction without hiding educational text.
- Both PillButton nodes, icons, handlers, state and narration implementation
  remain. Educational data, rendering/formatting and expansion code are
  byte-identical apart from this one wrapper/comment edit.
- Three focused tests pass: source ownership of all-card controls; retained
  handlers/default mode/section rendering; server rendering of the **actual**
  extracted expanded LibraryItem with readable content and both hidden controls.
  Stubbed narration never calls a provider.
- The public 390px Learn screenshot confirms the page still renders and fits.
  It shows collapsed cards; it does **not** verify an expanded card interactively.
  Expanded-card visibility is established by the actual-component render and
  explicit HTML/CSS contract, not claimed as browser clicking evidence.
- Existing incremental localization check passes. No live account, camera,
  recording, provider, secret or Production operation was performed.

Reactivation of Learn's controls is a small wrapper-visibility change, not a
reconstruction of deleted components or content.
