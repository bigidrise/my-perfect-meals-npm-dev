---
name: Git archive coverage
description: Recoverability checks before repository cleanup, including remote-only backup references and supplemental bundles.
---

Before deleting backup references or pruning Git objects, verify every intended backup tip and its reachable commits, trees and blobs in an independent archive. Include remote-tracking backup references explicitly; a local-branches bundle does not necessarily cover them.

**Why:** A successfully cloned local-branches bundle omitted readable Production working history that existed only under a remote-tracking backup reference.

**How to apply:** Treat successful cloning and bundle verification as insufficient evidence of complete coverage. Confirm each required tip against the source and check reachable object availability without shallow history or external object alternates. When preserving missing history in a supplemental bundle, verify its prerequisites against the base archive and retain both bundles together; the supplement is not standalone. Keep source history intact until archive coverage is established.
