---
name: Organization-owned Rewardful identity
description: Ownership, paid-activation, reconciliation, and delegated-access rules for organization Partner & Revenue accounts.
---

Rewardful affiliate identity, referral data, setup state, and Partner & Revenue history belong to the permanent organization UUID.

Organizations cannot activate their Rewardful account or receive their 50/50
referral benefits during the 30-day free trial. Those benefits become available
only after the trial and qualifying paid activation.

**Why:** The user stated this as the established Rewardful rule.

**How to apply:** Preserve this boundary when adding Organization guidance or
Partner & Revenue activation; guidance must never grant those benefits itself.

All businesses use a 50/50 Rewardful link, not 70/30.
The intended default for new eligible organizations is specifically the
Founding Partner Referral Program, not the My Perfect Meals Affiliate Program.

**Why:** The user explicitly corrected the business commission standard to
50% commission; neither the older 30% program nor the older 40% business terms
reflect that instruction. The user also explicitly named the intended
organization campaign.

**How to apply:** Use this standard when reviewing business campaign selection
and displayed terms. Do not treat changing the displayed percentage as changing
the provider's actual commission, and preserve the paid-activation boundary.
The user requires each organization's eligibility and agreed full terms to be
verified before changes; the intended 50/50 standard is not permission to move
every organization automatically. Connection repair and commission reconciliation
require separate controlled approval, with a read-only repair plan first.

**Why:** The user explicitly required this sequence because the shared database
and external Rewardful service can affect real affiliate records and payouts.

Rewardful SSO links expire after one minute, are single-use, and generating a
new link invalidates every previous magic link for that affiliate.

**Why:** Rewardful's SSO documentation specifies these semantics; a passive
status check that generates SSO can invalidate an in-progress portal opening.

**How to apply:** Generate SSO on demand for portal opening rather than as a
side effect of ordinary status refreshes. Never log or persist the magic URL.

Rewardful referral commission terms are sticky: moving an affiliate changes the
terms for newly referred customers, not future invoices for existing referrals.

**Why:** Rewardful's multiple-campaign documentation explicitly illustrates this
behavior; a campaign move does not repair an existing customer's original rate.

**How to apply:** Check current referral and commission inventory immediately
before any approved move, distinguish existing versus new referrals, and require
separate approval for any historical commission correction.

Organization attribution must be inherited through every client acquisition path: active workspace or exact Studio organization binding → invitation → acceptance → client relationship → future paid conversion. Bulk rows share the server-resolved workspace identity. Providers and coordinators never re-enter referral codes per invitation.

**Why:** One person can administer multiple independent organizations, and an outside contractor can leave without taking a clinic's identity. Rewardful's email-based integration cannot deterministically distinguish organizations sharing an operator.

**How to apply:** Use an organization-owned business contact email for new setup. Existing accounts may be discovered by exact Rewardful email only inside an authorized organization workflow, but discovery never authorizes attachment. Require an expiring, single-use confirmation sent to the Rewardful email and revalidate organization authority, affiliate ID/email, lifecycle, and cross-organization uniqueness before attachment. Keep the exact affiliate ID path as a recovery fallback. Resolve invitation attribution server-side from the exact selected organization/location or an exact Studio binding, persist it through acceptance and the resulting relationship, and fail multi-organization ambiguity instead of inferring from operator email, user ID, or legacy organization fields. Keep external delegated administrators distinct from internal staff, and preserve organization data when either relationship is revoked.