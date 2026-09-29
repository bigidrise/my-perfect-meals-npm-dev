---
name: Permanent account and optional workspace lifecycle
description: Product rule for future Studio and Organization attachment, cancellation, and reactivation work
---

The login MPM account is the permanent identity. Personal MPM, Studio, and Organization are separate attached services/workspaces. Hiding or detaching a workspace is not the same as ending its paid entitlement. Ending renewal must preserve verified paid-through access; reactivation before the paid-through date should reverse the scheduled ending of the same subscription without another charge. Expiration makes the workspace dormant, not deleted, and must not delete the personal account or historical data. Sponsored, Pilot, and internal access need source-specific handling rather than a personal-subscription cancellation control.

**Why:** The user explicitly clarified that attach → use → disconnect → reconnect should work under one identity, and that ending renewal midway through a paid period must not terminate already-paid access or create a second charge on reversal.

**How to apply:** For future Studio or Organization lifecycle design, separate billing state, entitlement state, workspace visibility, and relationship continuity. Verify the actual billing source and paid-through period before offering a cancellation or reversal. Never infer personal payment from ownership, membership, or a Studio row.

The user confirmed that disconnecting an existing legacy Studio through the More control worked in Development. Reconnection was not yet tested. Treat this as validation of the non-billing disconnect approach only, not of paid Studio or Organization behavior.

Transitional exception: preserve access for already-established legacy Studios whose owners' Personal professional plans previously paid for Studio. New Studio purchases must use independent Studio billing; an expired independent Studio cannot fall back to Personal billing. Do not offer Studio End/Keep against a Personal subscription. This exception is temporary until a reviewed migration can handle legacy subscribers explicitly.

**Why:** Immediately removing legacy access would strand existing paying professionals, but extending that coupling to new Studios would violate the independent-service model and risk canceling Personal billing from Studio controls.

**How to apply:** In new Studio entry points, distinguish legacy-established access from new standalone billing. Keep legacy renewal read-only, and require verified service-specific subscription identity before mutating Studio renewal.