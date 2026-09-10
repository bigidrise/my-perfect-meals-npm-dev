---
name: Organization invitation delivery state
description: Defines reliable status and resend behavior for organization invitation emails.
---

An organization invitation may be marked pending only after the email provider accepts the message. A provider rejection must be shown as a delivery failure that remains visible and retryable. A duplicate pending attempt must direct the administrator to the existing invitation's resend action.

**Why:** Saving an invitation before sending and ignoring the provider result creates pending records that block retries even though no email may have been sent.

**How to apply:** Validate and normalize recipient addresses server-side. Check provider results on initial sends and resends, never report success on a null/failed result, and do not rotate or invalidate the usable token before a resend succeeds. Treat older pending records created before this rule as delivery-unknown.

Invitation links must use the app environment that owns the invitation record and the fragment-token format consumed by the enrollment page.

**Why:** A path token is not read by the enrollment page, while a Development token sent to the Production app may not exist in the Production database.

**How to apply:** Production patient emails use `https://app.myperfectmeals.ai/business/join#token=...`; Development emails use the Development app origin with the same fragment format.