---
name: My Perfect Menu builder authority
description: Authority and propagation rules for choosing the Builder used by My Perfect Menu.
---

My Perfect Menu resolves one Builder context with this precedence: an explicit supported Hub context when the actor is authorized, otherwise the authoritative assigned Builder, otherwise the established General default. Browser-local Builder state is never authoritative.

**Why:** Generation, persistence, cache events, and navigation previously selected Builder context independently, so a clinically governed meal could be stored or displayed on a different board.

**How to apply:** Carry the server-resolved Builder through concept stamps, generation mode, board namespace, subject-scoped cache events, and final navigation. Keep Builder entitlement separate from selection, and keep person-fed scope separate from Builder scope.