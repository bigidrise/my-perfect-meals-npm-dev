---
name: Studio video MIME compatibility
description: Studio video recording accepts browser-selected containers without changing recorded bytes.
---

Keep Studio video MIME handling capability-based across browser and Capacitor environments. Browser codec parameters must be normalized at the HTTP boundary, while the actual recorded bytes remain untranscoded.

**Why:** Chrome commonly supplies WebM MIME values with codec parameters, while Safari/iOS may select MP4 or QuickTime. Exact MIME string checks reject valid recordings before the shared-message route can process them.

**How to apply:** Let `MediaRecorder.isTypeSupported()` choose a supported container when available; otherwise let the browser choose. Normalize MIME parameters server-side for validation, storage metadata, and matching filename extensions.