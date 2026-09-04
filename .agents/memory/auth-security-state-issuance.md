---
name: Auth security-state issuance
description: Prevents password reset or MFA-factor changes from being bypassed by in-flight authentication requests.
---

Any bearer credential issued after password or MFA verification must be conditionally written only if the account's authentication security version and required MFA state still match the values that were verified.

**Why:** Password reset, MFA disable, or factor replacement can race an in-flight login or MFA challenge. An unconditional token write after verification can recreate a valid credential after the revoking operation completed.

**How to apply:** Read the security version with the credential/factor being verified, include it in the token-issuance update predicate, and require reauthentication when the conditional update affects no row. Factor replacement must also invalidate prior session and bearer proof.