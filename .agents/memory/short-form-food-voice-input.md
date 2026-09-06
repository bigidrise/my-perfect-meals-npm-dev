---
name: Short-form food voice input
description: Product boundary for microphone input on food-decision surfaces.
---

Short food requests use one shared, fast transcription control: record, transcribe faithfully into the existing controlled field, let the user review or edit, then submit through the feature's normal path. Do not auto-submit and do not add an LLM cleanup rewrite by default.

**Why:** The owner explicitly chose the Buffet-style interaction over Studio's persisted voice-note job architecture. Spoken and typed requests must receive identical nutrition, allergy, clinical, and reason-coded governance.

The shared control uses a clearly visible, restrained green idle border and stronger green hover/focus treatment, then switches to an obvious red Stop state while recording.

**Why:** Manual use showed that the original dark/orange treatment was too easy to miss. The owner explicitly confirmed green-to-red as the intuitive shared affordance.

**How to apply:** Reuse the shared short-form control on active natural-language food fields rather than styling pages individually. Preserve typed input, fail without erasing it, exclude exact-value clinical/auth/payment fields, and keep Studio messaging on its separate privacy/storage architecture.