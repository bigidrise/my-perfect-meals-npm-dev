---
name: Physician pilot invitation experience
description: Intended founder-issued physician invitation journey, distinct from organization-only authorization.
---

The physician receives one personalized 30-day invitation link by email. It opens the normal welcome, sign-up, or sign-in experience while preserving complimentary pilot authorization without requiring a paid subscription.

One type of link must serve both existing accounts and new accounts. Existing members keep their existing identity; new members register directly through the same invitation. Neither journey requires separate registration instructions, returning to the email, or a second invitation link. Preserve the token through authentication redirects and email verification if required, then return automatically to explicit activation.

Do not remove, replace, or break existing-account activation. Keep email binding, authentication, MFA, token expiration, single-use redemption, and billing protections intact. Opening the invitation or completing registration must not start the pilot clock; only successful activation does.

After activation, the physician can choose personal onboarding, the Macro Calculator, My Perfect Meals exploration, and Academy learning, or go directly through More → Start Your Organization to create a business. Personal onboarding must not be a prerequisite for that organization path.

The organization shares the original physician pilot expiration. Spouse and client invitations use the existing 7-, 14-, or 30-day options; recipients have their own accounts and independent trial periods.

Authentication, MFA policy, and professional-readiness protections remain authoritative. Complimentary access does not establish practitioner credentials.

**Why:** The user explicitly clarified this intended experience; it is not an organization-only pilot that first starts its clock at organization setup.

**How to apply:** Evaluate founder physician invitations against this journey, preserving the existing screens and invitation infrastructure rather than rebuilding the founder dashboard or introducing unnecessary screens.

## Anonymous startup verification

Page tests with a mocked authentication context do not prove that a public invitation survives real authentication startup.

**Why:** Mocked entry tests passed while a browser capture still redirected an anonymous visitor away after the initial profile request returned 401. Authentication initialization had a separate public-route boundary.

**How to apply:** Include real authentication-provider initialization tests for both fresh anonymous visits and rejected cached sessions, alongside page and auth-return tests. Keep Production route policy separate from Development-only entrance changes.
