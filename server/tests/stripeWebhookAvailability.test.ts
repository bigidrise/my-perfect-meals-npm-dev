import express, { type Express } from "express";
import request from "supertest";
import Stripe from "stripe";

jest.mock("../services/stripeBillingEventService", () => ({
  claimBillingEvent: jest.fn(),
  completeBillingEvent: jest.fn(),
  failBillingEvent: jest.fn(),
}));

const webhookSecret = "whsec_webhook_availability_test";
const stripe = new Stripe("sk_test_webhook_availability");

function signedPayload(type = "test.unhandled") {
  const payload = JSON.stringify({
    id: `evt_${type.replaceAll(".", "_")}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object: { id: "obj_webhook_availability" } },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  return { payload, signature };
}

describe("Stripe webhook startup availability", () => {
  let app: Express;
  let claimBillingEvent: jest.Mock;
  let completeBillingEvent: jest.Mock;
  let failBillingEvent: jest.Mock;
  let markStripeBillingReady: () => void;

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_webhook_availability";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

    const billing = await import("../services/stripeBillingEventService");
    claimBillingEvent = billing.claimBillingEvent as jest.Mock;
    completeBillingEvent = billing.completeBillingEvent as jest.Mock;
    failBillingEvent = billing.failBillingEvent as jest.Mock;

    const readiness = await import("../services/stripeBillingReadiness");
    markStripeBillingReady = readiness.markStripeBillingReady;

    const webhookRouter = (await import("../routes/stripeWebhook")).default;
    app = express();
    app.use(
      "/api/stripe/webhook",
      express.raw({ type: "application/json" }),
      webhookRouter,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    claimBillingEvent.mockResolvedValue("claimed");
    completeBillingEvent.mockResolvedValue(undefined);
    failBillingEvent.mockResolvedValue(undefined);
  });

  it("rejects a missing signature before billing readiness", async () => {
    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .send("{}")
      .expect(400, "Missing Stripe signature");
  });

  it("verifies the raw signature then returns promptly while the ledger initializes", async () => {
    const { payload, signature } = signedPayload();
    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(503, "Stripe billing ledger is still initializing");
    expect(claimBillingEvent).not.toHaveBeenCalled();
  });

  it("acknowledges a durably claimed valid event after readiness", async () => {
    markStripeBillingReady();
    const { payload, signature } = signedPayload();
    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200, { received: true });
    expect(claimBillingEvent).toHaveBeenCalledTimes(1);
    expect(completeBillingEvent).toHaveBeenCalledWith(
      "evt_test_unhandled",
      "ignored",
      null,
    );
  });

  it("acknowledges duplicate events without repeating processing", async () => {
    claimBillingEvent.mockResolvedValue("duplicate");
    const { payload, signature } = signedPayload();
    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200, { received: true, duplicate: true });
    expect(completeBillingEvent).not.toHaveBeenCalled();
  });

  it("returns a completed 503 response when the event cannot be claimed", async () => {
    claimBillingEvent.mockRejectedValue(new Error("ledger unavailable"));
    const { payload, signature } = signedPayload();
    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(503, "Stripe billing event store unavailable");
  });

  it("still completes with 500 when both processing and failure recording reject", async () => {
    completeBillingEvent.mockRejectedValue(new Error("completion failed"));
    failBillingEvent.mockRejectedValue(new Error("failure ledger unavailable"));
    const { payload, signature } = signedPayload();
    await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(500, "Webhook handler error");
  });
});