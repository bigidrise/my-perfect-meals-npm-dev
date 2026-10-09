---
name: Organization and practitioner identity
description: Organization authority remains separate from practitioner identity and legacy identity repair.
---

An organization owner who is a physician is still a physician. Organization owner/admin/member authority belongs to existing memberships, not to replacement of a practitioner's professional identity. Ownership itself never grants practitioner or clinical identity.

**Why:** The user established this product rule after an audit found organization creation could erase practitioner identity, then explicitly confirmed preserving that separation without account repairs. The user identifies professionals who run businesses as My Perfect Meals' primary market. Business-only users are also legitimate; provider agreements or ownership alone do not prove a historical role was damaged.

**How to apply:** Preserve established professional identities when granting organization authority, using persisted state rather than a caller snapshot. Initialize only missing Business identity. Keep identity, credentials, training, agreements, entitlements, verification, care relationships, and consent independent. Legacy account conversion needs separately approved authoritative review, not inference or automatic repair.

A business owner with an authorized, active professional Studio must be able to invite and accept clients without changing their stored professional role from business. Existing nonclinical Studio operating authority is not a trainer occupation or a clinical credential.

**Why:** The user required a permanent correction after Studio invitations were classified as client-originated because business owners were not canonical practitioners. Changing the business account into a trainer or physician would repeat the identity-design problem.

**How to apply:** Resolve current ownership, active nonclinical Studio, provider access, training and agreements independently. Bind invitation direction explicitly and revalidate it during acceptance. Legacy ambiguous or backwards invitations require safe reissue, not silent reversal. Business ownership alone never grants Studio or patient-access privileges.

Do not use the legacy managed-account `isProCare` flag as a prerequisite for an independently authorized business Studio operator.

**Why:** An active business-owned Studio can legitimately coexist with that flag being false. Requiring it prevented the identity-separated invitation fix from working; setting it would mutate the account rather than resolve Studio authority.

**How to apply:** Keep actual provider-access, training, agreement and active-Studio checks authoritative. Preserve canonical practitioner setup gates and do not flip the flag as a repair.

A standalone Studio does not inherit Organization or Location scope from its owner's unrelated memberships.

**Why:** Multi-organization business owners were blocked from standalone Studio invitations by an unrelated workspace-selection requirement. Automatic attribution could also attach personal Studio clients to the wrong organization.

**How to apply:** Invitation attribution requires either an actual Studio-to-Organization binding or an explicit Organization/Location selection. With neither, retain standalone scope; with either, retain full workspace authorization checks and never silently fall back.
