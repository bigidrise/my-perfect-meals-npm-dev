import { useState } from "react";
import { useLocation } from "wouter";
import { Building2, X, ChevronRight, Users, User, Star, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import type { User as UserType } from "@/lib/auth";

function resolveProviderRoute(user: UserType | null): { route: string; description: string } {
  if (!user) return { route: "/pro-portal", description: "Launch your independent ProCare account" };

  if (user.procareTrainingCompleted && user.attestedAt) {
    return { route: "/pro-portal", description: "Open your independent studio" };
  }
  if (user.isProCare && user.procareTrainingCompleted && !user.attestedAt) {
    return { route: "/pro-portal", description: "Complete credential verification" };
  }
  if (user.isProCare && !user.procareTrainingCompleted) {
    return { route: "/learning", description: "Continue Platform Mastery training" };
  }
  return { route: "/pro-portal", description: "Launch your independent ProCare account" };
}

async function serverDismiss() {
  try {
    await fetch(apiUrl("/api/business/removal-notice/dismiss"), {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      credentials: "include",
    });
  } catch (_) {}
}

export function SponsorEndedBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const removal = user?.recentlyRemovedFromBusiness;
  if (!removal || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    serverDismiss();
  }

  const providerPath = resolveProviderRoute(user ?? null);

  const actions = [
    {
      icon: Briefcase,
      label: "Start My Own Practice",
      description: providerPath.description,
      onClick: () => { handleDismiss(); setLocation(providerPath.route); },
    },
    {
      icon: User,
      label: "Continue as a Client",
      description: "Keep using MPM as an individual member",
      onClick: () => { handleDismiss(); setLocation("/home"); },
    },
    {
      icon: Star,
      label: "Continue with Free",
      description: "Basic meal generation — always free",
      onClick: () => { handleDismiss(); setLocation("/home"); },
    },
    {
      icon: Users,
      label: "Join Another Organization",
      description: "Accept an invite from a different business",
      onClick: () => { handleDismiss(); setLocation("/home"); },
    },
  ];

  return (
    <div className="mx-4 mb-4 rounded-xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-black via-amber-950/20 to-black shadow-lg">
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-amber-500/20 shrink-0">
            <Building2 className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Your {removal.businessName}-sponsored access has ended
            </p>
            <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
              Your personal account, meal history, Academy progress, and certifications are all still here.
              Choose how you'd like to continue.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-2 shrink-0 p-1 rounded-lg bg-white/5 active:bg-white/10"
        >
          <X className="h-4 w-4 text-white/50" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 active:bg-white/10 text-left transition-colors"
            >
              <div className="shrink-0 p-1.5 rounded-md bg-orange-600/20">
                <Icon className="h-4 w-4 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{action.label}</p>
                <p className="text-xs text-white/50 truncate">{action.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
