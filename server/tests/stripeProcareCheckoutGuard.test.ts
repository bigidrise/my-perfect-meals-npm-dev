import Stripe from "stripe";
import {
  createCheckoutSession,
  classifyProcareCheckoutSession,
  findBlockingProcareSubscription,
  ProcareCheckoutConflictError,
} from "../services/stripeProcare";

function subscription(
  id: string,
  status: Stripe.Subscription.Status,
  clientUserId = "client-1",
  proUserId = "pro-1",
): Stripe.Subscription {
  return {
    id,
    status,
    metadata: { clientUserId, proUserId },
  } as unknown as Stripe.Subscription;
}

describe("ProCare duplicate checkout guard", () => {
  it.each(["active", "trialing"] as Stripe.Subscription.Status[])(
    "blocks an existing %s relationship subscription",
    async (status) => {
      const active = subscription("sub_active", status);
      const stripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({ data: [active] }),
          retrieve: jest.fn(),
        },
      } as unknown as Stripe;

      await expect(findBlockingProcareSubscription({
        stripeClient: stripe,
        customerId: "cus_client",
        clientUserId: "client-1",
        proUserId: "pro-1",
      })).resolves.toBe(active);
    },
  );

  it("does not block a different legitimate relationship", async () => {
    const stripe = {
      subscriptions: {
        list: jest.fn().mockResolvedValue({
          data: [subscription("sub_other", "active", "client-2", "pro-1")],
        }),
        retrieve: jest.fn(),
      },
    } as unknown as Stripe;

    await expect(findBlockingProcareSubscription({
      stripeClient: stripe,
      customerId: "cus_client",
      clientUserId: "client-1",
      proUserId: "pro-1",
    })).resolves.toBeNull();
  });

  it("fails closed when a stored active subscription cannot be verified", async () => {
    const stripe = {
      subscriptions: {
        retrieve: jest.fn().mockRejectedValue(new Error("missing")),
        list: jest.fn(),
      },
    } as unknown as Stripe;

    await expect(findBlockingProcareSubscription({
      stripeClient: stripe,
      customerId: "cus_client",
      clientUserId: "client-1",
      proUserId: "pro-1",
      storedSubscriptionIds: ["sub_stored"],
    })).rejects.toMatchObject<Partial<ProcareCheckoutConflictError>>({
      code: "PROCARE_BILLING_IDENTITY_REVIEW_REQUIRED",
    });
  });

  it("uses the canonical customer, immutable identities, and reservation idempotency", async () => {
    const create = jest.fn().mockResolvedValue({
      id: "cs_procare",
      url: "https://checkout.test/session",
    });
    const stripe = {
      checkout: { sessions: { create } },
    } as unknown as Stripe;

    await expect(createCheckoutSession({
      stripeClient: stripe,
      customerId: "cus_client",
      clientUserId: "client-1",
      proUserId: "pro-1",
      clientLinkId: "link-1",
      checkoutReservationId: "reservation-1",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
      priceId: "price_procare",
    })).resolves.toEqual({
      id: "cs_procare",
      url: "https://checkout.test/session",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_client",
        metadata: expect.objectContaining({
          userId: "client-1",
          clientUserId: "client-1",
          proUserId: "pro-1",
          clientLinkId: "link-1",
          checkoutReservationId: "reservation-1",
        }),
      }),
      {
        idempotencyKey: "mpm-procare-checkout:client-1:pro-1:reservation-1",
      },
    );
  });

  it("reuses an open session only when every durable identity matches", () => {
    const session = {
      id: "cs_open",
      status: "open",
      url: "https://checkout.test/open",
      customer: "cus_client",
      metadata: {
        userId: "client-1",
        clientUserId: "client-1",
        proUserId: "pro-1",
        clientLinkId: "link-1",
        checkoutReservationId: "reservation-1",
      },
    } as unknown as Stripe.Checkout.Session;

    expect(classifyProcareCheckoutSession({
      session,
      customerId: "cus_client",
      clientUserId: "client-1",
      proUserId: "pro-1",
      clientLinkId: "link-1",
      checkoutReservationId: "reservation-1",
    })).toBe("reuse");
    expect(() => classifyProcareCheckoutSession({
      session,
      customerId: "cus_other",
      clientUserId: "client-1",
      proUserId: "pro-1",
      clientLinkId: "link-1",
      checkoutReservationId: "reservation-1",
    })).toThrow(ProcareCheckoutConflictError);
  });

  it.each(["expired", "complete"] as Stripe.Checkout.Session.Status[])(
    "allows a safely matched %s session reservation to rotate",
    (status) => {
      const session = {
        id: `cs_${status}`,
        status,
        url: null,
        customer: "cus_client",
        metadata: {
          userId: "client-1",
          clientUserId: "client-1",
          proUserId: "pro-1",
          clientLinkId: "link-1",
          checkoutReservationId: "reservation-1",
        },
      } as unknown as Stripe.Checkout.Session;
      expect(classifyProcareCheckoutSession({
        session,
        customerId: "cus_client",
        clientUserId: "client-1",
        proUserId: "pro-1",
        clientLinkId: "link-1",
        checkoutReservationId: "reservation-1",
      })).toBe("rotate");
    },
  );
});