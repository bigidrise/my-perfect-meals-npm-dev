---
name: Academy contextual navigation
description: Navigation behavior for Academy and ProCare course screens.
---

Academy and ProCare screens should use explicit contextual back destinations: quizzes return to their related video when applicable, final assessments return to the certification overview, completion returns to the relevant dashboard, and lessons return to their course overview.

**Why:** Redirects and session recovery can make browser history unreliable; the user explicitly approved predictable course navigation over generic browser-back behavior.

**How to apply:** Preserve these destination rules when adding or refactoring Academy, certification, video, quiz, and completion screens.

On desktop, the application shell suppresses ordinary fixed mobile headers. Academy and certification navigation must use a desktop-visible sticky course header rather than relying on an unmarked `fixed top-0` header.

**Why:** A back button can exist correctly in the page component yet remain completely hidden by the desktop shell's mobile-header suppression rule.

**How to apply:** Verify course navigation in the desktop shell as well as mobile; use the dedicated Academy navigation-header treatment for any new course page.

The same My Perfect Meals Academy must remain accessible from both the ordinary More page and Business Suite. Adding the ordinary-user entry must not remove or relocate the Business Suite entry.

**Why:** Ordinary users need a visible learning entry without implying that Academy is business-only, while business users still need Academy in their existing workspace.

**How to apply:** Treat More and Business Suite as multiple entry points to the same `/academy` experience; never create a duplicate Academy.