---
name: Development startup log retention
description: Vite reload traffic can make early startup messages unavailable during controlled verification.
---

Capture startup evidence immediately after an approved restart. An existing
preview can reload hundreds of Vite modules and make early startup output
unavailable in subsequent workflow-log snapshots.

**Why:** The safe-mode pre-import message was captured, but later log refreshes
and larger scrollback requests contained asset traffic rather than the remaining
initial boot messages. Absence of an error in that truncated output is not a
complete startup audit.

**How to apply:** Preserve the first snapshot, verify the replacement process
and live readiness separately, and state any missing-log limitation. Do not
repeat an approval-gated restart just to recover logs.
