import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const savedEnv = { ...process.env };
afterEach(() => { process.env = { ...savedEnv }; jest.resetModules(); });

function load(runtime = "development") {
  jest.resetModules();
  process.env.NODE_ENV = runtime;
  process.env.STRIPE_LIVE_BILLING_OWNER = "production"; // must not bypass Development
  return require("../services/isolatedStripeClient").default;
}

describe("Development Stripe isolation", () => {
  const operations: [string, (client: any) => unknown][] = [
    ["subscription read", client => client.subscriptions.retrieve("sub_fixture")],
    ["subscription write", client => client.subscriptions.update("sub_fixture", { cancel_at_period_end: true })],
    ["customer lookup", client => client.customers.list()],
    ["customer creation", client => client.customers.create({})],
    ["checkout", client => client.checkout.sessions.create({ mode: "subscription" })],
    ["portal", client => client.billingPortal.sessions.create({ customer: "cus_fixture" })],
    ["promotion", client => client.promotionCodes.list()],
    ["coupon", client => client.coupons.create({ percent_off: 10 })],
    ["price review", client => client.prices.retrieve("price_fixture")],
    ["invoice", client => client.invoices.list()],
    ["v2 API", client => client.v2.core.events.retrieve("evt_fixture")],
    ["raw API", client => client.rawRequest("GET", "/v1/customers")],
    ["webhook verification", client => client.webhooks.constructEvent("{}", "fixture", "fixture")],
  ];
  it.each(operations)("%s cannot reach even an injected HTTP transport", async (_name, operation) => {
    const Stripe = load();
    const httpClient = { makeRequest: jest.fn(() => { throw new Error("Transport must never run"); }) };
    const client = new Stripe("sk_test_fixture_only", { httpClient });
    await expect(Promise.resolve().then(() => operation(client))).rejects.toMatchObject({
      code: "DEVELOPMENT_STRIPE_ISOLATION", statusCode: 503,
    });
    expect(httpClient.makeRequest).not.toHaveBeenCalled();
  });
  it("captures its decision and cannot be reopened by changing environment after import", async () => {
    const Stripe = load();
    process.env.NODE_ENV = "production";
    const client = new Stripe("sk_test_fixture_only");
    await expect(client.customers.list()).rejects.toMatchObject({ code: "DEVELOPMENT_STRIPE_ISOLATION" });
  });
  it("blocks static webhook processing too", () => {
    const Stripe = load();
    expect(() => Stripe.webhooks.constructEvent("{}", "fixture", "fixture")).toThrow("disabled");
  });
  it("does not modify the Production SDK sender or webhook functions", () => {
    const Stripe = load("production");
    const client = new Stripe("sk_test_fixture_only");
    expect(Object.prototype.hasOwnProperty.call(client, "_requestSender")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(client, "webhooks")).toBe(true);
    expect(require("../services/developmentStripeIsolation").developmentStripeIsolated()).toBe(false);
  });
  it("fails closed for an unspecified runtime", () => {
    load("");
    expect(require("../services/developmentStripeIsolation").developmentStripeIsolated()).toBe(true);
  });

  it.each([
    "/api/stripe/subscription-status", "/api/stripe/webhook", "/api/stripe/checkout",
    "/api/promotions", "/api/business/organizations/fixture/renewal",
  ])("rejects %s before authentication, SDK calls or database handler writes", requestPath => {
    load();
    const middleware = require("../middleware/developmentStripeIsolation").developmentStripeIsolationMiddleware;
    const next = jest.fn();
    const res = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    middleware({ path: requestPath }, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
  it.each([
    "/api/business/pilot-activation/issue", "/api/business/pilot-activation/claim",
    "/api/business/create-org", "/api/business/workspace/select", "/api/auth/user",
  ])("leaves the free workflow path %s available", requestPath => {
    load();
    const middleware = require("../middleware/developmentStripeIsolation").developmentStripeIsolationMiddleware;
    const next = jest.fn();
    middleware({ path: requestPath }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it("passes Production billing routes through unchanged", () => {
    load("production");
    const middleware = require("../middleware/developmentStripeIsolation").developmentStripeIsolationMiddleware;
    const next = jest.fn();
    middleware({ path: "/api/stripe/checkout" }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("every runtime server Stripe import uses the shared guarded SDK", () => {
    const files: string[] = [];
    function visit(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "tests") continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (file.endsWith(".ts")) files.push(file);
      }
    }
    visit(path.resolve("server"));
    const bypasses: string[] = [];
    for (const file of files) {
      if (file.endsWith("/isolatedStripeClient.ts")) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
      function inspect(node: ts.Node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
            && node.moduleSpecifier.text === "stripe" && !node.importClause?.isTypeOnly) bypasses.push(file);
        if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
            && node.arguments[0].text === "stripe") bypasses.push(file);
        ts.forEachChild(node, inspect);
      }
      inspect(source);
    }
    expect(bypasses).toEqual([]);
    const index = fs.readFileSync("server/index.ts", "utf8");
    expect(index.indexOf("app.use(developmentStripeIsolationMiddleware)"))
      .toBeLessThan(index.indexOf('app.use("/api/stripe/webhook"'));
    const db = fs.readFileSync("server/db.ts", "utf8");
    expect(db.indexOf("installDevelopmentBillingWriteGuard(pool)")).toBeLessThan(db.indexOf("export const db ="));
    expect(db).toContain('pool.on("connect", installDevelopmentBillingWriteGuard)');
  });
});
