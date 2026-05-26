# System 07: Chef Copilot Multi-Modal AI Assistant (CCMAA)

**Classification:** User Interface Intelligence — Conversational AI Layer
**Status:** Active, Production

---

## Purpose

The Chef Copilot is MPM's proprietary AI assistant — a page-aware, context-sensitive intelligence layer that provides real-time guidance, explanation, and action across every screen of the application.

Unlike generic AI chatbots bolted onto apps, the Copilot is **natively integrated** into the platform's page structure, clinical protocols, and generation engines. It knows where the user is, what features surround them, what their medical constraints are, and what actions are available — and it uses all of this to respond appropriately.

---

## Architecture Layers

### 1. Context System (`CopilotContext.tsx`)
Maintains the Copilot's understanding of:
- Current page (`screenId`)
- Active user persona (diabetic, GLP-1, athlete, family, kids)
- Available actions and suggestions for the current screen
- Last response state

### 2. Command Registry (`CopilotCommandRegistry.ts`)
A structured registry of callable actions organized by page and context. Actions include navigation, modal opens, generation triggers, and walkthrough launches. The registry is what allows the Copilot to *do things*, not just *say things*.

### 3. Page Explanation System (`CopilotPageExplanations.ts`)
A content registry that maps every major screen to:
- A structured explanation (title, description, howTo steps, tips)
- A `spokenText` field — the narrated version for TTS playback
- An `autoClose` flag for guided mode auto-advancing

### 4. Guided Mode / Auto-Play
When guided mode is enabled, the Copilot automatically explains each page as the user navigates to it. This is the "tour guide" mode designed for new user onboarding.

### 5. Text-to-Speech Integration (ElevenLabs)
The Copilot speaks. All page explanations and responses are available as high-quality synthesized speech via ElevenLabs TTS. Playback is managed by `VoiceManager.ts` through an audio queue system.

### 6. Synchronized Word-Highlight (Accessibility)
When audio plays, each word in the spoken text is highlighted in sync with playback — a closed-caption style accessibility feature. The word-advance timer uses audio duration from `loadedmetadata` to pace precisely to the clip length.

**Key file**: `client/src/components/copilot/useWordHighlight.ts`

### 7. Text-Only Mode
Users can disable audio entirely while retaining the word-highlight animation (running at 150 WPM fixed pace). Persisted to `mpm.copilot.textOnly` in localStorage. Designed for hearing-impaired users, quiet environments, and office settings.

### 8. Respect Guard (`CopilotRespectGuard.ts`)
A critical safety layer that prevents the Copilot from:
- Suggesting actions that would violate the user's active medical protocol
- Recommending foods blocked by the UP-FEM enforcement model
- Offering to override physician-assigned constraints

The Copilot is helpful but never unsafe.

---

## How Guided Mode Works

```
User navigates to new page
    │
    ▼
CopilotGuidedModeContext evaluates:
    ├── Is guided mode enabled?
    ├── Has user seen this page's explanation before?
    └── Is this page in the explanation registry?
         │
         ▼ (if all yes)
    CopilotSheet opens automatically
    ├── Page explanation loaded from registry
    ├── ElevenLabs TTS requested
    ├── Audio plays with word-highlight sync
    └── autoClose timer begins (if autoClose: true)
```

---

## Accessibility Features

| Feature | Description |
|---|---|
| Text-Only Mode | No audio — word highlight advances at fixed 150 WPM |
| Word Synchronization | Words highlight in sync with audio duration |
| Auto-Scroll | Current highlighted word scrolls into view |
| aria-live | Word highlight container uses `aria-live="polite"` |
| Skip / Pause / Resume | Full audio transport controls |
| Auto-close override | Guided mode explanations can be dismissed at any time |

---

## Inputs

| Input | Source |
|---|---|
| Current page screenId | Router / page registration |
| User persona | CopilotContext |
| User medical constraints | UP-FEM / Respect Guard |
| Command registry | CopilotCommandRegistry |
| Page explanation content | CopilotPageExplanations.ts |
| Audio preferences | localStorage |

## Outputs

| Output | Used By |
|---|---|
| Page explanations (text + audio) | User |
| Actionable suggestions | User — one-tap actions |
| Navigation triggers | Router |
| Modal open triggers | App shell |
| Generation triggers | Meal generation pipeline |

---

## Key Files

| File | Role |
|---|---|
| `client/src/components/copilot/CopilotSheet.tsx` | Main UI bottom sheet |
| `client/src/components/copilot/CopilotContext.tsx` | Global state and actions |
| `client/src/components/copilot/CopilotCommandRegistry.ts` | Action registry |
| `client/src/components/copilot/CopilotPageExplanations.ts` | Content registry |
| `client/src/components/copilot/CopilotRespectGuard.ts` | Safety constraint layer |
| `client/src/components/copilot/CopilotGuidedModeContext.tsx` | Auto-play mode |
| `client/src/components/copilot/useWordHighlight.ts` | Word-sync accessibility |
| `client/src/lib/tts.ts` | TTS service abstraction |
| `client/src/voice/VoiceManager.ts` | ElevenLabs audio queue |

---

## What Makes This Unique

1. **Page-native context awareness** — the Copilot knows what screen the user is on and what actions are available there, unlike generic chatbot overlays
2. **Medical constraint awareness** — the Respect Guard ensures the AI assistant never contradicts the medical rules governing that user's content
3. **Synchronized accessibility** — word-highlight in sync with TTS audio is an uncommon accessibility pattern in consumer health apps
4. **Guided tour mode** — auto-advancing page explanations with TTS creates an onboarding experience comparable to a one-on-one walkthrough
5. **Text-Only Mode** — explicit first-class support for hearing-impaired users, not an afterthought
