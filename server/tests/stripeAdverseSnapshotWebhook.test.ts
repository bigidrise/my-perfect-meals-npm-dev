import express, { type Express } from "express";
import request from "supertest";
import Stripe from "stripe";
import { claimBillingEvent, completeBillingEvent, failBillingEvent } from "../services/stripeBillingEventService";
import { resolveStripeEventUser, cancelUserSubscription } from "../services/subscriptionService";
import { applyBusinessSubscriptionTransition } from "../services/businessSubscriptionService";
import { prepareVerifiedSnapshotHook } from "../services/verifiedServiceBillingWriter";
import { planFromSubscription } from "../services/stripePlanCatalog";

jest.mock("../services/stripeBillingEventService", () => ({
  claimBillingEvent: jest.fn(),
  completeBillingEvent: jest.fn(),
  failBillingEvent: jest.fn(),
}));
jest.mock("../services/subscriptionService", () => ({
  resolveStripeEventUser: jest.fn(),
  resolveSubscriptionUser: jest.fn(),
  cancelUserSubscription: jest.fn(),
  updateUserSubscription: jest.fn(),
}));
jest.mock("../services/businessSubscriptionService", () => ({
  applyBusinessSubscriptionTransition: jest.fn(),
}));
jest.mock("../services/verifiedServiceBillingWriter", () => ({
  prepareVerifiedSnapshotHook: jest.fn(),
  persistVerifiedTerminalFromHistory: jest.fn(),
}));
jest.mock("../services/stripePlanCatalog", () => ({
  planFromSubscription: jest.fn(),
}));

const secret = "whsec_adverse_snapshot_fixture";
const signer = new Stripe("sk_test_adverse_snapshot_fixture");
const claim = claimBillingEvent as jest.Mock;
const complete = completeBillingEvent as jest.Mock;
const fail = failBillingEvent as jest.Mock;
const owner = resolveStripeEventUser as jest.Mock;
const cancel = cancelUserSubscription as jest.Mock;
const transition = applyBusinessSubscriptionTransition as jest.Mock;
const hook = prepareVerifiedSnapshotHook as jest.Mock;
const plan = planFromSubscription as jest.Mock;

function signedAdverseEvent(organization: boolean) {
  const payload = JSON.stringify({
    id: organization ? "evt_org_past_due_fixture" : "evt_personal_past_due_fixture",
    object: "event",
    created: 1790812800,
    type: "customer.subscription.updated",
    data: { object: {
      id: organization ? "sub_org_fixture" : "sub_personal_fixture",
      object: "subscription",
      customer: organization ? "cus_org_fixture" : "cus_personal_fixture",
      status: "past_due",
      metadata: { userId: "owner-fixture", ...(organization ? { businessId: "business-fixture" } : {}) },
      items: { data: [{ quantity: 1 }] },
    } },
  });
  return {
    payload,
    signature: Stripe.webhooks.generateTestHeaderString({ payload, secret }),
  };
}

describe("signed adverse-status webhook delivery with snapshot ingestion enabled", () => {
  let app: Express;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalGate = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_adverse_snapshot_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = "true";
    const { markStripeBillingReady } = await import("../services/stripeBillingReadiness");
    markStripeBillingReady();
    const router = (await import("../routes/stripeWebhook")).default;
    app = express();
    app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), router);
  });

  afterAll(() => {
    for (const [key, value] of [
      ["STRIPE_SECRET_KEY", originalKey],
      ["STRIPE_WEBHOOK_SECRET", originalSecret],
      ["SERVICE_BILLING_SNAPSHOTS_ENABLED", originalGate],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    claim.mockResolvedValue("claimed");
    complete.mockResolvedValue(undefined);
    fail.mockResolvedValue(undefined);
    owner.mockResolvedValue({ id: "owner-fixture" });
    hook.mockResolvedValue(async () => {});
  });

  it.each([false, true])(
    "retries %s organization adverse events when the snapshot transaction fails",
    async (organization) => {
      plan.mockReturnValue({ planLookupKey: organization ? "clinical_business_monthly" : "mpm_trainer_5" });
      const mutation = organization ? transition : cancel;
      mutation.mockRejectedValueOnce(new Error("snapshot write failed"))
        .mockResolvedValueOnce({ updated: true });
      const { payload, signature } = signedAdverseEvent(organization);
      const deliver = () => request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", signature)
        .send(payload);

      await deliver().expect(500, "Webhook handler error");
      expect(fail).toHaveBeenCalledWith(
        organization ? "evt_org_past_due_fixture" : "evt_personal_past_due_fixture",
        expect.objectContaining({ message: "snapshot write failed" }),
      );
      expect(complete).not.toHaveBeenCalled();
      await deliver().expect(200, { received: true });
      expect(hook).toHaveBeenCalledTimes(2);
      expect(mutation).toHaveBeenCalledTimes(2);
      if (organization) {
        expect(mutation.mock.calls[1][0]).toEqual(
          expect.objectContaining({ status: "past_due", onAccepted: expect.any(Function) }),
        );
      } else {
        expect(mutation.mock.calls[1][4]).toEqual(expect.any(Function));
      }
      expect(complete).toHaveBeenCalledTimes(1);
    },
  );
});