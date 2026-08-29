---
name: Academy contextual navigation
description: Navigation behavior for Academy and ProCare course screens.
---

Academy and ProCare screens should use explicit contextual back destinations: quizzes return to their related video when applicable, final assessments return to the certification overview, completion returns to the relevant dashboard, and lessons return to their course overview.

**Why:** Redirects and session recovery can make browser history unreliable; the user explicitly approved predictable course navigation over generic browser-back behavior.

**How to apply:** Preserve these destination rules when adding or refactoring Academy, certification, video, quiz, and completion screens.