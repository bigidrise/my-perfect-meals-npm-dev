---
name: iOS meal reminder release boundary
description: Scope and real-device release evidence for the existing native meal reminder repair.
---

Repair the existing iPhone notification scheduler without rebuilding reminders or changing the website's reminder delivery. Stop and report if repairing it requires a larger isolated change to become a broader project.

**Why:** The user authorized a tightly scoped Development repair and required TestFlight verification before considering Production.

**How to apply:** Keep browser push separate from native scheduling. Synthetic Capacitor tests can establish application behavior, not iOS delivery. Verify a freshly synced native build in TestFlight, including saved-schedule restoration and independent meal edits, before approving release. Never promise that scheduling guarantees display despite iOS settings or Focus.
