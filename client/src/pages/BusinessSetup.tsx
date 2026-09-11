/**
 * BusinessSetup.tsx
 *
 * First-time business signup flow. Shown immediately after a user creates a
 * business account (/auth?role=business). Collects the organization name,
 * creates the businesses row (POST /api/business/create-org), then redirects
 * to Stripe checkout for the flat Organization plan (POST /api/stripe/checkout/business).
 *
 * This page is intentionally ungated — the user has not yet paid.
 */
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { Building2, Users, ChevronRight, Loader2, CheckCircle } from "lucide-react";

export default function BusinessSetup() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const pilotMode = new URLSearchParams(search).get("pilot") === "1";
  const pilotCreateMode = new URLSearchParams(search).get("pilotCreate") === "1";

  const [orgName, setOrgName] = useState("");
  const [step, setStep] = useState<"form" | "redirecting">("form");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creationRequestId] = useState(() => crypto.randomUUID());
  const [pilotSetup, setPilotSetup] = useState<{
    organizationName: string;
    professionalCapacity: number;
    clientCapacity: number;
    durationDays: number;
    pilotStatus: string;
  } | null>(null);

  // Pre-fill org name if a pending_billing org already exists (e.g. owner returns after
  // abandoning Stripe checkout — we don't want to create a duplicate).
  useEffect(() => {
    (async () => {
      try {
        if (pilotMode) {
          const pilotRes = await fetch("/api/business/pilot-setup", {
            credentials: "include",
            headers: getAuthHeaders(),
          });
          const pilotData = await pilotRes.json();
          if (!pilotRes.ok) throw new Error(pilotData.error || "Could not load pilot setup.");
          setPilotSetup(pilotData);
          setOrgName(pilotData.organizationName);
          return;
        }
        if (pilotCreateMode) return;
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
      } catch (error: any) {
        if (pilotMode) setErr(error?.message || "Could not load pilot setup.");
      }
    })();
  }, [pilotMode, pilotCreateMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (orgName.trim().length < 2) {
      setErr("Please enter your organization name (at least 2 characters).");
      return;
    }
    setSubmitting(true);
    try {
      if (pilotMode) {
        const setupRes = await fetch("/api/business/pilot-setup", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ name: orgName.trim() }),
        });
        const setupData = await setupRes.json();
        if (!setupRes.ok) {
          setErr(setupData.error || "Could not save your organization.");
          setSubmitting(false);
          return;
        }
        setLocation("/business-dashboard");
        return;
      }
      const createRes = await fetch(pilotCreateMode ? "/api/business/pilot-organizations" : "/api/business/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(
          pilotCreateMode
            ? { name: orgName.trim(), creationRequestId }
            : { name: orgName.trim() },
        ),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        if (createData.code === "MFA_ENROLLMENT_REQUIRED") {
          setErr("Two-factor authentication must be enabled before starting an Organization. Open Account Security in More to finish setup.");
          setSubmitting(false);
          return;
        }
        if (createData.code === "MFA_REQUIRED") {
          setErr("Please complete two-factor verification for this session, then try again.");
          setSubmitting(false);
          return;
        }
        setErr(createData.error || "Could not create your organization. Please try again.");
        setSubmitting(false);
        return;
      }

      if (pilotCreateMode) {
        setLocation("/business-organizations");
        return;
      }

      const checkoutRes = await fetch("/api/stripe/checkout/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({}),
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
            {pilotMode
              ? "Confirm your organization details and authorized pilot capacity."
               : "Name your organization and activate your flat-rate Organization plan."}
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
              placeholder="e.g. Apex Performance Nutrition"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              autoFocus
              maxLength={80}
            />
          </div>

          {/* Organization access or authorized pilot capacity */}
          <div>
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-2">
              {pilotMode ? "Authorized Professional Capacity" : "Organization Plan"}
            </label>
            {pilotMode ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                  <p className="text-xs text-white/50">Professional seats</p>
                  <p className="mt-1 text-2xl font-bold text-orange-300">{pilotSetup?.professionalCapacity ?? 0}</p>
                </div>
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                  <p className="text-xs text-white/50">Client capacity</p>
                  <p className="mt-1 text-2xl font-bold text-violet-300">{pilotSetup?.clientCapacity ?? 0}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="text-xs text-white/50">Flat monthly plan</p>
                <p className="mt-1 text-2xl font-bold text-orange-300">$44.99/month</p>
              </div>
            )}
            <p className="text-white/30 text-xs mt-2">
              {pilotMode
                ? `These limits come from the approved authorization and cannot be increased here. The ${pilotSetup?.durationDays ?? 30}-day clock remains stopped while the pilot is Preparing.`
                : "Invite and manage professional team members from your Organization Dashboard. Each invited professional receives a one-time 30-day introductory entitlement, then needs another valid entitlement to continue professional access."}
            </p>
          </div>

          {/* Price preview */}
            {!pilotMode && !pilotCreateMode && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs">Organization / Business Suite</p>
                <p className="text-white font-bold text-base">$44.99/mo</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-xs">Team invitations</p>
                <p className="text-orange-300 font-bold text-base">Included</p>
              </div>
            </div>
          )}

          {/* What's included */}
          <div className="space-y-1.5">
            {[
              "Organization Dashboard with client and team management",
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
              {err.includes("Account Security") && (
                <button
                  type="button"
                  onClick={() => setLocation("/more")}
                  className="mt-2 text-sm font-semibold text-orange-300 underline underline-offset-2"
                >
                  Open Account Security
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || orgName.trim().length < 2}
            className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
              {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating organization…</>
            ) : (
                <><Users className="w-5 h-5" /> {pilotMode ? "Open Business Suite" : pilotCreateMode ? "Add Organization" : "Continue to Payment"} <ChevronRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-white/30 text-xs">
              {pilotMode
              ? "No payment is required for this authorized pilot. Claiming setup does not start the pilot clock."
                : pilotCreateMode
                  ? "This organization uses your approved complimentary pilot access. No payment is required."
              : "Secure checkout via Stripe. Your flat Organization subscription is $44.99/month."}
          </p>
        </form>
      </div>
    </div>
  );
}
