---
name: Organization invitation delivery state
description: Defines reliable status and resend behavior for organization invitation emails.
---

An organization invitation may be marked pending only after the email provider accepts the message. A provider rejection must be shown as a delivery failure that remains visible and retryable. A duplicate pending attempt must direct the administrator to the existing invitation's resend action.

**Why:** Saving an invitation before sending and ignoring the provider result creates pending records that block retries even though no email may have been sent.

**How to apply:** Validate and normalize recipient addresses server-side. Check provider results on initial sends and resends, never report success on a null/failed result, and do not rotate or invalidate the usable token before a resend succeeds. Treat older pending records created before this rule as delivery-unknown.

Patient invitation emails always open the public Production app and use the fragment-token format consumed by the enrollment page.

**Why:** Recipients must never be sent to a Replit Development domain, and a path token is not read by the enrollment page.

**How to apply:** Patient emails use `https://app.myperfectmeals.ai/business/join#token=...` in every environment. Professional invitation behavior remains separate.

Invitation Status may permanently delete unaccepted invitation records within the administrator's selected organization and location. Accepted invitations are not deletable there.

**Why:** Deleting an accepted invitation would not revoke the resulting membership and would misleadingly suggest that access was removed.

**How to apply:** Require confirmation for deletion, enforce exact workspace scope server-side, and direct administrators to Patients or Team when they need to revoke accepted access.