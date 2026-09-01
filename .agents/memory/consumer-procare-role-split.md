---
name: Consumer ProCare role split
description: Defines the durable separation between consumer coaching eligibility, clinical relationships, and provider-side Studio access.
---

Consumer ProCare eligibility is role-aware: Pro or Clinical consumers may establish authorized relationships with coaches and trainers, while physicians, dietitians, and nurse practitioners remain Clinical-only. Do not move the broad Care Team entitlement wholesale to Pro.

**Why:** A consumer coaching relationship is distinct from a physician or clinical relationship. Lowering the entire Care Team gate would expose Clinical-only collaboration and data, while leaving the old gate in place incorrectly blocks valid Pro coaching relationships.

**How to apply:** Use one shared consumer eligibility policy for codes, invitations, deep links, auth-resume flows, and mobile handoffs. Keep provider ProCare Studio readiness unchanged, require explicit relationship authorization, and filter coach/trainer views so Clinical-only data is not exposed.