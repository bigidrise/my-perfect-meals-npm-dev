# Stripe Webhook Durable Processing Architecture

## Status

This is the proposed follow-up to the bounded webhook stabilization stage. It is
not part of the current implementation.

## Objective

Return a successful Stripe acknowledgement after signature verification and a
durable event write, without making Stripe wait for entitlement transitions,
Stripe API reads, ProCare cleanup, or email delivery.

## Durable inbox

- Keep Stripe event ID as the unique idempotency key.
- Store the verified raw event payload, event type, Stripe creation timestamp,
  ownership identifiers, receipt timestamp, and processing status.
- Commit the inbox record before returning HTTP 2xx.
- Treat an existing event ID as successfully received.
- Prepare and verify the inbox schema during controlled deployment startup,
  never from a webhook request.

## Immediate acknowledgement

The request path should perform only:

1. Raw-body capture.
2. Stripe signature verification.
3. Production billing-owner verification.
4. Durable inbox insert or duplicate lookup.
5. HTTP 2xx response.

If signature verification or the durable write fails, return a non-2xx response
so Stripe retries.

## Background processing

- A worker claims pending inbox rows and runs the existing event-specific
  entitlement logic.
- Preserve current Stripe event timestamp and rank ordering.
- Preserve exact user, organization, customer, and subscription ownership
  checks.
- Record processed, ignored, retryable-failure, and terminal-review outcomes.
- Apply bounded retries with observable next-attempt timestamps.

## Claim leases and attempt tokens

- Each claim receives an immutable attempt token and lease expiration.
- Only the current attempt token may renew the lease, complete the event, or
  record its failure.
- An expired lease can be reclaimed without allowing the earlier worker to
  overwrite the newer result.
- Long-running handlers renew their leases while making external calls.

## Crash recovery

- On startup and on a timer, return expired processing rows to a retryable state.
- A process crash after inbox commit but before processing must not lose the
  event.
- A crash after a business mutation must remain safe through existing
  event-order guards and independently idempotent side effects.
- Review-required identity conflicts remain fail-closed and visible rather than
  being retried indefinitely.

## Independently idempotent side effects

- Entitlement mutations retain event ID, creation time, and rank guards.
- Business subscription transitions retain row locking and identity ownership
  validation.
- Welcome emails use a durable outbox row and the existing stable Resend
  idempotency key.
- ProCare relationship deactivation records progress per relationship so a
  partial loop can resume safely.
- Each side effect can be retried without repeating a completed effect.

## Operational requirements

- Emit metrics for receipt latency, acknowledgement latency, pending depth,
  oldest pending age, retries, terminal failures, and lease recovery.
- Alert on a growing queue, repeated signature failures, unavailable durable
  storage, and review-required ownership conflicts.
- Verify test-mode and live-mode Stripe destinations independently.
- Roll out without changing products, prices, Checkout rules, trial rules,
  Rewardful behavior, or entitlement semantics.