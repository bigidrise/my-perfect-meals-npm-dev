---
name: Interrupted edit integrity
description: Verify the whole affected file set after a disconnected multi-file edit, including writes reported as successful.
---

After an interrupted or disconnected multi-file edit, verify every affected file and new import, not only the hunk reported as failed.

**Why:** A disconnected edit left a new module absent even though other changes and reported successful writes survived. Dependent imports looked complete until a focused test exposed the missing file.

**How to apply:** Check existence and contents for the complete affected set before relying on the edit result or moving on to verification.
