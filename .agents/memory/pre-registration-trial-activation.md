---
name: Pre-registration trial activation
description: Rules for classifying and activating temporary Pilot Program and Client Access entitlements.
---

Pre-registration access must distinguish Pilot Program from Client Access even when both currently grant the same duration and feature tier. An allowlist record is not an active entitlement and must not contain a trial start or end date.

**Why:** Business evaluations and invited client access have different ownership and reporting meaning. Starting the clock when an email is added would also consume access before the person creates an account.

**How to apply:** Normalize the signup email, claim one pending record safely during account creation, stamp the active user entitlement at that moment, and retain the explicit access category in reporting. Keep provider/client relationships separate from entitlement classification.