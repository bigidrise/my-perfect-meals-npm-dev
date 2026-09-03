---
name: Generated build metadata preview cache
description: Development preview behavior when ignored, generated build metadata is created after the Vite module graph has already failed.
---

When the development preview reports a missing generated build-metadata module even though the file now exists and direct module requests succeed, the visible Vite error can be stale rather than a current application failure. A clean restart of the configured workflow is required before diagnosing the preview as broken.

**Why:** The preview retained an earlier unresolved-import overlay after the generated file was created; the backend and current module response were healthy while the browser still displayed the old error.

**How to apply:** Check the current module response and workflow logs, then restart the existing workflow once to clear the Vite graph and recheck the preview. Do not change application behavior solely to suppress a stale overlay.