import Stripe from "stripe";
import { getTrustedCheckoutPlan } from "../services/stripePlanCatalog";
import {
  CheckoutBillingConflictError,
  consumerCheckoutIdempotencyKey,
  findBlockingMpmSubscription,
  resolveCanonicalCheckoutCustomer,
} from "../services/stripeCheckoutGuard";
import { verifyStripeWebhookEvent } from "../services/stripeWebhookSignature";

const user = {
  id: "user-123",
  email: "customer@example.test",
  firstName: "Test",
  lastName: "Customer",
};

function customer(id: string, metadata: Record<string, string> = { userId: user.id }) {
  return { id, deleted: false, metadata } as Stripe.Customer;
}

function subscription(
  id: string,
  status: Stripe.Subscription.Status,
  priceId: string,
  lookupKey: string,
) {
  return {
    id,
    status,
    metadata: { userId: user.id, sku: lookupKey },
    items: { data: [{ price: { id: priceId, lookup_key: lookupKey } }] },
  } as unknown as Stripe.Subscription;
}

describe("consumer Stripe checkout guard", () => {
  it("reuses a valid stored Stripe customer", async () => {
    const stored = customer("cus_stored");
    const stripe = {
      customers: {
        retrieve: jest.fn().mockResolvedValue(stored),
        update: jest.fn(),
        search: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as Stripe;
    const persist = jest.fn();

    await expect(resolveCanonicalCheckoutCustomer({
      stripe,
      user: { ...user, stripeCustomerId: stored.id },
      persistCustomerId: persist,
    })).resolves.toBe(stored);
    expect((stripe.customers.search as jest.Mock)).not.toHaveBeenCalled();
    expect((stripe.customers.create as jest.Mock)).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("recovers one metadata-verified customer when the local ID is missing", async () => {
    const recovered = customer("cus_recovered");
    const persist = jest.fn().mockResolvedValue(undefined);
    const stripe = {
      customers: {
        search: jest.fn().mockResolvedValue({ data: [recovered] }),
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn(),
      },
      subscriptions: { list: jest.fn() },
      checkout: { sessions: { list: jest.fn() } },
    } as unknown as Stripe;

    await expect(resolveCanonicalCheckoutCustomer({
      stripe,
      user,
      persistCustomerId: persist,
    })).resolves.toBe(recovered);
    expect(persist).toHaveBeenCalledWith(recovered.id);
    expect((stripe.customers.create as jest.Mock)).not.toHaveBeenCalled();
  });

  it("creates one metadata-bound customer only when no verified customer exists", async () => {
    const created = customer("cus_created");
    const persist = jest.fn().mockResolvedValue(undefined);
    const stripe = {
      customers: {
        search: jest.fn().mockResolvedValue({ data: [] }),
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn().mockResolvedValue(created),
      },
      subscriptions: { list: jest.fn() },
      checkout: { sessions: { list: jest.fn() } },
    } as unknown as Stripe;

    await expect(resolveCanonicalCheckoutCustomer({
      stripe,
      user,
      persistCustomerId: persist,
    })).resolves.toBe(created);
    expect((stripe.customers.create as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { userId: user.id } }),
      { idempotencyKey: `mpm-customer:${user.id}` },
    );
    expect(persist).toHaveBeenCalledWith(created.id);
  });

  it("fails safely when multiple customers claim one application identity", async () => {
    const stripe = {
      customers: {
        search: jest.fn().mockResolvedValue({
          data: [customer("cus_one"), customer("cus_two")],
        }),
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn(),
      },
      subscriptions: { list: jest.fn() },
      checkout: { sessions: { list: jest.fn() } },
    } as unknown as Stripe;

    await expect(resolveCanonicalCheckoutCustomer({
      stripe,
      user,
      persistCustomerId: jest.fn(),
    })).rejects.toMatchObject<Partial<CheckoutBillingConflictError>>({
      code: "BILLING_IDENTITY_REVIEW_REQUIRED",
    });
    expect((stripe.customers.create as jest.Mock)).not.toHaveBeenCalled();
  });

  it("uses email only to discover candidates and requires application metadata", async () => {
    const verified = customer("cus_verified", {});
    const unrelated = customer("cus_unrelated", {});
    const stripe = {
      customers: {
        search: jest.fn().mockResolvedValue({ data: [] }),
        list: jest.fn().mockResolvedValue({ data: [verified, unrelated] }),
        create: jest.fn(),
      },
      subscriptions: {
        list: jest.fn()
          .mockResolvedValueOnce({ data: [{ metadata: { userId: user.id } }] })
          .mockResolvedValueOnce({ data: [{ metadata: { userId: "another-user" } }] }),
      },
      checkout: {
        sessions: {
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
      },
    } as unknown as Stripe;
    const persist = jest.fn().mockResolvedValue(undefined);

    await expect(resolveCanonicalCheckoutCustomer({
      stripe,
      user,
      persistCustomerId: persist,
    })).resolves.toBe(verified);
    expect(persist).toHaveBeenCalledWith(verified.id);
    expect((stripe.customers.create as jest.Mock)).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing"] as Stripe.Subscription.Status[])(
    "blocks a %s MPM subscription even when local state is stale",
    async (status) => {
      const trusted = getTrustedCheckoutPlan("mpm_premium");
      expect(trusted).not.toBeNull();
      const active = subscription("sub_active", status, trusted!.priceId, trusted!.planLookupKey);
      const stripe = {
        subscriptions: {
          retrieve: jest.fn().mockRejectedValue(new Error("stale local reference")),
          list: jest.fn().mockResolvedValue({ data: [active] }),
        },
      } as unknown as Stripe;

      const result = await findBlockingMpmSubscription({
        stripe,
        customerId: "cus_one",
        storedSubscriptionId: "sub_stale",
      });
      expect(result?.subscription.id).toBe(active.id);
      expect(result?.planLookupKey).toBe("mpm_premium");
    },
  );

  it("allows checkout after the prior subscription is canceled", async () => {
    const trusted = getTrustedCheckoutPlan("mpm_premium");
    const canceled = subscription("sub_canceled", "canceled", trusted!.priceId, trusted!.planLookupKey);
    const stripe = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({ data: [canceled] }),
      },
    } as unknown as Stripe;

    await expect(findBlockingMpmSubscription({
      stripe,
      customerId: "cus_one",
    })).resolves.toBeNull();
  });

  it("deduplicates repeated and rapid checkout requests in one server window", () => {
    const now = new Date("2026-09-07T13:41:00.000Z").getTime();
    expect(consumerCheckoutIdempotencyKey(user.id, "mpm_premium", now))
      .toBe(consumerCheckoutIdempotencyKey(user.id, "mpm_premium", now + 30_000));
    expect(consumerCheckoutIdempotencyKey(user.id, "mpm_premium", now))
      .not.toBe(consumerCheckoutIdempotencyKey(user.id, "mpm_premium", now + 11 * 60_000));
  });
});

describe("Stripe webhook signature boundary", () => {
  const webhookSecret = "whsec_test_signature_boundary";
  const payload = JSON.stringify({
    id: "evt_test_signature",
    object: "event",
    created: 1_788_797_000,
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_signature" } },
  });
  const stripe = new Stripe("sk_test_signature_boundary");

  it("accepts an event carrying a valid Stripe signature", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
    expect(verifyStripeWebhookEvent({
      stripe,
      rawBody: Buffer.from(payload),
      signature,
      webhookSecret,
    }).id).toBe("evt_test_signature");
  });

  it("rejects an invalid Stripe signature", () => {
    expect(() => verifyStripeWebhookEvent({
      stripe,
      rawBody: Buffer.from(payload),
      signature: "t=1,v1=invalid",
      webhookSecret,
    })).toThrow();
  });
});