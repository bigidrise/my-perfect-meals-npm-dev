---
name: Drizzle billing insert defaults
description: Distinguish inert billing defaults from explicit financial values in free Organization SQL.
---

When filtering financial SQL, an INSERT mentioning billing columns is not by
itself evidence of a paid operation. Drizzle emits omitted schema columns with
DEFAULT values in otherwise complimentary Organization inserts.

**Why:** A column-name-only firewall would reject the approved free Organization
workflow despite that workflow creating no Stripe identity or subscription.
Minimal handcrafted SQL fixtures did not expose this distinction.

**How to apply:** Exercise actual Drizzle-generated inserts with the existing
schema. Allow inert DEFAULT/NULL insert values only when their surrounding
commercial state is explicitly free. Reject supplied financial identities.
Do not extend that exemption to UPDATEs that clear or replace existing billing
state. Keep production behavior unchanged.
