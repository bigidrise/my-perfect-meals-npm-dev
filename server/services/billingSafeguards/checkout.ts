import type Stripe from "stripe";
import { BillingSafetyError, subjectKey, terminalSubscriptionStates } from "./subjects";
import { CheckoutOperationStore, type OperationInput } from "./store";

const SAFE_PROVIDER_RETRY_MS = 23 * 60 * 60 * 1000;
const objectId = (value: any): string | null => typeof value === "string" ? value : value?.id ?? null;

export interface GuardedCheckoutInput extends OperationInput {
  stripe: Stripe;
  store: CheckoutOperationStore;
  /** Must check all relevant customer histories and nonterminal states, before *any* create. */
  assertNoExistingContract: () => Promise<void>;
  now?: () => number;
}

/** Crash-safe saga: persist first, no open DB transaction around provider calls. */
export async function guardedSubscriptionCheckout(input: GuardedCheckoutInput): Promise<Stripe.Checkout.Session> {
  await input.assertNoExistingContract();
  const op = await input.store.claim(input);
  if (input.payload.customer && op.customer_id && input.payload.customer !== op.customer_id) {
    throw new BillingSafetyError("BILLING_CANONICAL_CUSTOMER_CHANGED", "The canonical billing customer changed; manual review is required.");
  }
  if (op.state === "review_required") {
    throw new BillingSafetyError("BILLING_REVIEW_REQUIRED", "A previous checkout needs review; do not pay again.");
  }
  // A pending operation owns the relationship across plans, tabs, restarts and retries.
  if (op.session_id) {
    const saved = await input.stripe.checkout.sessions.retrieve(op.session_id);
    const metadata = saved.metadata ?? {};
    if (saved.livemode !== input.livemode || metadata.mpmBillingSubject !== subjectKey(input.subject) ||
        metadata.mpmCheckoutOperation !== op.operation_id ||
        metadata.userId !== input.subject.ownerUserId ||
        objectId(saved.customer) !== op.customer_id) {
      await input.store.review(op);
      throw new BillingSafetyError("BILLING_SESSION_IDENTITY_CONFLICT", "The saved checkout identity could not be verified.");
    }
    if (saved.status === "open" && saved.url) {
      if (op.plan_key !== input.planKey) {
        throw new BillingSafetyError("BILLING_CHECKOUT_PENDING", "Finish or close the existing checkout before changing plans.");
      }
      return saved;
    }
    const subId = objectId(saved.subscription);
    if (subId) {
      const sub = await input.stripe.subscriptions.retrieve(subId);
      if (objectId(sub.customer) !== op.customer_id || sub.metadata?.mpmBillingSubject !== op.subject_key) {
        await input.store.review(op);
        throw new BillingSafetyError("BILLING_SUBSCRIPTION_IDENTITY_CONFLICT", "Completed payment needs billing review.");
      }
      if (!terminalSubscriptionStates.has(sub.status)) {
        throw new BillingSafetyError("BILLING_VERIFICATION_PENDING", "Checkout is already complete. Do not pay again; verify the existing payment.");
      }
    } else if (saved.status !== "expired" || saved.payment_status === "paid") {
      throw new BillingSafetyError("BILLING_VERIFICATION_PENDING", "The previous checkout is not safely replaceable.");
    }
    // Only provider-proven terminal/expired sessions can release their slot.
    await input.assertNoExistingContract();
    if (!await input.store.retire(op)) {
      throw new BillingSafetyError("BILLING_CHECKOUT_CHANGED", "Checkout changed; retry verification.");
    }
    return guardedSubscriptionCheckout(input);
  }
  if (op.plan_key !== input.planKey) {
    throw new BillingSafetyError("BILLING_CHECKOUT_PENDING", "Another plan is already being checked out for this relationship.");
  }
  if ((input.now?.() ?? Date.now()) - new Date(op.created_at).getTime() >= SAFE_PROVIDER_RETRY_MS) {
    await input.store.review(op);
    throw new BillingSafetyError("BILLING_UNBOUND_CHECKOUT", "A prior payment attempt needs manual verification. Do not pay again.");
  }
  const metadata = {
    ...(op.request_payload.metadata ?? {}),
    userId: input.subject.ownerUserId,
    mpmBillingSubject: op.subject_key,
    mpmCheckoutOperation: op.operation_id,
  };
  let customerId = op.customer_id;
  if (!customerId) {
    const customer = await input.stripe.customers.create({
      email: op.request_payload.customer_email,
      metadata: { userId: input.subject.ownerUserId, mpmBillingSubject: op.subject_key },
    }, { idempotencyKey: `mpm-billing-customer:${op.account_id}:${op.operation_id}` });
    customerId = customer.id;
    await input.store.bindCustomer(op, customerId);
  }
  const customer = await input.stripe.customers.retrieve(customerId);
  // Property checks also narrow the SDK union in the server-only non-strict build.
  if (customer.deleted === true || !("livemode" in customer) || !("metadata" in customer) ||
      customer.livemode !== input.livemode ||
      (customer.metadata?.userId && customer.metadata.userId !== input.subject.ownerUserId)) {
    await input.store.review(op);
    throw new BillingSafetyError("BILLING_CUSTOMER_IDENTITY_CONFLICT", "Billing customer needs review.");
  }
  await input.assertNoExistingContract();
  // Use the *persisted* payload, including URLs and promotions, on every retry.
  const payload: Record<string, any> = { ...op.request_payload, customer: customerId, metadata,
    subscription_data: { ...(op.request_payload.subscription_data ?? {}),
      metadata: { ...(op.request_payload.subscription_data?.metadata ?? {}), ...metadata } },
  };
  delete payload.customer_email;
  const session = await input.stripe.checkout.sessions.create(
    payload as Stripe.Checkout.SessionCreateParams,
    { idempotencyKey: `mpm-billing-checkout:${op.account_id}:${op.operation_id}` },
  );
  if (!session.url || session.livemode !== input.livemode ||
      objectId(session.customer) !== customerId ||
      session.metadata?.mpmCheckoutOperation !== op.operation_id ||
      session.metadata?.mpmBillingSubject !== op.subject_key) {
    await input.store.review(op);
    throw new BillingSafetyError("BILLING_PROVIDER_RESPONSE_INVALID", "Checkout creation needs verification; do not pay again.");
  }
  await input.store.bindSession(op, session.id);
  return session;
}
