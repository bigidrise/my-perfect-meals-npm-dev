import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, CheckCircle, XCircle, UserCheck, ChevronRight } from "lucide-react";

interface InviteInfo {
  email: string;
  role: string;
  businessName: string;
  expiresAt: string;
}

const NEXT_STEPS = [
  {
    num: 1,
    title: "Complete your personal profile",
    detail: "Start by setting up your dietary profile and preferences. Every professional first experiences the platform as a user — so you understand exactly what your clients see.",
  },
  {
    num: 2,
    title: "Create your Provider account",
    detail: 'Go to More → "Create Provider Account" to begin your professional setup.',
  },
  {
    num: 3,
    title: "Complete Platform Mastery Academy",
    detail: "A short certification program that covers every part of the platform — meal builders, clinical tools, and client management.",
  },
  {
    num: 4,
    title: "Complete ProCare Business Training",
    detail: "Professional onboarding designed specifically for coaches, trainers, and clinicians joining a business team.",
  },
  {
    num: 5,
    title: "Your Studio unlocks automatically",
    detail: "Once training is complete, your ProCare Studio activates. Manage clients, generate meal plans, and access all clinical tools from your personal dashboard.",
    highlight: true,
  },
];

export default function BusinessInviteAccept() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedData, setAcceptedData] = useState<{ businessName: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/business/invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setFetchError(data.error);
        else setInvite(data);
      })
      .catch(() => setFetchError("Could not load invitation."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      setLocation(`/auth?redirect=/business/join/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch(`/api/business/invite/${token}/accept`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not accept invite", description: data.error, variant: "destructive" });
        return;
      }
      setAcceptedData({ businessName: data.businessName, role: data.role });
      setAccepted(true);
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // ── Post-acceptance welcome screen ──────────────────────────────────────────
  if (accepted && acceptedData) {
    const roleLabel = acceptedData.role.charAt(0).toUpperCase() + acceptedData.role.slice(1);
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 pb-16" style={{ paddingBottom: "max(4rem, calc(env(safe-area-inset-bottom) + 3rem))" }}>
        {/* Success header */}
        <div className="bg-gradient-to-r from-blue-900/80 to-blue-700/60 border-b border-blue-500/30 px-6 py-10 text-center" style={{ paddingTop: "max(2.5rem, calc(env(safe-area-inset-top, 0px) + 2rem))" }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-400/40 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-white text-2xl font-bold mb-1">You're officially on the team!</h1>
          <p className="text-blue-200 text-base">
            Welcome to <span className="text-white font-semibold">{acceptedData.businessName}</span>
          </p>
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full bg-blue-600/40 border border-blue-400/30">
            <span className="text-blue-200 text-sm">Your role:</span>
            <span className="text-white text-sm font-semibold">{roleLabel}</span>
          </div>
        </div>

        <div className="px-5 pt-6 max-w-lg mx-auto space-y-5">

          {/* Access confirmation */}
          <div className="bg-blue-950/50 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-blue-300 text-sm font-semibold mb-2">Your account now includes:</p>
            <div className="space-y-1.5">
              {[
                "AI-powered meal generation & customization",
                "Clinical nutrition tools & dietary protocols",
                "Biometric monitoring & progress tracking",
                "ProCare Studio (unlocks after training)",
                "Professional certification programs",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-white/80 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next steps */}
          <div>
            <h2 className="text-white font-bold text-base mb-3 px-1">Here's what to do next:</h2>
            <div className="space-y-3">
              {NEXT_STEPS.map((step) => (
                <div
                  key={step.num}
                  className={`rounded-xl border p-4 flex gap-3 items-start ${
                    step.highlight
                      ? "bg-green-950/40 border-green-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      step.highlight ? "bg-green-600 text-white" : "bg-blue-600 text-white"
                    }`}
                  >
                    {step.num}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold mb-0.5 ${step.highlight ? "text-green-300" : "text-white"}`}>
                      {step.title}
                    </p>
                    <p className="text-white/50 text-xs leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-colors flex items-center justify-center gap-2"
            onClick={() => setLocation("/home")}
          >
            Continue to My Perfect Meals
            <ChevronRight className="w-5 h-5" />
          </button>

          <p className="text-white/30 text-xs text-center pb-4">
            You can return to this team dashboard anytime from the More page.
          </p>
        </div>
      </div>
    );
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <XCircle className="w-14 h-14 text-red-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Invitation Unavailable</h2>
        <p className="text-white/60 text-sm mb-6 max-w-xs">{fetchError}</p>
        <button
          className="px-5 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium transition-colors"
          onClick={() => setLocation("/")}
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!invite) return null;

  // ── Pre-acceptance invitation screen ───────────────────────────────────────
  const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);
  const expiryDate = new Date(invite.expiresAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 pb-16" style={{ paddingBottom: "max(4rem, calc(env(safe-area-inset-bottom) + 3rem))" }}>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/80 to-blue-700/60 border-b border-blue-500/30 px-6 py-10 text-center" style={{ paddingTop: "max(2.5rem, calc(env(safe-area-inset-top, 0px) + 2rem))" }}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/30 mb-4">
          <Building2 className="w-7 h-7 text-blue-400" />
        </div>
        <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">My Perfect Meals</p>
        <h1 className="text-white text-2xl font-bold mb-2">
          Welcome to {invite.businessName}'s Team
        </h1>
        <p className="text-blue-200 text-base">
          You've been invited to join as a <span className="text-white font-semibold">{roleLabel}</span>
        </p>
      </div>

      <div className="px-5 pt-6 max-w-lg mx-auto space-y-5">

        {/* What is MPM */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-white font-bold text-base mb-2">What is My Perfect Meals?</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            My Perfect Meals is an AI-powered clinical nutrition platform built for health professionals and their clients. It generates personalized meal plans, tracks biometrics, and provides evidence-based dietary guidance — all in one platform designed for both providers and the people they serve.
          </p>
        </div>

        {/* What you get */}
        <div className="bg-blue-950/50 border border-blue-500/30 rounded-2xl p-5">
          <p className="text-blue-300 text-sm font-semibold mb-3">As an Organization member, you'll have access to:</p>
          <div className="space-y-2">
            {[
              "AI-powered meal generation & customization",
              "Clinical nutrition tools & dietary protocols",
              "Biometric monitoring & progress tracking",
              "ProCare Studio — manage your own clients",
              "Professional resources & certification programs",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-white/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What happens next preview */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-white/70 text-sm font-semibold mb-3">After you accept, you'll:</p>
          <div className="space-y-2">
            {["Complete your personal profile", "Create your Provider account", "Complete Platform Mastery + ProCare training", "Your Studio unlocks automatically"].map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600/50 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <span className="text-white/60 text-sm">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
          <p className="text-amber-300 text-xs">
            This invitation expires on <span className="font-semibold">{expiryDate}</span>. Accept before then to claim your seat.
          </p>
        </div>

        {/* Login notice */}
        {!user && (
          <div className="bg-blue-900/30 border border-blue-500/20 rounded-xl px-4 py-3 text-center">
            <p className="text-blue-300 text-sm">
              You'll log in or create a free account to accept — takes under a minute.
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Joining…</>
          ) : (
            <><UserCheck className="w-5 h-5" /> {user ? "Accept & Join Team" : "Log In to Accept"}</>
          )}
        </button>

        <p className="text-white/30 text-xs text-center pb-4">
          Invited to {invite.email} · Invited as {roleLabel}
        </p>
      </div>
    </div>
  );
}
