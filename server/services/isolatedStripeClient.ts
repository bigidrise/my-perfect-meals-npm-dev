import Stripe from "stripe";
import {
  assertStripeOperationsAllowed, developmentStripeIsolated,
} from "./developmentStripeIsolation";

// Re-export the genuine SDK and its namespace/types. No SDK internals are changed
// in Production. In Development every SDK instance, including indirect callers,
// receives a blocked sender before a request can reach any HTTP transport.
if (developmentStripeIsolated()) {
  // This interception point is reviewed against the locked SDK. A dependency
  // change must not silently turn isolation into a no-op.
  if ((Stripe as unknown as { PACKAGE_VERSION?: string }).PACKAGE_VERSION !== "19.3.0") {
    throw new Error("Development Stripe isolation requires review of the installed SDK version.");
  }
  function blockMethods(value: object): object {
    return new Proxy(value, {
      get(target, key, receiver) {
        const member = Reflect.get(target, key, receiver);
        if (typeof member === "function") {
          return () => { assertStripeOperationsAllowed(); };
        }
        return member;
      },
    });
  }
  for (const property of ["_requestSender", "webhooks"]) {
    const instances = new WeakMap<object, object>();
    Object.defineProperty(Stripe.prototype, property, {
      configurable: false,
      get() { return instances.get(this); },
      set(value: object) { instances.set(this, blockMethods(value)); },
    });
  }
  // Static webhook verification must not be a processing bypass either.
  Stripe.webhooks = blockMethods(Stripe.webhooks) as typeof Stripe.webhooks;
  const probe = new Stripe("sk_test_local_isolation_probe");
  if (Object.prototype.hasOwnProperty.call(probe, "_requestSender")
      || !(probe as any)._requestSender) {
    throw new Error("Development Stripe sender interception could not be established.");
  }
}

export { default } from "stripe";
