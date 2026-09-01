# Legacy Stripe Cross-Partition Identity Reconciliation

## Current blocker

The Stripe ownership migration detects an existing customer/subscription identity stored in both a user row and a Clinical Business row. The shared ownership registry assigns that identity to the business partition, then the migration rejects the remaining user-side binding.

This is intentional fail-closed behavior. Application boot is not billing authority and must not decide which live Stripe state is correct.

Do not:

- clear either identity directly in Neon;
- add a customer-specific migration exception;
- weaken personal-versus-business registry validation;
- treat email, client claims, or checkout-return parameters as authority;
- run reconciliation until the production runtime is healthy and the live Stripe source has been verified.

## Authoritative repair operation

The approved repair is a verified **business checkout reconciliation** using the affected completed Stripe Checkout Session:

1. Run the server reconciliation operation with the authenticated MPM owner ID and exact Stripe Checkout Session ID.
2. Retrieve the session and expanded subscription directly from Stripe.
3. Require:
   - subscription mode and completed session status;
   - session `userId` metadata equal to the authenticated immutable MPM user ID;
   - subscription `userId` metadata equal to that same user ID;
   - exact session/subscription customer equality;
   - a price and SKU mapped by the server-owned trusted plan catalog;
   - the Clinical Business lookup key;
   - active or trialing subscription status.
4. Claim a durable reconciliation event.
5. Invoke the business subscription transition with the Stripe-verified:
   - owner user ID;
   - business ID;
   - checkout reservation ID;
   - checkout session ID;
   - customer ID;
   - subscription ID;
   - status and seat quantity.

The application endpoint that performs these checks is the authenticated checkout reconciliation route backed by `reconcileCheckoutSession`. For a Clinical Business plan, that service must call `applyBusinessSubscriptionTransition`; it must never call the personal subscription mutation.

## Transactional repair guarantee

`applyBusinessSubscriptionTransition` performs the repair in one database transaction:

1. Lock the business row.
2. Verify the immutable owner, pending reservation, checkout session, and exact existing Stripe identity.
3. Reject any cross-owner user claim.
4. Claim both customer and subscription IDs in the shared Stripe identity registry under the exact business partition. A partial or conflicting claim throws and rolls back the transaction.
5. Reject stale billing events.
6. Verify the owner user still exists.
7. Clear only the same owner's user-side Stripe customer/subscription fields that exactly match the verified business identities.
8. Apply the Clinical Business entitlement to the owner's effective access without overwriting the stored personal-plan snapshot.
9. Persist the business customer/subscription identity, active status, seat limit, and event-ordering fields.
10. Ensure the owner membership exists.
11. Commit all changes together.

If any check or write fails, none of the identity cleanup, entitlement update, business binding, or membership update commits.

## Required execution order

1. Diagnose and restore a healthy production runtime. This is a separate release blocker.
2. Verify the deployed revision and the intended public production hostname.
3. Verify live Stripe webhook delivery and the exact completed business Checkout Session from Stripe.
4. Run the authoritative business reconciliation operation in a controlled production context that can execute the reconciliation service **before** the strict boot migration blocks normal startup.
5. Confirm:
   - the shared identity registry has one business-partition owner for both identities;
   - the duplicate user-side Stripe identity fields are null;
   - the business row contains the exact verified Stripe customer/subscription IDs;
   - the owner has correct effective Clinical Business access;
   - the personal entitlement snapshot remains unchanged.
6. Rerun the strict migration and confirm clean startup.
7. Rerun entitlement-authority review.
8. Only then consider publishing or pushing the completed pipeline.

## Status

Do not run this operation yet. Task #1581 remains blocked by the known legacy identity collision pending authoritative reconciliation.