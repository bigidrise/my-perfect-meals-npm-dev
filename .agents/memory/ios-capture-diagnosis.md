---
name: iOS capture diagnosis
description: Keep Grocery Voice Add and Studio microphone/video failures as separate iOS workstreams.
---

Treat iOS Grocery Voice Add and Studio voice/video as separate jobs. Voice Add depends on Web Speech Recognition; Studio capture uses getUserMedia and MediaRecorder. Diagnose Studio on a physical device only after syncing the current web assets into the Capacitor shell.

**Why:** the features diverge before upload and fail for different capability reasons. Combining them encourages an incorrect shared fix and makes stale bundled assets look like current-device evidence.

**How to apply:** prioritize Studio communication capture. For the next diagnostic build, run a fresh `npx cap sync ios`, then capture Xcode/device logs for one mic tap and one video tap, recording whether the first failure is permission, WebKit capture, MediaRecorder, MIME negotiation, or frontend state.