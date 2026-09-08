import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";

type OrganizationState = {
  exists: boolean;
  status: string | null;
  name: string | null;
  callerRole?: string;
};

const journey = [
  {
    icon: Building2,
    title: "Set up your organization",
    description: "Enter the required business information before payment.",
  },
  {
    icon: CreditCard,
    title: "Activate your Business Suite",
    description: "Subscribe for $44.99/month. Start with one professional owner and add professional team seats later.",
  },
  {
    icon: UserPlus,
    title: "Invite your clients",
    description: "Invite clients from your Organization Dashboard and choose a 7, 14, or 30-day complimentary trial.",
  },
  {
    icon: Users,
    title: "Existing members connect automatically",
    description: "They sign in to the same My Perfect Meals account and accept—no duplicate account required.",
  },
  {
    icon: ShieldCheck,
    title: "New members create an account",
    description: "They create an account from the invitation, then continue into the same acceptance flow.",
  },
  {
    icon: CheckCircle2,
    title: "Work with them in ProCare",
    description: "Accepted clients connect to your organization and appear in ProCare Studio.",
  },
];

export default function BusinessStart() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, loading } = useAuth();
  const [organization, setOrganization] = useState<OrganizationState | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      setOrganization(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    fetch("/api/business/check-status", {
      headers: getAuthHeaders() as HeadersInit,
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to check organization status");
        return response.json();
      })
      .then((data: OrganizationState) => {
        if (!cancelled) setOrganization(data);
      })
      .catch(() => {
        if (!cancelled) setOrganization({ exists: false, status: null, name: null });
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const params = new URLSearchParams(search);
  const source = params.get("source") || params.get("ref") || null;
  const isActive = organization?.exists && organization.status === "active";
  const isIncomplete = organization?.exists && !isActive;

  function handlePrimaryAction() {
    if (isActive) {
      setLocation("/business-dashboard");
      return;
    }
    if (user) {
      setLocation("/business/setup");
      return;
    }

    const target = new URLSearchParams({ role: "business", mode: "signup" });
    if (source) target.set("source", source);
    setLocation(`/auth?${target.toString()}`);
  }

  const actionLabel = isActive
    ? "Open Organization Dashboard"
    : isIncomplete
      ? "Complete Organization Setup"
      : user
        ? "Start Your Organization"
        : "Create an Account to Start";

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-black to-blue-950/30 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
        <button className="flex items-center gap-2 text-left" onClick={() => setLocation(user ? "/more" : "/")}>
          <Building2 className="w-6 h-6 text-blue-400" />
          <span className="font-bold tracking-tight">My Perfect Meals</span>
          <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-200 border border-blue-500/25">
            Business Suite
          </span>
        </button>
        {!loading && !user && (
          <button onClick={() => setLocation("/auth?mode=login")} className="text-sm text-white/70 hover:text-white">
            Sign in
          </button>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300 mb-3">
            Start Your Organization
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">$44.99/month</h1>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-white/70 max-w-2xl mx-auto">
            Turn My Perfect Meals into a business platform for your clients and team. Set up your organization,
            invite existing members or new clients, and manage them from your Organization Dashboard and ProCare Studio.
          </p>
          {organization?.name && (
            <p className="mt-4 text-sm text-blue-200">
              {isActive ? "Active organization" : "Setup in progress"}: <strong>{organization.name}</strong>
            </p>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/50">How it works</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {journey.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{index + 1}. {item.title}</p>
                    <p className="mt-1 text-xs sm:text-sm leading-relaxed text-white/60">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8 text-center">
          <button
            onClick={handlePrimaryAction}
            disabled={loading || checking}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            data-testid="business-suite-primary-action"
          >
            {loading || checking ? "Checking Organization…" : actionLabel}
            {!loading && !checking && <ArrowRight className="h-5 w-5" />}
          </button>
          <p className="mt-3 text-xs text-white/40">
            Organization information is completed before secure checkout.
          </p>
        </div>
      </main>
    </div>
  );
}