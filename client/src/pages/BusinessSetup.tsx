/**
 * BusinessSetup.tsx
 *
 * First-time business signup flow. Shown immediately after a user creates a
 * business account (/auth?role=business). Collects org name + seat count,
 * creates the businesses row (POST /api/business/create-org), then redirects
 * to Stripe checkout (POST /api/stripe/checkout/business).
 *
 * This page is intentionally ungated — the user has not yet paid.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { Building2, Users, ChevronRight, Loader2, CheckCircle } from "lucide-react";

const SEAT_OPTIONS = [
  { value: 2, label: "2 seats", sublabel: "Small team" },
  { value: 5, label: "5 seats", sublabel: "Growing team" },
  { value: 10, label: "10 seats", sublabel: "Mid-size team" },
  { value: 25, label: "25 seats", sublabel: "Large team" },
  { value: 50, label: "50 seats", sublabel: "Enterprise" },
];

export default function BusinessSetup() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [orgName, setOrgName] = useState("");
  const [seats, setSeats] = useState(5);
  const [customSeats, setCustomSeats] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [step, setStep] = useState<"form" | "redirecting">("form");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill org name if a pending_billing org already exists (e.g. owner returns after
  // abandoning Stripe checkout — we don't want to create a duplicate).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/business/check-status", {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const { exists, status, name } = await res.json();
          if (exists && status === "pending_billing" && name) {
            setOrgName(name);
          }
        }
      } catch {
        // Non-fatal — ignore errors, form stays blank
      }
    })();
  }, []);

  const resolvedSeats = useCustom ? (parseInt(customSeats) || 0) : seats;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (orgName.trim().length < 2) {
      setErr("Please enter your organization name (at least 2 characters).");
      return;
    }
    if (!resolvedSeats || resolvedSeats < 1 || resolvedSeats > 250) {
      setErr("Seat count must be between 1 and 250.");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create the organization record
      const createRes = await fetch("/api/business/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ name: orgName.trim() }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setErr(createData.error || "Could not create your organization. Please try again.");
        setSubmitting(false);
        return;
      }

      // Step 2: Create Stripe checkout session
      const checkoutRes = await fetch("/api/stripe/checkout/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ seats: resolvedSeats }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        setErr(checkoutData.error || "Could not start checkout. Please try again.");
        setSubmitting(false);
        return;
      }

      setStep("redirecting");
      // Redirect to Stripe
      window.location.href = checkoutData.url;
    } catch {
      setErr("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (step === "redirecting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <Loader2 className="w-10 h-10 text-orange-400 animate-spin mb-4" />
        <h2 className="text-white text-lg font-bold mb-1">Taking you to checkout…</h2>
        <p className="text-white/50 text-sm">You'll be redirected to our secure payment page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-600/20 border border-orange-500/20 mb-4">
            <Building2 className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-white text-2xl font-bold">Set Up Your Organization</h1>
          <p className="text-white/50 text-sm mt-2">
            {user?.email && <span className="text-white/70">{user.email} · </span>}
            Name your organization and choose how many seats to purchase.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Org name */}
          <div>
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Organization Name
            </label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30 transition-colors"
              placeholder="e.g. Metroflex Performance Nutrition"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              autoFocus
              maxLength={80}
            />
          </div>

          {/* Seat count */}
          <div>
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-2">
              Number of Seats
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setSeats(opt.value); setUseCustom(false); }}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                    !useCustom && seats === opt.value
                      ? "bg-orange-600/30 border-orange-500/60 text-white"
                      : "bg-white/5 border-white/10 text-white/60 active:bg-white/10"
                  }`}
                >
                  <div className="text-sm font-bold">{opt.value}</div>
                  <div className="text-xs text-white/40">{opt.sublabel}</div>
                </button>
              ))}
              {/* Custom */}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                  useCustom
                    ? "bg-orange-600/30 border-orange-500/60 text-white"
                    : "bg-white/5 border-white/10 text-white/60 active:bg-white/10"
                }`}
              >
                <div className="text-sm font-bold">Custom</div>
                <div className="text-xs text-white/40">1–250</div>
              </button>
            </div>
            {useCustom && (
              <input
                className="mt-2 w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                type="number"
                min={1}
                max={250}
                placeholder="Enter seat count"
                value={customSeats}
                onChange={(e) => setCustomSeats(e.target.value)}
                autoFocus
              />
            )}
            <p className="text-white/30 text-xs mt-2">
              Each seat covers one team member (coaches, trainers, staff). You occupy seat 1 as the owner.
            </p>
          </div>

          {/* Price preview */}
          {resolvedSeats >= 1 && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs">Estimated monthly</p>
                <p className="text-white font-bold text-base">${(44.99 * resolvedSeats).toFixed(2)}/mo</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-xs">Seats</p>
                <p className="text-orange-300 font-bold text-base">{resolvedSeats}</p>
              </div>
            </div>
          )}

          {/* What's included */}
          <div className="space-y-1.5">
            {[
              "Full platform access for every seat",
              "Organization Dashboard with team management",
              "Client invitation & trial access tools",
              "Partner & Revenue Center (after certification)",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-white/60 text-xs">{item}</span>
              </div>
            ))}
          </div>

          {err && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-300 text-sm">{err}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || orgName.trim().length < 2 || resolvedSeats < 1}
            className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating organization…</>
            ) : (
              <><Users className="w-5 h-5" /> Continue to Payment <ChevronRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-white/30 text-xs">
            Secure checkout via Stripe. Cancel or adjust seats any time from your dashboard.
          </p>
        </form>
      </div>
    </div>
  );
}
