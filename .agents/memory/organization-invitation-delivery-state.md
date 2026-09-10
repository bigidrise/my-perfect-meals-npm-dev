---
name: Organization invitation delivery state
description: Defines reliable status and resend behavior for organization invitation emails.
---

An organization invitation may be marked pending only after the email provider accepts the message. A provider rejection must be shown as a delivery failure that remains visible and retryable. A duplicate pending attempt must direct the administrator to the existing invitation's resend action.

**Why:** Saving an invitation before sending and ignoring the provider result creates pending records that block retries even though no email may have been sent.

**How to apply:** Validate and normalize recipient addresses server-side. Check provider results on initial sends and resends, never report success on a null/failed result, and do not rotate or invalidate the usable token before a resend succeeds. Treat older pending records created before this rule as delivery-unknown.