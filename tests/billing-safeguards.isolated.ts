import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import type Stripe from "stripe";
import { CheckoutOperationStore } from "../server/services/billingSafeguards/store";
import { guardedSubscriptionCheckout } from "../server/services/billingSafeguards/checkout";
import { subjectKey, subscriptionSubject, assertPersonalCheckoutPlan, type BillingSubject } from "../server/services/billingSafeguards/subjects";
import { createBillingCheckout } from "../server/services/billingSafeguards/runtime";
import { inspectInventory } from "../server/services/billingSafeguards/inventory";
import { scanBillingDuplicates } from "../server/services/billingSafeguards/monitor";
import { previewPersonalPlanChange, confirmPersonalPlanChange } from "../server/services/billingSafeguards/planChanges";
import { assertVerifiedProviderLink } from "../server/services/accountEmailUniqueness";
import { isSignupEmailConflict } from "../server/services/signupUsername";

const target = process.env.BILLING_ISOLATED_TEST_URL ?? "";
if (!/^postgresql:\/\/billing_fixture@127\.0\.0\.1:\d+\/billing_safeguards_isolated$/.test(target)) {
  throw new Error("Only the runner-owned isolated PostgreSQL is permitted. Shared DATABASE_URL is never read.");
}
const pool = new Pool({ connectionString: target, max: 24 });
const managed = new Map([["price_basic", "mpm_basic"], ["price_pro", "mpm_premium"], ["price_family", "mpm_family_premium"],
  ["price_studio", "mpm_trainer_5"], ["price_org", "clinical_business_monthly"]]);
const personal: BillingSubject = { kind: "personal", ownerUserId: "fixture-user" };
function sub(id: string, extra: any = {}): any {
  return { id, customer: "cus_fixture", status: "active", livemode: false, cancel_at_period_end: false,
    cancel_at: null, billing_cycle_anchor: 100, latest_invoice: "in_existing", metadata: { userId: "fixture-user", sku: "mpm_basic" },
    items: { data: [{ id: "si_fixture", quantity: 1, current_period_end: 2_000_000_000,
      price: { id: "price_basic", currency: "usd", unit_amount: 999, recurring: { interval: "month", interval_count: 1 } } }] }, ...extra };
}
function provider() {
  const state = { subscriptions: [] as any[], sessions: new Map<string, any>(), requests: new Map<string, Promise<any>>(),
    creates: 0, customerCreates: 0, updates: 0, timeoutOnce: false, failOnce: false, failList: false };
  const client: any = {
    accounts: { retrieve: async () => ({ id: "acct_fixture" }) },
    balance: { retrieve: async () => ({ livemode: false }) },
    customers: {
      retrieve: async (id: string) => ({ id, livemode: false, metadata: { userId: "fixture-user" } }),
      create: async (_body: any, options: any) => {
        const key = options.idempotencyKey;
        if (!state.requests.has(key)) {
          state.customerCreates++;
          state.requests.set(key, Promise.resolve({ id: `cus_new_${state.customerCreates}`, livemode: false, metadata: _body.metadata }));
        }
        return state.requests.get(key);
      },
    },
    prices: { retrieve: async (id: string) => ({ id, active: true, currency: "usd", unit_amount: id === "price_pro" ? 2999 : 999,
      recurring: { interval: "month", interval_count: 1 } }) },
    subscriptions: {
      list: () => ({ async *[Symbol.asyncIterator]() {
        if (state.failList) throw new Error("fixture inventory unavailable");
        for (const s of state.subscriptions) yield s;
      } }),
      retrieve: async (id: string) => { const s = state.subscriptions.find(s => s.id === id); if (!s) throw new Error("missing fixture"); return s; },
      update: async (id: string, params: any, options: any) => {
        const key = options.idempotencyKey;
        if (!state.requests.has(key)) {
          state.updates++;
          assert.equal(params.proration_behavior, "none");
          assert.equal(params.billing_cycle_anchor, "unchanged");
          const s = state.subscriptions.find(s => s.id === id);
          s.items.data[0].price = await client.prices.retrieve(params.items[0].price);
          s.metadata = params.metadata;
          state.requests.set(key, Promise.resolve(s));
        }
        return state.requests.get(key);
      },
    },
    checkout: { sessions: {
      retrieve: async (id: string) => { const s = state.sessions.get(id); if (!s) throw new Error("missing session"); return s; },
      create: async (params: any, options: any) => {
        if (state.failOnce) { state.failOnce = false; throw new Error("fixture provider unavailable before create"); }
        const key = options.idempotencyKey;
        if (!state.requests.has(key)) {
          const session = { id: `cs_fixture_${++state.creates}`, livemode: false, status: "open", payment_status: "unpaid",
            url: "https://checkout.example.test/fixture", customer: params.customer, metadata: params.metadata,
            subscription: null };
          state.sessions.set(session.id, session);
          state.requests.set(key, Promise.resolve(session));
        }
        if (state.timeoutOnce) { state.timeoutOnce = false; throw new Error("fixture response lost after create"); }
        return state.requests.get(key);
      },
    } },
  };
  return { stripe: client as Stripe, state };
}
function input(p: ReturnType<typeof provider>, subject = personal, plan = "mpm_basic") {
  return {
    stripe: p.stripe, store: new CheckoutOperationStore(pool), subject, accountId: "acct_fixture", livemode: false,
    planKey: plan, payload: { mode: "subscription", customer: "cus_fixture",
      line_items: [{ price: plan === "mpm_premium" ? "price_pro" : "price_basic", quantity: 1 }],
      success_url: "https://example.test/success", cancel_url: "https://example.test/cancel",
      metadata: { userId: subject.ownerUserId, sku: plan } },
    assertNoExistingContract: async () => {},
  };
}

before(async () => {
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "billing_safeguards_isolated");
  await pool.query("CREATE TABLE users (id text PRIMARY KEY,email text NOT NULL UNIQUE)");
  await pool.query("CREATE TABLE stripe_identity_owners (identity_value text,owner_user_id text,identity_type text)");
  await pool.query("CREATE TABLE stripe_billing_events (customer_id text,user_id text)");
  await pool.query(readFileSync("server/db/migrations/billing-checkout-safeguards.sql", "utf8"));
  await pool.query(readFileSync("server/db/migrations/account-normalized-email-uniqueness.sql", "utf8"));
});
beforeEach(async () => {
  await pool.query("TRUNCATE billing_checkout_operations,billing_duplicate_incidents,billing_safeguard_scans,billing_plan_change_operations,users");
});
after(async () => { await pool.end(); });

test("24 concurrent clicks/tabs/process-independent stores create one operation and payable session", async () => {
  const p = provider();
  const results = await Promise.all(Array.from({ length: 24 }, () => guardedSubscriptionCheckout(input(p))));
  assert.equal(new Set(results.map(r => r.id)).size, 1);
  assert.equal(p.state.creates, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM billing_checkout_operations")).rows[0].n, 1);
});
test("different plans race for the same Personal slot rather than creating two sessions", async () => {
  const p = provider();
  const results = await Promise.allSettled([guardedSubscriptionCheckout(input(p)), guardedSubscriptionCheckout(input(p, personal, "mpm_premium"))]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(p.state.creates, 1);
});
test("provider timeout after creation and server restart recover the same session and persisted payload", async () => {
  const p = provider(); p.state.timeoutOnce = true;
  await assert.rejects(guardedSubscriptionCheckout(input(p)), /response lost/);
  const restarted = input(p); restarted.payload.success_url = "https://changed.example.test/ignored";
  const session = await guardedSubscriptionCheckout(restarted);
  assert.equal(session.id, "cs_fixture_1"); assert.equal(p.state.creates, 1);
});
test("provider outage before creation retries one durable operation", async () => {
  const p = provider(); p.state.failOnce = true;
  await assert.rejects(guardedSubscriptionCheckout(input(p)), /before create/);
  await guardedSubscriptionCheckout(input(p));
  assert.equal(p.state.creates, 1);
});
test("unbound reservation beyond provider safe retry window fails closed", async () => {
  const p = provider(); await input(p).store.claim(input(p));
  await pool.query("UPDATE billing_checkout_operations SET created_at=now()-interval '25 hours'");
  await assert.rejects(guardedSubscriptionCheckout(input(p)), { code: "BILLING_UNBOUND_CHECKOUT" });
  assert.equal(p.state.creates, 0);
});
test("time buckets and later retry never change an open session", async () => {
  const p = provider(); const first = await guardedSubscriptionCheckout(input(p));
  await pool.query("UPDATE billing_checkout_operations SET created_at=now()-interval '2 days'");
  assert.equal((await guardedSubscriptionCheckout(input(p))).id, first.id);
  assert.equal(p.state.creates, 1);
});
test("only confirmed expired unpaid sessions can release a slot", async () => {
  const p = provider(); const first = await guardedSubscriptionCheckout(input(p));
  p.state.sessions.get(first.id).status = "expired";
  const next = await guardedSubscriptionCheckout(input(p));
  assert.notEqual(first.id, next.id);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM billing_checkout_operations WHERE retired_at IS NULL")).rows[0].n, 1);
});
test("expired checkouts retain the subject's canonical customer across new operations", async () => {
  const p = provider();
  const request = input(p);
  delete (request.payload as any).customer;
  const first = await guardedSubscriptionCheckout(request);
  p.state.sessions.get(first.id).status = "expired";
  const second = await guardedSubscriptionCheckout({ ...request, store: new CheckoutOperationStore(pool) });
  assert.notEqual(second.id, first.id);
  assert.equal(second.customer, first.customer);
  assert.equal(p.state.customerCreates, 1);
});
test("paid/completed session without verified subscription blocks repayment", async () => {
  const p = provider(); const first = await guardedSubscriptionCheckout(input(p));
  Object.assign(p.state.sessions.get(first.id), { status: "complete", payment_status: "paid" });
  await assert.rejects(guardedSubscriptionCheckout(input(p)), { code: "BILLING_VERIFICATION_PENDING" });
  assert.equal(p.state.creates, 1);
});
test("wrong customer binding is not silently rebound", async () => {
  const p = provider(); await guardedSubscriptionCheckout(input(p));
  const different = input(p); different.payload.customer = "cus_other";
  await assert.rejects(guardedSubscriptionCheckout(different), { code: "BILLING_CANONICAL_CUSTOMER_CHANGED" });
  assert.equal(p.state.creates, 1);
});
for (const status of ["active", "trialing", "incomplete", "past_due", "unpaid", "paused"]) {
  test(`historical customer ${status} subscription blocks new Personal checkout`, async () => {
    const p = provider();
    p.state.subscriptions = [sub("sub_old", { status, customer: "cus_historical" })];
    await assert.rejects(createBillingCheckout({ stripe: p.stripe, pool, subject: personal, managedPrices: managed,
      params: input(p).payload }), { code: "SUBSCRIPTION_ALREADY_ACTIVE" });
    assert.equal(p.state.creates, 0);
  });
}
test("subscription after 120 unrelated records is still discovered", async () => {
  const p = provider();
  p.state.subscriptions = [...Array.from({ length: 120 }, (_, i) => sub(`sub_external_${i}`, {
    metadata: { userId: `someone_else_${i}`, sku: "mpm_basic" },
  })), sub("sub_late", { customer: "cus_old" })];
  await assert.rejects(createBillingCheckout({ stripe: p.stripe, pool, subject: personal, managedPrices: managed,
    params: input(p).payload }), { code: "SUBSCRIPTION_ALREADY_ACTIVE" });
});
test("separate Studios, Organizations and ProCare relationships never share a slot", async () => {
  const p = provider();
  const subjects: BillingSubject[] = [personal, { kind: "studio", ownerUserId: personal.ownerUserId, scopeId: "studio_1" },
    { kind: "organization", ownerUserId: personal.ownerUserId, scopeId: "org_1" },
    { kind: "organization", ownerUserId: personal.ownerUserId, scopeId: "org_2" },
    { kind: "procare", ownerUserId: personal.ownerUserId, scopeId: '["fixture-user","pro_1"]' }];
  await Promise.all(subjects.map(s => guardedSubscriptionCheckout(input(p, s))));
  assert.equal(p.state.creates, subjects.length);
});
test("legacy Family and Personal plans share their existing personal billing subject", () => {
  const family = sub("sub_family", { metadata: { userId: personal.ownerUserId, sku: "mpm_family_premium" },
    items: { data: [{ quantity: 1, price: { id: "price_family" } }] } });
  assert.equal(subjectKey(subscriptionSubject(family, managed).subject!), subjectKey(personal));
});
test("explicit independent household identity stays distinct; Everfit prices stay unmanaged", () => {
  const family = sub("sub_family", { metadata: { userId: personal.ownerUserId, sku: "mpm_family_premium", householdId: "household_1" },
    items: { data: [{ quantity: 1, price: { id: "price_family" } }] } });
  assert.notEqual(subjectKey(subscriptionSubject(family, managed).subject!), subjectKey(personal));
  const external = sub("sub_everfit", { items: { data: [{ price: { id: "price_everfit" }, quantity: 1 }] } });
  assert.equal(subscriptionSubject(external, managed).managed, false);
  assert.deepEqual(inspectInventory([external], managed, "acct_fixture", false), []);
});
test("scanner detects cross-customer duplicates, deduplicates alerts and resolves only after full scan", async () => {
  const p = provider(); p.state.subscriptions = [sub("sub_keep"), sub("sub_duplicate", { customer: "cus_other" })];
  const alerts: any[] = [];
  const deps = { stripe: p.stripe, pool, managedPrices: managed, alert: (a: any) => { alerts.push(a); } };
  const scan = await scanBillingDuplicates(deps);
  assert.equal(scan.findings.length, 1);
  await scanBillingDuplicates(deps); assert.equal(alerts.length, 1);
  p.state.failList = true;
  await assert.rejects(scanBillingDuplicates(deps));
  assert.equal((await pool.query("SELECT state FROM billing_duplicate_incidents")).rows[0].state, "open");
  p.state.failList = false; p.state.subscriptions.pop();
  await scanBillingDuplicates(deps);
  assert.equal((await pool.query("SELECT state FROM billing_duplicate_incidents")).rows[0].state, "resolved");
});
test("scheduled cancellations are ending incidents, not permission to cancel retained access", () => {
  const findings = inspectInventory([sub("sub_keep"), sub("sub_end", { cancel_at_period_end: true })], managed, "acct_fixture", false);
  assert.equal(findings[0].category, "duplicates_ending");
});
test("product-specific checkout rejects organization/professional catalog bypass", () => {
  for (const plan of ["clinical_business_monthly", "mpm_trainer_5", "mpm_physician_50", "signature_kitchen_pro_monthly"]) {
    assert.throws(() => assertPersonalCheckoutPlan(plan));
  }
  assert.doesNotThrow(() => assertPersonalCheckoutPlan("mpm_family_premium"));
});
test("normalized email DB index arbitrates parallel case/whitespace registrations and email changes", async () => {
  const results = await Promise.allSettled([
    pool.query("INSERT INTO users VALUES ('user_1',$1)", [" Example@Example.test "]),
    pool.query("INSERT INTO users VALUES ('user_2',$1)", ["example@example.test"]),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const failed: any = results.find(r => r.status === "rejected");
  assert.equal(failed.reason.constraint, "users_normalized_email_unique");
  assert.equal(isSignupEmailConflict(failed.reason), true);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n, 1);
  await pool.query("INSERT INTO users VALUES ('other','other@example.test')");
  await assert.rejects(pool.query("UPDATE users SET email=$1 WHERE id='other'", ["\tEXAMPLE@EXAMPLE.TEST\n"]), { code: "23505" });
});
test("database normalization matches JavaScript trim for nonbreaking and Unicode spaces", async () => {
  for (const whitespace of [" ", "\t", "\n", "\v", "\u00a0", "\u2003", "\ufeff"]) {
    const value = `${whitespace}USER@EXAMPLE.TEST${whitespace}`;
    const { rows } = await pool.query("SELECT mpm_normalized_email($1) AS normalized", [value]);
    assert.equal(rows[0].normalized, value.trim().toLowerCase());
  }
});
test("OAuth/password email matches alone never authorize account linking", () => {
  for (const input of [
    { providerEmailVerified: false, authenticatedUserId: "u1", targetUserId: "u1", explicitLinkConsent: true },
    { providerEmailVerified: true, authenticatedUserId: null, targetUserId: "u1", explicitLinkConsent: true },
    { providerEmailVerified: true, authenticatedUserId: "u2", targetUserId: "u1", explicitLinkConsent: true },
    { providerEmailVerified: true, authenticatedUserId: "u1", targetUserId: "u1", explicitLinkConsent: false },
  ]) assert.throws(() => assertVerifiedProviderLink(input));
  assert.doesNotThrow(() => assertVerifiedProviderLink({
    providerEmailVerified: true, authenticatedUserId: "u1", targetUserId: "u1", explicitLinkConsent: true,
  }));
});
test("legacy normalized collisions make migration fail without merging or deleting either identity", async () => {
  await pool.query("DROP INDEX users_normalized_email_unique");
  try {
    await pool.query("INSERT INTO users VALUES ('legacy_a','legacy@example.test'),('legacy_b','Legacy@Example.test')");
    await assert.rejects(pool.query(readFileSync("server/db/migrations/account-normalized-email-uniqueness.sql", "utf8")), { code: "23505" });
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n, 2);
  } finally {
    await pool.query("TRUNCATE users");
    await pool.query(readFileSync("server/db/migrations/account-normalized-email-uniqueness.sql", "utf8"));
  }
});
for (const [beforePrice, targetPrice, targetPlan] of [
  ["price_basic", "price_pro", "mpm_premium"], ["price_pro", "price_basic", "mpm_basic"],
]) {
  test(`confirmed ${beforePrice} to ${targetPrice} changes the existing subscription once without proration`, async () => {
    const p = provider();
    const existing = sub("sub_retained");
    existing.items.data[0].price = await p.stripe.prices.retrieve(beforePrice);
    existing.metadata.sku = managed.get(beforePrice);
    p.state.subscriptions.push(existing);
    const deps = { stripe: p.stripe, pool, ownerUserId: personal.ownerUserId,
      customerId: "cus_fixture", subscriptionId: existing.id, managedPrices: managed };
    const preview = await previewPersonalPlanChange({ ...deps, targetPriceId: targetPrice, targetPlanKey: targetPlan });
    assert.equal(preview.amountDueNow, 0);
    await assert.rejects(confirmPersonalPlanChange({ ...deps, operationId: preview.operationId, acceptedDisclosure: false }),
      { code: "BILLING_CONSENT_REQUIRED" });
    await Promise.all(Array.from({ length: 8 }, () => confirmPersonalPlanChange({
      ...deps, operationId: preview.operationId, acceptedDisclosure: true,
    })));
    assert.equal(p.state.updates, 1); assert.equal(p.state.creates, 0);
    assert.equal(p.state.subscriptions[0].id, "sub_retained");
    assert.equal(p.state.subscriptions[0].items.data[0].current_period_end, 2_000_000_000);
  });
}
test("plan change refuses duplicate active contracts and cannot silently choose one", async () => {
  const p = provider(); p.state.subscriptions.push(sub("sub_one"), sub("sub_two"));
  await assert.rejects(previewPersonalPlanChange({
    stripe: p.stripe, pool, ownerUserId: personal.ownerUserId, customerId: "cus_fixture",
    subscriptionId: "sub_one", managedPrices: managed, targetPriceId: "price_pro", targetPlanKey: "mpm_premium",
  }), { code: "BILLING_PLAN_CHANGE_REVIEW_REQUIRED" });
  assert.equal(p.state.updates, 0);
});

async function planChangeFixture() {
  const p = provider();
  p.state.subscriptions.push(sub("sub_retained"));
  const deps = { stripe: p.stripe, pool, ownerUserId: personal.ownerUserId,
    customerId: "cus_fixture", subscriptionId: "sub_retained", managedPrices: managed };
  const preview = await previewPersonalPlanChange({ ...deps, targetPriceId: "price_pro", targetPlanKey: "mpm_premium" });
  return { p, deps, preview };
}
test("plan confirmation is bound to its persisted Stripe account and mode", async () => {
  const { p, deps, preview } = await planChangeFixture();
  (p.stripe.accounts as any).retrieve = async () => ({ id: "acct_other" });
  await assert.rejects(confirmPersonalPlanChange({ ...deps, operationId: preview.operationId, acceptedDisclosure: true }),
    { code: "BILLING_PLAN_CHANGE_INVALID" });
  (p.stripe.accounts as any).retrieve = async () => ({ id: "acct_fixture" });
  await pool.query("UPDATE billing_plan_change_operations SET livemode=true");
  await assert.rejects(confirmPersonalPlanChange({ ...deps, operationId: preview.operationId, acceptedDisclosure: true }),
    { code: "BILLING_PLAN_CHANGE_INVALID" });
  assert.equal(p.state.updates, 0);
});
test("metered monthly pricing is rejected before any billing mutation", async () => {
  const p = provider(); p.state.subscriptions.push(sub("sub_retained"));
  const original = p.stripe.prices.retrieve.bind(p.stripe.prices);
  (p.stripe.prices as any).retrieve = async (id: string) => ({
    ...await original(id), recurring: { interval: "month", interval_count: 1, usage_type: "metered" },
  });
  await assert.rejects(previewPersonalPlanChange({
    stripe: p.stripe, pool, ownerUserId: personal.ownerUserId, customerId: "cus_fixture",
    subscriptionId: "sub_retained", managedPrices: managed, targetPriceId: "price_pro", targetPlanKey: "mpm_premium",
  }), { code: "BILLING_PLAN_CHANGE_UNSUPPORTED" });
  assert.equal(p.state.updates, 0);
});
test("a renewal after preview requires fresh consent instead of silently changing the disclosed date", async () => {
  const { p, deps, preview } = await planChangeFixture();
  p.state.subscriptions[0].items.data[0].current_period_end++;
  await assert.rejects(confirmPersonalPlanChange({ ...deps, operationId: preview.operationId, acceptedDisclosure: true }),
    { code: "BILLING_RENEWAL_CHANGED" });
  assert.equal(p.state.updates, 0);
});
test("provider read-back detects an altered billing anchor and retries cannot adopt the altered anchor", async () => {
  const { p, deps, preview } = await planChangeFixture();
  const original = p.stripe.subscriptions.update.bind(p.stripe.subscriptions);
  (p.stripe.subscriptions as any).update = async (...args: any[]) => {
    const result = await (original as any)(...args);
    p.state.subscriptions[0].billing_cycle_anchor++;
    return result;
  };
  const request = { ...deps, operationId: preview.operationId, acceptedDisclosure: true };
  await assert.rejects(confirmPersonalPlanChange(request), { code: "BILLING_PLAN_CHANGE_UNVERIFIED" });
  await assert.rejects(confirmPersonalPlanChange(request), { code: "BILLING_RENEWAL_CHANGED" });
  assert.equal(p.state.updates, 1); assert.equal(p.state.creates, 0);
});
test("a plan-change response lost after provider success recovers without another provider mutation", async () => {
  const { p, deps, preview } = await planChangeFixture();
  const original = p.stripe.subscriptions.update.bind(p.stripe.subscriptions);
  (p.stripe.subscriptions as any).update = async (...args: any[]) => {
    await (original as any)(...args);
    throw new Error("fixture plan response lost");
  };
  const request = { ...deps, operationId: preview.operationId, acceptedDisclosure: true };
  await assert.rejects(confirmPersonalPlanChange(request), /response lost/);
  assert.equal((await confirmPersonalPlanChange(request)).applied, true);
  assert.equal(p.state.updates, 1); assert.equal(p.state.creates, 0);
});
