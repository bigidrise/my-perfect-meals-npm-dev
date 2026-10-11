---
name: Organization invitation clocks
description: Product boundary for organization pilots and temporary patient or professional access.
---

Organization pilot access, patient complimentary access, and professional temporary access are three separate clocks. Patient and professional invitations support only 7, 14, or 30 days beginning at successful acceptance or enrollment.

Pilot participation is an explicit invitation context, never inferred merely because the selected organization has an active pilot. The same organization may issue standard and pilot-backed invitations.

**Why:** Tying individual access to the organization pilot end date silently shortens promised access. Patient trials and professional access also have different authorization implications and must not share an entitlement type.

**How to apply:** Default invitation tools to standard organization context and require an intentional pilot selection for pilot capacity/reporting. Persist server-authorized duration on invitations and reusable links. Closing a pilot blocks new pilot grants but does not shorten issued patient access. Professional organization functions still require an active organization and authorized membership.

For founder-issued Business Pilot activation, the first 30 days are complimentary. Any automatic paid conversion requires an explicitly accepted price, billing terms, and authorized payment method. Otherwise, the business pilot expires without a charge. Keep the physician's personal Clinical trial, organization commercial pilot, and each patient's trial separately tracked.

**Why:** The user specified this billing and access boundary for the founder-issued activation journey.

**How to apply:** Never infer payment consent from pilot activation, organization creation, or an existing payment method. Preserve independent entitlement records even if a newly approved experience coordinates their displayed dates.

The approved founder-issued workflow starts the physician's complimentary personal Clinical window at invitation activation. A newly created organization shares that exact original expiration, even when created later. Each patient retains their independently accepted 7/14/30-day window.

**Why:** The user explicitly approved coordinated physician/organization dates and rejected granting a fresh month on delayed organization creation.

**How to apply:** This coordination is specific to founder activation, not a replacement for universal organization onboarding or patient entitlement clocks. Keep existing paid organizations unchanged. Development implementation approval does not authorize shared-Neon mutations, migrations, application restarts, live Stripe activity, publishing, or Production changes; those require separate approval and the workflow requires end-to-end verification before real physicians.