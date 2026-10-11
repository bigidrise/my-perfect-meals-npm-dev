import { useState } from "react";
import { getAuthHeaders } from "@/lib/auth";
import type { OrganizationPriceQuote } from "../../../../server/services/organizationCheckoutConsent";

export default function OrganizationPaidContinuation({ businessId }: { businessId: string }) {
  const [quote, setQuote] = useState<OrganizationPriceQuote | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function review() {
    setBusy(true); setError(""); setAccepted(false);
    try {
      const response = await fetch(`/api/stripe/checkout/business/quote?businessId=${encodeURIComponent(businessId)}`, {
        credentials: "include", headers: getAuthHeaders(), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not verify the subscription price.");
      setQuote(data);
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function checkout() {
    if (!quote || !accepted) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/stripe/checkout/business", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          businessId, seats: 1,
          billingConsent: { accepted: true, priceId: quote.priceId, termsVersion: quote.termsVersion },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.recoveryUrl) { window.location.assign(data.recoveryUrl); return; }
        throw new Error(data.error || "Checkout could not start. No new payment was verified.");
      }
      if (!data.url || !data.url.startsWith("https://checkout.stripe.com/")) throw new Error("Unrecognized checkout destination.");
      window.location.assign(data.url);
    } catch (error: any) { setError(error.message); setBusy(false); }
  }
  const price = quote ? new Intl.NumberFormat(undefined, {
    style: "currency", currency: quote.currency.toUpperCase(),
  }).format(quote.unitAmount / 100) : "";
  return <section className="space-y-4 rounded-xl border border-orange-500/30 p-4 text-left">
    {!quote ? <button disabled={busy} onClick={review} className="w-full rounded-xl bg-orange-600 p-3 disabled:opacity-50">{busy ? "Verifying price…" : "Review Organization Subscription"}</button> : <>
      <h3 className="font-bold">Organization subscription: {price} every {quote.intervalCount} {quote.interval}{quote.intervalCount === 1 ? "" : "s"}</h3>
      <p className="text-sm text-white/80">Covers this Organization's business tools. It is not a personal Clinical subscription or a professional Studio subscription, and does not extend anyone's individual trial.</p>
      <p className="text-sm text-white/80">Recurring billing begins when you authorize payment in Stripe Checkout after your complimentary pilot. It renews until canceled. Cancel renewal through the existing Organization billing controls; paid-through access is retained. No automatic conversion was authorized by joining the pilot.</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
        I accept this price, billing interval, and recurring Organization billing terms.</label>
      <button disabled={!accepted || busy} onClick={checkout} className="w-full rounded-xl bg-orange-600 p-3 disabled:opacity-50">{busy ? "Opening secure checkout…" : "Continue to Stripe to Authorize Payment"}</button>
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p className="text-sm text-white/60">Not continuing? Your Organization and records remain preserved. Paid business operations stay restricted. No charge.</p>
  </section>;
}
