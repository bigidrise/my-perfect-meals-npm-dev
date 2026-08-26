---
name: Studio browser verification access
description: Constraints that can block real-browser verification of Studio recording flows in development.
---

Real-browser Studio recording checks require an eligible professional workspace and working camera/microphone permissions. When either is unavailable, verify the recorder lifecycle and session-activity contract with focused tests rather than changing access controls or weakening security just to make a test runnable.

**Why:** Subscription gates and browser media-permission policies are environmental preconditions, not evidence that the recording or session implementation is broken.

**How to apply:** Keep manual browser verification separate from entitlement troubleshooting. Do not bypass the Studio access gate or alter the clinical idle policy solely for test access.