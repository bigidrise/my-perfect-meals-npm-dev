import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  CheckCircle2,
  Circle,
  Lock,
  ChevronRight,
  User,
  BookOpen,
  Briefcase,
  LayoutDashboard,
} from "lucide-react";

interface LaunchpadStatus {
  personalAccountActive: boolean;
  academyCompleted: boolean;
  procareTrainingCompleted: boolean;
}

const BC_GRADIENT = "bg-gradient-to-br from-black/60 via-orange-600 to-black/80";

export default function ProfessionalLaunchpad() {
  usePageTitle("Professional Launchpad");
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<LaunchpadStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const role = user?.professionalRole || "trainer";
  const roleName = role === "physician" ? "Physician" : "Trainer";

  useEffect(() => {
    apiRequest<LaunchpadStatus>("/api/pro/training/launchpad-status")
      .then((data) => setStatus(data))
      .catch(() => setStatus({ personalAccountActive: false, academyCompleted: false, procareTrainingCompleted: false }))
      .finally(() => setLoading(false));
  }, []);

  const studioUnlocked = status?.academyCompleted && status?.procareTrainingCompleted;

  const steps = [
    {
      id: "account",
      icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
      title: "Professional Account Created",
      subtitle: `Welcome, ${roleName}. Your account is ready.`,
      done: true,
      locked: false,
      button: null,
    },
    {
      id: "personal",
      icon: status?.personalAccountActive
        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
        : <Circle className="w-5 h-5 text-white/40" />,
      title: "Personal Account",
      subtitle: status?.personalAccountActive
        ? "Active — you're using the app as a client."
        : "Recommended. The best My Perfect Meals coaches are also My Perfect Meals users.",
      done: status?.personalAccountActive || false,
      locked: false,
      button: status?.personalAccountActive ? null : {
        primary: { label: "Set Up My Personal Account", action: () => setLocation("/onboarding") },
        secondary: { label: "I'll Do This Later", action: () => {} },
      },
    },
    {
      id: "academy",
      icon: status?.academyCompleted
        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
        : <BookOpen className="w-5 h-5 text-orange-400" />,
      title: "My Perfect Meals Academy",
      subtitle: status?.academyCompleted
        ? "Completed — you're a certified My Perfect Meals professional."
        : "Learn how the platform works, how to represent the brand, and how to successfully guide clients.",
      done: status?.academyCompleted || false,
      locked: false,
      button: status?.academyCompleted ? null : {
        primary: { label: "Start Academy", action: () => setLocation("/business-center/affiliate/coaching/certification") },
      },
    },
    {
      id: "training",
      icon: status?.procareTrainingCompleted
        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
        : !status?.academyCompleted
          ? <Lock className="w-5 h-5 text-white/30" />
          : <Briefcase className="w-5 h-5 text-orange-400" />,
      title: "ProCare Training",
      subtitle: status?.procareTrainingCompleted
        ? "Completed — you know how to use ProCare."
        : !status?.academyCompleted
          ? "Complete the Academy first to unlock ProCare Training."
          : "Learn how to invite clients, organize folders, and manage your professional workspace.",
      done: status?.procareTrainingCompleted || false,
      locked: !status?.academyCompleted,
      button: status?.procareTrainingCompleted
        ? null
        : !status?.academyCompleted
          ? null
          : { primary: { label: "Start ProCare Training", action: () => setLocation("/pro-training") } },
    },
    {
      id: "studio",
      icon: studioUnlocked
        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
        : <Lock className="w-5 h-5 text-white/30" />,
      title: "ProCare Studio",
      subtitle: studioUnlocked
        ? "Ready to open."
        : "Unlocks after completing the Academy and ProCare Training.",
      done: false,
      locked: !studioUnlocked,
      button: studioUnlocked
        ? {
            primary: {
              label: "Launch My Studio",
              action: () => setLocation(role === "physician" ? "/care-team/physician" : "/care-team/trainer"),
            },
          }
        : null,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${BC_GRADIENT} text-white flex flex-col`}>
      <div className="flex-1 overflow-y-auto px-4 pt-10 pb-24">
        <div className="max-w-lg mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold mb-1">Your Professional Launchpad</h1>
            <p className="text-white/60 text-sm">
              Complete each step to unlock your ProCare Studio.
            </p>
          </div>

          <div className="space-y-3">
            {steps.filter(step => !step.locked).map((step, i) => (
              <div
                key={step.id}
                className={`rounded-2xl border p-4 ${
                  step.done
                    ? "border-green-500/20 bg-green-900/10"
                    : "border-orange-500/20 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{step.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${step.locked ? "text-white/40" : "text-white"}`}>
                      {step.title}
                    </p>
                    <p className={`text-xs mt-0.5 leading-relaxed ${step.locked ? "text-white/25" : "text-white/55"}`}>
                      {step.subtitle}
                    </p>

                    {step.button && (
                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          onClick={step.button.primary.action}
                          className="w-full py-2.5 px-4 bg-orange-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        >
                          {step.button.primary.label}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {step.button.secondary && (
                          <button
                            onClick={step.button.secondary.action}
                            className="w-full py-2 px-4 bg-white/8 text-white/60 text-xs font-medium rounded-xl active:scale-[0.98] transition-transform"
                          >
                            {step.button.secondary.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-black/30 border border-white/8">
            <p className="text-xs text-white/40 italic text-center leading-relaxed">
              "The best My Perfect Meals coaches are also My Perfect Meals users."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
